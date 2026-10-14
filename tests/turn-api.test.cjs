const test = require("node:test");
const assert = require("node:assert/strict");
const turn = require("../api/turn.js");
const servers = [
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "relay-user",
    credential: "relay-password",
    apiKey: "private-test-key",
  },
];
let nextIp = 1;
async function call(headers = {}, method = "GET") {
  const result = { headers: {} };
  const res = {
    setHeader: (k, v) => (result.headers[k] = v),
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  await turn(
    {
      method,
      headers: {
        host: "volt-mates.vercel.app",
        "x-forwarded-for": `198.51.100.${nextIp++}`,
        ...headers,
      },
    },
    res,
  );
  return result;
}
async function configured(run, fetcher) {
  const oldFetch = global.fetch,
    oldDomain = process.env.METERED_DOMAIN,
    oldKey = process.env.METERED_TURN_API_KEY;
  process.env.METERED_DOMAIN = "voltmates.metered.live";
  process.env.METERED_TURN_API_KEY = "private-test-key";
  global.fetch = fetcher || (async () => ({ ok: true, json: async () => servers }));
  try {
    await run();
  } finally {
    global.fetch = oldFetch;
    if (oldDomain === undefined) delete process.env.METERED_DOMAIN;
    else process.env.METERED_DOMAIN = oldDomain;
    if (oldKey === undefined) delete process.env.METERED_TURN_API_KEY;
    else process.env.METERED_TURN_API_KEY = oldKey;
  }
}
test("sin variables privadas devuelve un estado reconocible, sin credenciales", async () => {
  const result = await call();
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: "turn-not-configured" });
});
test("devuelve ICE necesario para WebRTC y elimina la API Key de la respuesta", async () => {
  await configured(async () => {
    const result = await call({ origin: "https://volt-mates.vercel.app" });
    assert.equal(result.status, 200);
    assert.equal(result.headers["Cache-Control"], "no-store");
    assert.equal(result.body.iceServers[0].username, "relay-user");
    assert(!JSON.stringify(result).includes("private-test-key"));
    assert(!Object.hasOwn(result.body.iceServers[0], "apiKey"));
  });
});
test("no habilita llamadas desde otra web ni métodos de escritura", async () => {
  await configured(
    async () => {
      assert.equal((await call({ origin: "https://otro.example" })).status, 403);
      assert.equal((await call({}, "POST")).status, 405);
    },
    async () => {
      throw Error("No debe llamar al proveedor");
    },
  );
});
test("un error del proveedor no revela su respuesta ni la clave", async () => {
  await configured(
    async () => {
      const result = await call();
      assert.equal(result.status, 502);
      assert.deepEqual(result.body, { error: "turn-provider-unavailable" });
    },
    async () => {
      throw Error("URL interna contiene private-test-key");
    },
  );
});
test("limita solicitudes repetidas por IP en una misma instancia", async () => {
  await configured(async () => {
    for (let i = 0; i < 12; i++)
      assert.equal((await call({ "x-forwarded-for": "198.51.100.200" })).status, 200);
    const result = await call({ "x-forwarded-for": "198.51.100.200" });
    assert.equal(result.status, 429);
    assert.equal(result.headers["Retry-After"], "60");
  });
});
