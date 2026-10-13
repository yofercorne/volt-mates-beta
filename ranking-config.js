/* Configuración pública del ranking. Ejecuta supabase/ranking.sql primero.
 * Usa la URL del proyecto y una clave publishable (o anon heredada).
 * Nunca pongas aquí service_role ni sb_secret_. Sin configurar funciona el ranking local. */
window.VOLT_RANKING_CONFIG = Object.freeze({
  supabaseUrl: "",
  publishableKey: "",
  season: "expedition-7",
});
