# Volt-Mates · Dúos 7

Dos pilotos unidos por un rayo. Seis oleadas, decisiones compartidas y el núcleo de El Desconector.

## Abrir el juego

Abre index.html. Conserva a su lado style.css, game.js, expedition.js, assets.js, theme-assets.js, appearance.js, ranking.js, ranking-config.js, network.js y network-config.js. No requiere instalar nada.
Phaser 3.90.0 y PeerJS 1.5.5 se cargan desde CDN, por lo que el primer inicio necesita internet.
También se puede servir como sitio estático en GitHub Pages o Vercel.
Conserva también favicon.svg y favicon.ico al publicar, para evitar solicitudes de iconos inexistentes.

## Diagnosticar la conexión online

El ranking usa Supabase; las salas usan PeerJS Cloud (0.peerjs.com, puerto 443, HTTPS/WSS).
Son servicios independientes: una consulta correcta al ranking no prueba el acceso al servicio de salas.

Si un piloto no puede crear o unirse a una sala, abre las herramientas del navegador y revisa Network/Red
y Console/Consola. El juego registra `[Volt-Mates] Conexión online`, con el tipo de error, servidor y etapa:
`signaling` identifica un fallo de acceso al servicio de salas; `webrtc` identifica la etapa del enlace
entre pilotos. `signalingOpened` indica si el servicio ya había respondido antes del fallo. Un evento
tardío también puede indicar que se perdió la señalización después de abrirla; el campo `type` permite distinguirlo.

Ante un fallo de señalización, prueba el navegador sin extensiones y una conexión distinta (por ejemplo,
un punto de acceso móvil). Comprueba que la red permita WebSockets seguros hacia 0.peerjs.com y que
la política Content-Security-Policy del despliegue no los bloquee. Cambiar la clave Supabase no soluciona
esa conexión. En cambio, si la sala responde pero falla WebRTC entre redes distintas, revisa NAT/firewall
y la disponibilidad de un servidor TURN; cambiar únicamente el alojamiento estático no resuelve ese caso.

Para compartir un diagnóstico, copia el registro del juego y la URL/estado de la petición fallida.
No hace falta compartir contraseñas ni claves secretas de Supabase.
La API Key de Metered se guarda únicamente en las variables privadas de Vercel.
La función api/turn.js entrega los servidores ICE al navegador. Sigue [ONLINE.md](ONLINE.md)
para configurar METERED_DOMAIN y METERED_TURN_API_KEY y comprobar el relay.

## Controles

- Local: Ion usa WASD; Flux, las flechas.
- Online: Ion crea la sala, Flux introduce el código. Cada uno usa WASD en su equipo.
- Escape: pausa compartida. Cada piloto debe soltar su propia pausa para continuar.
- 1, 2 o 3: elegir mejora; también se puede pulsar una tarjeta.
- Calibración: práctica sin daño. T rearma los drones.

## La expedición

Supera seis oleadas. Tras las oleadas 2, 4 y 5 aparecen tres mejoras aleatorias; se reinician al comenzar otra partida.
Online, los dos deben votar la misma tarjeta. Se puede cambiar el voto. La simulación se detiene mientras eligen.

Las mejoras afectan al daño, alcance, recuperación, velocidad, tiempo de aturdimiento o rescate.
El rayo sigue siendo la única arma de los pilotos. No hay disparos ni daño automático de área.

Eventos con aviso: franja eléctrica y anillos cooperativos. En los anillos, un piloto debe ocupar cada uno durante 1,2 segundos para obtener energía y puntos. La fuga deja una zona peligrosa anunciada antes de activarse.

Nuevos enemigos: Guardián (córtenlo por el costado del escudo), Separador (empuja a los pilotos para tensar el vínculo), Fuga (eviten su residuo) y El Desconector. El jefe avisa antes de su pulso; al abrir el núcleo se vuelve vulnerable al rayo. Su derrota y la limpieza de los acompañantes completan la expedición.

Si un piloto cae, su compañero tiene 8 segundos para acercarse a menos de 70 unidades y mantenerse junto a él durante 1,6 segundos. Revive con 35 de energía. Cada piloto dispone de una oportunidad por expedición. El rayo pierde capacidad de daño durante el rescate. Si ambos caen o se acaba el tiempo, termina la partida. Las mejoras pueden ampliar el rescate.

## Universos visuales

El selector Normal / Andes está en el inicio y en Ajustes (también desde la pausa).
Andes · Circuito del Sol cambia el escenario, los pilotos, los drones, las ilustraciones del menú y la presentación de las ventanas.
El arte vectorial original combina tejidos geométricos, piedra y detalles dorados en una interpretación fantástica inspirada en los Andes peruanos.
No representa un sitio arqueológico específico ni pretende reconstruir una vestimenta histórica.

La elección se guarda en este navegador y se aplica al instante. Cada participante online puede elegir su propio universo.
Ambos atlas conservan los mismos recortes y tamaños. La apariencia no modifica hitboxes, velocidades, daño, oleadas, puntuación ni el protocolo de red.
Los colores, accesorios y desbloqueos del taller siguen funcionando en ambos estilos.
Los SVG originales están en assets/andes-pilots.svg y assets/andes-arena.svg; node build-themes.cjs reconstruye theme-assets.js para conservar la apertura con file://.

## Taller de pilotos

Disponible en el menú, en la pausa y en el lobby. En local puedes diseñar ambos pilotos; online, sólo el tuyo.
Hay 5 acabados de color, 4 accesorios (incluido ninguno) y 4 colores del vínculo.
Cada piloto personaliza su mitad del rayo. El rojo de peligro siempre conserva prioridad.

Los desbloqueos se ganan jugando: cortes acumulados, mejor oleada, rescates y victorias.
Ejemplos: halo al superar la oleada 2, Aurora a los 30 cortes, satélite al rescatar y corona al vencer al jefe.
Los cosméticos son visuales: no alteran estadísticas. El progreso se guarda en localStorage de este navegador; no es una cuenta online ni se comparte entre dispositivos.
Si el almacenamiento está bloqueado, la colección funciona en memoria durante esa sesión.

## Archivos

- game.js: motor, física, combate, pantallas y autoridad PeerJS del anfitrión.
- network.js / network-config.js: preparación de servidores TURN y configuración pública de la beta.
- ONLINE.md: activación del relay y diagnóstico entre redes distintas.
- expedition.js: mejoras, eventos, rescate, progreso y taller.
- assets.js: imágenes y música integradas como data URI para preservar file://.
- appearance.js / theme-assets.js: selector local y recursos del universo andino.
- build-themes.cjs: reconstruye el arte SVG andino y su paquete portable.
- assets/: originales, frames, procedencia y validación.
- build-assets.cjs: reconstruye assets.js con Node.js, sin dependencias.

Arte original generado con ImageGen y música y efectos originales sintetizados.
Color de los personajes por shader en WebGL, con acabado tintado como alternativa en Canvas.
Framebuffer HiDPI hasta 3× y movimiento reducido para las animaciones.

## Redes

Protocolo volt-mates/7: los dos jugadores deben usar esta entrega.
El anfitrión simula daño, posiciones, eventos, elecciones y rescates; el invitado envía dirección y voto.
Los estados entrantes se validan. PeerJS usa señalización pública y WebRTC; algunas redes requieren TURN propio, que esta entrega no incorpora.

## Validación

Pruebas locales de mejoras, eventos, rescate, victoria, progreso, taller, móvil y apertura file://.
19 comprobaciones con una conexión real PeerJS entre dos sesiones de navegador: controles, pausa, consenso de mejoras, eventos, rescates, apariencia del invitado, validación de estados, derrota, reintento y desconexión.

## Nombres y ranking de dúos

En Taller de pilotos, pulsa Cambiar nombres del dúo. También se puede entrar desde Ranking o el lobby.
El nombre del equipo admite hasta 24 caracteres y cada piloto hasta 16. Se guardan en este navegador.
En online, cada persona cambia su piloto y el anfitrión define el nombre del equipo. Los nombres se sincronizan antes de comenzar.

Cada expedición fija sus nombres y un UUID; cambiar nombres durante una partida se aplica a la siguiente.
Las partidas terminadas con puntos entran al ranking de dúos. Se muestra la mejor partida por nombre de equipo y pareja.
Orden: más puntos, más oleadas, menor tiempo. Reabrir resultados no duplica la entrada.

Este dispositivo: clasificación local persistente, funcional sin backend.
Global: configurado con la URL y clave pública facilitadas para la beta. Se verificó la lectura del ranking real.
Para usar otro proyecto, ejecuta supabase/ranking.sql y completa la URL y clave pública en ranking-config.js. Instrucciones en supabase/README.md.
El anfitrión registra la partida online; el invitado conserva una copia local. Los fallos de red se guardan para reintentar.

Nuevos archivos:
- ranking.js: identidades, clasificación local, envío REST, reintentos y vistas.
- ranking-config.js: configuración pública opcional.
- supabase/ranking.sql: tabla, permisos RLS, RPC y vista de mejores dúos.

El título del menú se adapta a la altura disponible. Se retiraron la bitácora y los apagones.

Verificación adicional: ocho tamaños del menú, nombres persistentes y congelados por partida, ranking idempotente, seis pruebas del adaptador REST con respuestas controladas y cinco comprobaciones SQL en un motor PostgreSQL local (PGlite).
La revisión de la beta publicada verificó creación y unión de sala, inicio y pausa compartida desde dos sesiones independientes en la misma conexión de pruebas, y lectura de Supabase real. Se repitió con la corrección local. No se enviaron puntuaciones a la base real durante ese diagnóstico; tampoco se reprodujo la red de la persona afectada.
