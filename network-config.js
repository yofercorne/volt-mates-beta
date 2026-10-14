/* Configuración pública de WebRTC. El ranking de Supabase es independiente.
 * Metered: usa la API Key de UNA credencial TURN (Show API Key), apta para frontend.
 * Nunca uses la Secret Key de Developers ni una clave de administración.
 * Sin configurar se mantienen los servidores predeterminados de PeerJS. */
window.VOLT_NETWORK_CONFIG = Object.freeze({
  meteredDomain: "", // Ejemplo: volt-mates.metered.live
  meteredCredentialApiKey: "",
  iceTransportPolicy: "all", // "relay" sólo para comprobar el relay TURN.
});
