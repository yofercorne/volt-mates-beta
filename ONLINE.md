# TURN privado para Volt-Mates

PeerJS Cloud localiza las salas y WebRTC transporta la partida. La función de Vercel en
`api/turn.js` consulta Metered usando variables privadas. El cliente sólo solicita
`/api/turn`: la API Key no está en JavaScript público, GitHub ni en la respuesta de la función.
El navegador recibe las URLs, usuario y contraseña TURN que WebRTC necesita para conectar;
los datos de la partida siguen viajando cifrados entre los pilotos.

## Configurar Vercel

En el proyecto, abre **Settings → Environment Variables** y añade para **Production**:

- `METERED_DOMAIN`: `voltmates.metered.live`.
- `METERED_TURN_API_KEY`: la Credential API Key de tu credencial TURN. Guarda esta variable
  como **Sensitive** si el panel ofrece esa opción. No uses un prefijo público ni copies el valor a GitHub.

Guarda y vuelve a desplegar. Las variables nuevas se aplican a un nuevo despliegue.
Para las versiones Preview, añade las variables en ese entorno si quieres probarlas allí.

La configuración pública en `network-config.js` contiene sólo:

```js
window.VOLT_NETWORK_CONFIG = Object.freeze({
  turnCredentialsUrl: "/api/turn",
  iceTransportPolicy: "all",
});
```

Si faltan variables, la función responde `503 / turn-not-configured` y el juego conserva
los servidores predeterminados de PeerJS para permitir conexiones que ya funcionaban.
Un error del proveedor responde `502` sin revelar su URL interna ni la clave.
La función rechaza orígenes ajenos y limita solicitudes por IP dentro de cada instancia.
Este límite de beta no es un sistema distribuido de autenticación o protección de cuota.

## Probar

Abre la URL de Vercel en ambos equipos, recarga y crea una sala nueva. Prueba con dos redes
distintas, incluyendo datos móviles. Para comprobar TURN exclusivamente, usa temporalmente
`iceTransportPolicy: "relay"`; después vuelve a `"all"` para permitir rutas directas.

Para diagnosticar, expande `[Volt-Mates] Conexión online` en ambos navegadores: los estados
ICE, SDP y del canal permiten distinguir la negociación y el saludo de la partida.
`relayConfigured` indica Metered; `candidateTypes` muestra si se obtuvo un candidato relay.
La prueba local de la cuenta verificó TURN real por TCP, controles y pausa compartida.

El cliente local se puede abrir con file://, pero esta función privada requiere Vercel
o un servidor local. GitHub Pages por sí solo no ejecuta funciones Node.js.

Fuentes oficiales:
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/environment-variables
- https://www.metered.ca/docs/turn-rest-api/get-credential/
