/* Configuración pública del ranking. Ejecuta supabase/ranking.sql primero.
 * Usa la URL del proyecto y una clave publishable (o anon heredada).
 * Nunca pongas aquí service_role ni sb_secret_. Sin configurar funciona el ranking local. */
window.VOLT_RANKING_CONFIG = Object.freeze({
  supabaseUrl: "https://tfcfqejwqjlzqbktjshz.supabase.co",
  publishableKey: "sb_publishable_NC-IvG-IWB_WqTRnuWcWSw_L4XBcpOC",
  season: "expedition-7",
});
