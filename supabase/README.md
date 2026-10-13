# Activar el ranking global de Volt-Mates

El adaptador está preparado, pero esta entrega no contiene un proyecto Supabase configurado. Hasta conectarlo, se utiliza la clasificación de este dispositivo.

## Configuración

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard).
2. Abre el SQL Editor y ejecuta el contenido completo de ranking.sql.
3. Copia la Project URL y la clave pública publishable de los ajustes del proyecto.
4. Edita ranking-config.js:

window.VOLT_RANKING_CONFIG = Object.freeze({
  supabaseUrl: "https://TU-PROYECTO.supabase.co",
  publishableKey: "sb_publishable_TU_CLAVE_PUBLICA",
  season: "expedition-7"
});

5. Publica el cliente estático o ábrelo como antes. En Ranking de dúos, selecciona Global.

No requiere añadir otro SDK: el cliente utiliza la [API REST de Supabase](https://supabase.com/docs/guides/api/quickstart).
La clave publishable se envía mediante apikey; las claves nuevas no son JWT y no van en Authorization: Bearer. [Documentación de claves](https://supabase.com/docs/guides/getting-started/api-keys).

Usa exclusivamente una clave publishable o anon heredada. No uses service_role ni sb_secret_ en el cliente. La configuración rechaza esas claves.

## Datos y permisos

La tabla duo_scores guarda UUID de partida, nombre del dúo, nombres de los pilotos, puntos, oleadas, cortes, duración, victoria y modo.
La fecha se fija en el servidor. La vista duo_leaderboard publica la mejor partida de cada nombre de dúo y pareja, incluso si cambian de puesto.

RLS permite leer. El cliente no puede insertar, actualizar ni borrar directamente la tabla; sólo puede enviar resultados a submit_duo_score.
La función valida formatos y límites, y un UUID repetido no vuelve a insertar ni modifica el resultado anterior. [Documentación de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Sólo el anfitrión envía la puntuación global de una partida online. Ambos conservan una copia local con el mismo UUID.
Los envíos fallidos se guardan y se reintentan al abrir la clasificación global; por apertura se reintentan hasta cinco entradas pendientes.

## Clasificación

Se ordena por más puntos, más oleadas y menor tiempo, con fecha y UUID como desempates estables.
Los nombres son alias públicos, no cuentas reservadas. La clasificación es comunitaria: el juego sigue siendo P2P y la función SQL valida datos, pero no puede certificar que un cliente modificado haya jugado realmente esa partida. Para un torneo con validación fuerte habría que añadir autenticación, límites de envío y verificación de partidas en un servidor.

No se ha desplegado ni probado contra una cuenta real: no se ha facilitado ninguna. El esquema, la vista, los permisos y la función se verificaron en PostgreSQL local con PGlite. El cliente se verifica mediante respuestas HTTP controladas; la sincronización P2P se prueba con WebRTC real.
