# Volt-Mates · Recursos de la Fase 5

## Arte

Generado con la herramienta integrada ImageGen. Originales copiados al proyecto, sin retocar los píxeles. Los sprites se seleccionan mediante frames de Phaser del atlas con transparencia.

- `volt-sprites.png`: Ion, Flux, rastreador, impulsor, bastión y celda decorativa.
- `reactor-deck.png`: arena de la Estación 07.

### Prompt del atlas

Use case: stylized-concept. Asset type: production transparent game sprite atlas for Volt-Mates, a cooperative top-down arena game. Create ONE clean sprite atlas image, square 1024 by 1024 canvas, truly transparent background. Exactly SIX cells in a precise 3-column by 2-row grid (each cell one third width and half height), no borders, no text, no extraneous objects. All six subjects centered in their own cell and fully separated with broad transparent margins. Row1 col1: ION, an adorable compact electric-blue sentient battery robot with rounded armored body, dark glass visor, two expressive cyan eyes, short little mechanical feet, two tiny antennae. Row1 col2: FLUX, matching raspberry-pink battery robot with a heart-shaped antenna tip, warm pink eyes and white metal accents. Row1 col3: a coral-red rogue electrical drone, round triangular armored shell, single menacing white eye, three small blades. Row2 col1: an amber-yellow fast runner drone, sharp arrowhead silhouette, twin prongs, hot white eye. Row2 col2: a bulky violet heavy tank drone, hexagonal heavy armor and one luminous violet reactor eye. Row2 col3: a small luminous mint-green power cell, rounded capsule with lightning emblem, decorative collectible icon. View all from SAME elevated orthographic three-quarter overhead view suitable for top-down gameplay, facing bottom of image. Premium polished hand-painted 3D cartoon game art, smooth high-resolution antialiased contours, crisp big color shapes that read at 50 pixels, bright rim light and restrained shading, original charming industrial sci-fi design, no pixel art, no weapons on the friendly pilots, no ground plane or cast shadows, no glow spilling far from silhouettes. Occupy roughly 75 percent of EACH cell width and 60 percent of cell height. Each cell contains a SINGLE individual sprite. Transparent empty space between cells. No checkerboard painted in.

### Prompt del escenario

Use case: stylized-concept. Asset type: production background arena floor for Volt-Mates top-down cooperative sci-fi game. A single orthographic TOP DOWN rectangular arena, 4:3 landscape aspect ratio, polished atmospheric industrial space-station reactor deck. The entire central 85% is a FLAT clear playable surface, very dark midnight blue graphite metal, sparse subtle large beveled panel seams and a very faint central concentric reactor ring, readable flat floor with low contrast and no obstacles. Narrow perimeter features detailed recessed electrical conduits, tiny blue indicator lights along the left edge, pink indicator lights along the right edge, a few restrained mint light accents and light mist only at far outer corners. Exactly overhead camera, no perspective horizon, no buildings, no stairs, no upright objects, no characters, no enemies, no HUD, no numbers, no words, no text, no logos. High quality hand-painted cinematic sci-fi game environment, smooth antialiased detail, soft bounced blue/pink lighting, evocative lonely abandoned power facility, not pixel art, not a screenshot. Center stays clean DARK for luminous player sprites and a mint energy beam to be easily seen. Border occupies only about 6% on each edge, whole image is the playable arena.

## Audio

`circuit-heart.wav`: composición original sintetizada por código, 112 BPM, 8 compases en do menor, bajo, arpegio, acordes y percusión. No se usó un generador de audio por IA. Los efectos se sintetizan en tiempo real con Web Audio. Sólo se reproduce tras un gesto del usuario.

## Distribución

`assets.js` integra las imágenes y la música para permitir abrir `index.html` directamente sin restricciones CORS de file://. Mantener este archivo junto a index.html, style.css y game.js. `build-assets.cjs` reconstruye el bundle desde los originales.

## Rutas finales guardadas

- C:/Users/LENOVO/OneDrive/Documentos/ChatGPT/hackaton/assets/volt-sprites.png
- C:/Users/LENOVO/OneDrive/Documentos/ChatGPT/hackaton/assets/reactor-deck.png
- C:/Users/LENOVO/OneDrive/Documentos/ChatGPT/hackaton/assets/circuit-heart.wav
- C:/Users/LENOVO/OneDrive/Documentos/ChatGPT/hackaton/assets/frames.json
