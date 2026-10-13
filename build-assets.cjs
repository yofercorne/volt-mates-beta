/* Empaqueta recursos originales como data URI para preservar file://.
 * Ejecutar con Node.js: node build-assets.cjs. Sin dependencias. */
const fs = require("node:fs");
const path = require("node:path");
const resource = (file, mime) =>
  "data:" +
  mime +
  ";base64," +
  fs.readFileSync(path.join(__dirname, "assets", file)).toString("base64");
const payload = {
  atlas: resource("volt-sprites.png", "image/png"),
  arena: resource("reactor-deck.png", "image/png"),
  music: resource("circuit-heart.wav", "audio/wav"),
  frames: JSON.parse(fs.readFileSync(path.join(__dirname, "assets", "frames.json"), "utf8")),
};
fs.writeFileSync(
  path.join(__dirname, "assets.js"),
  "/* Recursos de Volt-Mates: regenerados por build-assets.cjs. */\nwindow.VOLT_ASSETS = Object.freeze(" +
    JSON.stringify(payload) +
    ");\n",
);
console.log(
  "assets.js actualizado. " + fs.statSync(path.join(__dirname, "assets.js")).size + " bytes.",
);
