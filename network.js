/* Preparación de ICE independiente de la simulación y del ranking. */
(() => {
  "use strict";
  const validUrl = (url) =>
    typeof url === "string" &&
    url.length <= 512 &&
    /^(?:stun|stuns|turn|turns):[a-z\d.:[\]-]+(?:\?transport=(?:udp|tcp))?$/i.test(url);

  function normalizeServers(data) {
    if (!Array.isArray(data) || !data.length || data.length > 20)
      throw Error("turn-invalid-response");
    const servers = data.map((server) => {
      const urls = typeof server?.urls === "string" ? [server.urls] : server?.urls;
      if (!Array.isArray(urls) || !urls.length || urls.length > 20 || !urls.every(validUrl))
        throw Error("turn-invalid-response");
      if (urls.some((url) => /^turns?:/i.test(url))) {
        if (
          typeof server.username !== "string" ||
          !server.username ||
          server.username.length > 1024 ||
          typeof server.credential !== "string" ||
          !server.credential ||
          server.credential.length > 1024
        )
          throw Error("turn-invalid-response");
        return { urls: [...urls], username: server.username, credential: server.credential };
      }
      return { urls: [...urls] };
    });
    if (!servers.some((s) => s.urls.some((url) => /^turns?:/i.test(url))))
      throw Error("turn-missing-relay");
    return servers;
  }

  async function prepare(signal) {
    const settings = window.VOLT_NETWORK_CONFIG || {};
    const endpoint = settings.turnCredentialsUrl || "";
    if (!endpoint || location.protocol === "file:")
      return { config: null, relayConfigured: false, tlsRelay: false };
    if (typeof endpoint !== "string" || !/^\/(?!\/)[a-z\d/_-]+$/i.test(endpoint))
      throw Error("turn-invalid-config");
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, 10000);
    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json();
      if (response.status === 503 && data?.error === "turn-not-configured")
        return { config: null, relayConfigured: false, tlsRelay: false };
      if (!response.ok) throw Error("turn-credentials-unavailable");
      const iceServers = normalizeServers(data.iceServers);
      return {
        config: {
          iceServers,
          iceTransportPolicy: settings.iceTransportPolicy === "relay" ? "relay" : "all",
        },
        relayConfigured: true,
        tlsRelay: iceServers.some((s) => s.urls.some((url) => /^turns:/i.test(url))),
      };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
  }
  window.VoltNetwork = Object.freeze({ prepare, normalizeServers });
})();
