# Conectar Volt-Mates entre redes distintas

El ranking usa Supabase. PeerJS Cloud localiza los pilotos; WebRTC transporta la partida.
`signalingOpened: true` confirma que respondió el servicio de salas, pero no confirma un enlace
entre los jugadores. Un `setup-timeout` puede ser una negociación ICE incompleta o un saludo
del juego sin confirmar. El diagnóstico incluye los estados de ICE, SDP y del canal para distinguirlos.
Los datos móviles pueden utilizar NAT compartido o simétrico: también pueden necesitar TURN.

## Activar Metered / Open Relay

1. Crea una cuenta en https://dashboard.metered.ca/signup y selecciona el servicio TURN / Open Relay.
2. Obtén el dominio de tu aplicación, por ejemplo `volt-mates.metered.live`.
3. En TURN Server, crea una credencial para esta beta. En su fila abre **Get credential / Show API Key**.
   Usa esa **Credential API Key**, limitada a obtener los servidores de esa credencial.
   No uses la **Secret Key** de Developers ni una clave de administración del proyecto.
4. Completa `network-config.js`:

```js
window.VOLT_NETWORK_CONFIG = Object.freeze({
  meteredDomain: "TU-APP.metered.live",
  meteredCredentialApiKey: "API_KEY_DE_LA_CREDENCIAL_TURN",
  iceTransportPolicy: "all",
});
```

5. Guarda el archivo en GitHub y espera al despliegue de Vercel. Ambos jugadores deben recargar.
6. El cliente solicita `GET /api/v1/turn/credentials` antes de crear PeerJS y valida el resultado.
   El navegador elige la ruta directa o TURN. Si caducas o deshabilitas la credencial, actualiza la
   configuración para las nuevas salas. La clave es pública y consume la cuota de esa credencial;
   revisa su uso en el panel de Metered durante la beta.

No hay que cambiar la base de datos ni desplegar otro servidor del juego.
Sin estos valores se conservan los servidores predeterminados de PeerJS; la integración nueva
está preparada, pero el relay de tu cuenta no queda activo hasta configurar la credencial.

## Comprobar el relay

Para una prueba corta, cambia `iceTransportPolicy` a `"relay"` con Metered configurado y despliega.
Ambos jugadores deben poder crear/unirse e iniciar la partida usando únicamente TURN.
Después devuelve el valor a `"all"` para permitir conexiones directas con menor latencia.
Prueba también dos redes diferentes, una de ellas con datos móviles.

Si vuelve a fallar, expande `[Volt-Mates] Conexión online` en la consola de AMBOS navegadores.
Comparte `connectionState`, `iceConnectionState`, `iceGatheringState`, `dataChannelState`,
`localDescription`, `remoteDescription`, `candidateTypes`, `iceErrorCodes` y `relayConfigured`.
El registro no incluye direcciones IP ni claves TURN. Un código ICE aislado no prueba que todos
los servidores hayan fallado: importa el estado final y si se reunió un candidato `relay`.
`relayConfigured` indica la configuración de Metered; `relayProvider: "peerjs-default"` indica
los servidores de la librería, que también incluyen un relay público. No equivale a comprobar
su disponibilidad en una red concreta ni sustituye la prueba con `iceTransportPolicy: "relay"`.

## Audio

Phaser no crea un segundo AudioContext. La música y los efectos utilizan el sistema propio,
que crea y reanuda su contexto después de pulsar Entrar o interactuar con el juego.
La política de autoplay del navegador no controla el enlace WebRTC.

Fuentes oficiales:
- https://peerjs.com/client/faq
- https://www.metered.ca/tools/openrelay/
- https://www.metered.ca/docs/turn-rest-api/
- https://www.metered.ca/docs/turn-rest-api/get-credential/
