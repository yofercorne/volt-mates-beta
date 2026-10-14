/* Función de Vercel: mantener la API Key del proveedor fuera del cliente. */
const attempts = new Map();
const validIceUrl = (url) =>
  typeof url === "string" &&
  /^(?:stun|stuns|turn|turns):[a-z\d.:[\]-]+(?:\?transport=(?:udp|tcp))?$/i.test(url);

module.exports = async function turn(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method-not-allowed" });
  }
  const origin = req.headers.origin;
  try {
    if (
      req.headers["sec-fetch-site"] === "cross-site" ||
      (origin && new URL(origin).host !== req.headers.host)
    )
      return res.status(403).json({ error: "origin-not-allowed" });
  } catch {
    return res.status(403).json({ error: "origin-not-allowed" });
  }
  const domain = (process.env.METERED_DOMAIN || "").trim().toLowerCase();
  const key = process.env.METERED_TURN_API_KEY;
  if (!/^[a-z\d](?:[a-z\d-]*[a-z\d])?\.metered\.live$/.test(domain) || !key)
    return res.status(503).json({ error: "turn-not-configured" });

  // Límite por instancia para la beta; no sustituye un límite distribuido.
  const now = Date.now();
  for (const [ip, value] of attempts) if (value.until <= now) attempts.delete(ip);
  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  const value = attempts.get(ip) || { count: 0, until: now + 60000 };
  if (value.count >= 12 || attempts.size >= 2000) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "turn-rate-limited" });
  }
  value.count++;
  attempts.set(ip, value);
  try {
    const response = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(8000), cache: "no-store" },
    );
    if (!response.ok) throw Error("provider-unavailable");
    const data = await response.json();
    if (!Array.isArray(data) || !data.length || data.length > 20) throw Error("invalid-servers");
    const iceServers = data.map((server) => {
      const urls = typeof server?.urls === "string" ? [server.urls] : server?.urls;
      if (!Array.isArray(urls) || !urls.length || urls.length > 20 || !urls.every(validIceUrl))
        throw Error("invalid-servers");
      if (urls.some((url) => /^turns?:/i.test(url))) {
        if (
          typeof server.username !== "string" ||
          !server.username ||
          typeof server.credential !== "string" ||
          !server.credential
        )
          throw Error("invalid-servers");
        return { urls, username: server.username, credential: server.credential };
      }
      return { urls };
    });
    if (!iceServers.some((s) => s.urls.some((u) => /^turns?:/i.test(u))))
      throw Error("missing-relay");
    return res.status(200).json({ iceServers });
  } catch {
    return res.status(502).json({ error: "turn-provider-unavailable" });
  }
};
