/* Configuración pública. La API Key de Metered sólo se guarda en Vercel.
 * La función entrega los datos ICE que WebRTC necesita, sin exponer esa API Key. */
window.VOLT_NETWORK_CONFIG = Object.freeze({
  turnCredentialsUrl: "/api/turn",
  iceTransportPolicy: "all", // "relay" sólo para comprobar el relay TURN.
});
