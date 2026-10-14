const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../network.js"), "utf8");
const servers = [
  { urls: "stun:global.relay.metered.ca:80" },
  {
    urls: [
      "turn:global.relay.metered.ca:443?transport=tcp",
      "turns:global.relay.metered.ca:443?transport=tcp",
    ],
    username: "test-user",
    credential: "test-password",
  },
];
function load(config, fetch) {
  const context = {
    window: { VOLT_NETWORK_CONFIG: config },
    fetch,
    AbortController,
    DOMException,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(source, context);
  return context.window.VoltNetwork;
}
const config = {
  meteredDomain: "volt-test.metered.live",
  meteredCredentialApiKey: "scoped-test-key",
};

test("sin cuenta configurada conserva la configuración predeterminada de PeerJS", async () => {
  const api = load({}, () => {
    throw Error("No debe pedir credenciales");
  });
  const result = await api.prepare();
  assert.equal(result.config, null);
  assert.equal(result.relayConfigured, false);
});

test("usa la API de una credencial y entrega las rutas TCP/TLS a PeerJS", async () => {
  const api = load({ ...config, iceTransportPolicy: "relay" }, async (url, options) => {
    assert.equal(
      url,
      "https://volt-test.metered.live/api/v1/turn/credentials?apiKey=scoped-test-key",
    );
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.cache, "no-store");
    return { ok: true, json: async () => servers };
  });
  const result = await api.prepare();
  assert.equal(result.config.iceTransportPolicy, "relay");
  assert.equal(result.tlsRelay, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.config.iceServers)), [
    { urls: ["stun:global.relay.metered.ca:80"] },
    servers[1],
  ]);
});

test("rechazo del proveedor no filtra su respuesta ni la clave en el error", async () => {
  const api = load(config, async () => ({ ok: false, status: 401 }));
  await assert.rejects(api.prepare(), { message: "turn-credentials-unavailable" });
});

test("cancelar el lobby aborta la petición de credenciales pendiente", async () => {
  let receivedSignal;
  const api = load(
    config,
    (_, options) =>
      new Promise((_, reject) => {
        receivedSignal = options.signal;
        options.signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  const controller = new AbortController();
  const pending = api.prepare(controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(receivedSignal.aborted, true);
});

test("no acepta STUN sin relay ni direcciones HTTP como respuesta TURN", () => {
  const api = load({}, null);
  assert.throws(
    () => api.normalizeServers([{ urls: "stun:stun.example.com:3478" }]),
    /turn-missing-relay/,
  );
  assert.throws(
    () => api.normalizeServers([{ urls: "https://example.com", username: "x", credential: "x" }]),
    /turn-invalid-response/,
  );
});
