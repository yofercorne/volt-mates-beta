/* Arte vectorial original. node build-themes.cjs reconstruye el paquete portable.
 * Los recortes coinciden con el atlas normal para conservar tamaños y siluetas físicas. */
const fs = require("node:fs");
const path = require("node:path");
const frames = JSON.parse(fs.readFileSync(path.join(__dirname, "assets/frames.json"), "utf8"));
const diamond = (x, y, r, color) =>
  `<path d="M${x} ${y - r}l${r} ${r}-${r} ${r}-${r}-${r}Z" fill="${color}"/>`;
const sun = (x, y, r, color) =>
  `<g stroke="${color}" fill="none"><circle cx="${x}" cy="${y}" r="${r}" stroke-width="3"/>${Array.from(
    { length: 12 },
    (_, i) => {
      const a = (i * Math.PI) / 6;
      return `<path d="M${x + Math.cos(a) * (r + 5)} ${y + Math.sin(a) * (r + 5)}l${Math.cos(a) * 9} ${Math.sin(a) * 9}" stroke-width="3"/>`;
    },
  ).join("")}<circle cx="${x}" cy="${y}" r="${r * 0.55}" stroke-width="2"/></g>`;
const textile = (y, color) =>
  `<g fill="none" stroke="${color}" stroke-width="5"><path d="M76 ${y}h25v-9h18v9h18v-9h18v9h18v-9h18v9h18v-9h18v9h18v-9h18v9h25"/>${[96, 142, 188, 234, 280].map((x) => diamond(x, y + 20, 8, color)).join("")}</g>`;
function pilot(frame, pink) {
  const [x, y, w, h] = frame;
  const ink = pink ? "#591931" : "#173454",
    cloth = pink ? "#df4d8f" : "#368ce1",
    light = pink ? "#ffb6d8" : "#a9e0ff",
    pale = pink ? "#ffe0ec" : "#d7f3ff";
  return `<g transform="translate(${x} ${y}) scale(${w / 378} ${h / 488})" stroke-linejoin="round">
    <ellipse cx="190" cy="464" rx="113" ry="13" fill="#061016" opacity=".2"/>
    <path d="M127 350l-10 83-21 26q-4 16 20 18h49l17-110M212 368l5 109h48q29-3 21-20l-22-21-10-86" fill="url(#metal)" stroke="#070e19" stroke-width="9"/>
    <path d="M119 443h46M220 443h47" stroke="${cloth}" stroke-width="8"/>
    <path d="M67 203q-24 18-24 70l-13 38 13 55 31 9 27-36-9-88M288 202q27 20 27 69l16 40-14 54-33 10-27-37 10-88" fill="url(#metal)" stroke="#0c1522" stroke-width="9"/>
    <path d="M42 308l43 7M282 315l43-6" stroke="#d8af63" stroke-width="10"/>
    <path d="M99 180q88-39 177 0l16 129-33 59-141 1-37-60Z" fill="${ink}" stroke="#101521" stroke-width="9"/>
    <path d="M91 169L44 220l35 83 21-11-7 71q93 34 192 0l-8-71 21 11 34-83-46-51-83 32Z" fill="${cloth}" stroke="#101927" stroke-width="8"/>
    <path d="M91 170l94 46 100-46-22 134-73 54-76-56Z" fill="${ink}" opacity=".55"/>
    <path d="M91 170l98 43 96-43M96 326q95 43 185 0" fill="none" stroke="#e8c075" stroke-width="8"/>
    ${textile(284, "#f0cc88")}
    <path d="M111 361v21m24-16v23m25-20v24m25-20v26m25-27v24m25-30v24m25-30v23" stroke="${light}" stroke-width="6"/>
    <path d="M157 204l32 34 31-34-31-15Z" fill="#e9bf64" stroke="#322a23" stroke-width="4"/>
    ${diamond(189, 216, 8, pale)}
    <path d="M109 96q4-57 80-62 76 4 80 62l-4 67q-11 34-76 41-65-7-76-41Z" fill="url(#metal)" stroke="#101724" stroke-width="9"/>
    <path d="M107 98q80-40 164 0l-3 44q-77 39-158 0Z" fill="#080f21" stroke="#e4b765" stroke-width="6"/>
    <path d="M125 109q62-25 128 0l-4 19q-61 24-119 0Z" fill="${cloth}"/>
    <path d="M134 114l34-8m23-3 52 11" stroke="${pale}" stroke-width="6" stroke-linecap="round"/>
    <path d="M107 92l-19 10 7 59 23 13M270 91l18 11-8 59-22 13" fill="${cloth}" stroke="#152338" stroke-width="6"/>
    <path d="M103 98q86-41 173 0l-5-23-47-25-6-24-29-12-30 13-7 24-47 22Z" fill="#ddae5c" stroke="#453929" stroke-width="6"/>
    <path d="M112 78q77-33 153 0" fill="none" stroke="#ffe5a4" stroke-width="5"/>
    ${sun(189, 51, 15, "#ffe4a7")}
    <path d="M148 163q41 20 82 0" fill="none" stroke="#97a7b0" stroke-width="6"/>
    <circle cx="53" cy="339" r="9" fill="${light}"/><circle cx="306" cy="339" r="9" fill="${light}"/>
    <path d="M50 238l14 17M294 243l14-12" stroke="${light}" stroke-width="5"/>
  </g>`;
}
function drone(name, color) {
  const [x, y, w, h] = frames[name];
  const body =
    name === "tank"
      ? `<path d="M53 78l55-40h84l55 40 20 95-35 68H68l-35-68Z" fill="url(#bronze)" stroke="#251a22" stroke-width="8"/><path d="M64 83l86-29 86 29-13 133H77Z" fill="#3a343d" stroke="#d1a660" stroke-width="6"/>`
      : name === "runner"
        ? `<path d="M150 47l48 32 36 104-45 72H111l-45-72 36-104Z" fill="url(#bronze)" stroke="#251a22" stroke-width="8"/><path d="M72 169l-43 39 6 28 68-31m125-36 43 39-6 28-68-31" fill="#e4b16a" stroke="#432b35" stroke-width="7"/>`
        : `<path d="M44 135l-27-57 54 20 40-58h78l40 58 54-20-27 57-11 79-95 44-95-44Z" fill="url(#bronze)" stroke="#291d27" stroke-width="8"/><path d="M55 143l95-53 95 53-15 63-80 35-80-35Z" fill="#373540" stroke="#ddb374" stroke-width="6"/>`;
  return `<g transform="translate(${x} ${y}) scale(${w / 300} ${h / 300})" stroke-linejoin="round">
    <path d="M104 222l-17 40-37 18h68l19-46m63-12 17 40 37 18h-68l-19-46" fill="#373947" stroke="#171b26" stroke-width="7"/>
    ${body}<path d="M102 151l26-13m44 0 26 13" stroke="${color}" stroke-width="13" stroke-linecap="round"/>
    <path d="M150 145l-16 38h32Z" fill="#d2ac6c"/>
    <path d="M112 199h76m-63 10h50" stroke="#bd854d" stroke-width="5"/>
    ${diamond(150, 111, 12, color)}<path d="M78 112l18-13m126 13-18-13" stroke="#f1ce8d" stroke-width="5"/>
    <circle cx="150" cy="79" r="6" fill="#f8ddb0"/>
  </g>`;
}
const defs = `<defs><linearGradient id="metal" x2=".7" y2="1"><stop stop-color="#91a4af"/><stop offset=".4" stop-color="#40566a"/><stop offset="1" stop-color="#152339"/></linearGradient><linearGradient id="bronze" x2=".9" y2="1"><stop stop-color="#ffdb97"/><stop offset=".45" stop-color="#a66b3d"/><stop offset="1" stop-color="#4e3340"/></linearGradient></defs>`;
const atlas = `<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">${defs}${pilot(frames.ion, false)}${pilot(frames.flux, true)}${drone("hunter", "#ff996c")}${drone("runner", "#d7a8ff")}${drone("tank", "#ffdb7e")}<g transform="translate(904 742) scale(.8 1.256)"><path d="M150 30l74 92-18 114-56 40-56-40-18-114Z" fill="url(#bronze)" stroke="#241d30" stroke-width="10"/>${sun(150, 152, 42, "#c7ff73")}</g></svg>`;
const blocks = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 10 }, (_, col) => {
    const x = 68 + col * 67 + (row % 2 ? 0 : 18),
      y = 68 + row * 55;
    return `<path d="M${x} ${y}h62l-3 48h-57Z" fill="${["#202b32", "#253038", "#243038"][(row + col) % 3]}" stroke="#344049" stroke-width="1.5"/>`;
  }).join(""),
).join("");
const terrace = (x, mirror) =>
  `<g transform="translate(${x} 0) ${mirror ? "scale(-1 1)" : ""}"><path d="M0 46h43v61h17v86h-9v103h13v114H48v142H0Z" fill="#303a40" stroke="#53616a" stroke-width="3"/><path d="M8 75h22v62h17v64H33v66h16v69H27v67h12v99H8Z" fill="#171f29" stroke="#86714f" stroke-width="2"/>${[115, 270, 431].map((y) => `<path d="M10 ${y}h19v-12h14v31H24v12H10Z" fill="#d5ab66" opacity=".6"/>`).join("")}<path d="M51 98v394" stroke="#b98b4d" stroke-width="3" opacity=".5"/></g>`;
const arena = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 800 600"><defs><radialGradient id="floor"><stop stop-color="#33404a"/><stop offset="1" stop-color="#131c28"/></radialGradient><radialGradient id="shade"><stop stop-color="#06101a" stop-opacity="0"/><stop offset="1" stop-color="#060d1b" stop-opacity=".8"/></radialGradient><linearGradient id="rim" x2="0" y2="1"><stop stop-color="#e6c58b"/><stop offset="1" stop-color="#896241"/></linearGradient></defs><rect width="800" height="600" fill="#101b27"/><rect x="54" y="51" width="692" height="500" rx="8" fill="url(#floor)"/>${blocks}<g fill="none" stroke="#c8a66b" opacity=".23"><path d="M107 300h586M400 87v426"/><circle cx="400" cy="300" r="177" stroke-width="2"/><circle cx="400" cy="300" r="168"/><path d="M313 268v-55h55v-32h64v32h55v55h32v64h-32v55h-55v32h-64v-32h-55v-55h-32v-64Z" stroke-width="3"/>${sun(400, 300, 54, "#d5b577")}</g><path d="M71 60h658v480H71Z" fill="none" stroke="#c2a271" stroke-width="2" opacity=".45"/><path d="M91 78h618v444H91Z" fill="none" stroke="#61737b" opacity=".4"/>${terrace(0, false)}${terrace(800, true)}<path d="M62 0h676v47H62Z" fill="#2c363d"/><path d="M64 553h672v47H64Z" fill="#25323b"/><path d="M88 35h624M88 565h624" stroke="url(#rim)" stroke-width="4"/><g stroke="#d0ad73" fill="none" stroke-width="3" opacity=".7">${[126, 236, 564, 674].map((x) => `<path d="M${x - 28} 20h17v-9h22v9h17m-56 561h17v9h22v-9h17"/>`).join("")}</g><rect x="345" y="5" width="110" height="39" rx="5" fill="#1e2833" stroke="#9b8054"/>${sun(400, 24, 10, "#f2ca82")}<g fill="#8ad7ff"><circle cx="72" cy="71" r="4"/><circle cx="72" cy="529" r="4"/></g><g fill="#ffaaca"><circle cx="728" cy="71" r="4"/><circle cx="728" cy="529" r="4"/></g><rect width="800" height="600" fill="url(#shade)"/></svg>`;
fs.writeFileSync(path.join(__dirname, "assets/andes-pilots.svg"), atlas);
fs.writeFileSync(path.join(__dirname, "assets/andes-arena.svg"), arena);
const uri = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
fs.writeFileSync(
  path.join(__dirname, "theme-assets.js"),
  "/* Arte SVG original empaquetado por build-themes.cjs; compatible con file://. */\nwindow.VOLT_THEME_ASSETS = Object.freeze(" +
    JSON.stringify({ andes: { atlas: uri(atlas), arena: uri(arena) } }) +
    ");\n",
);
console.log("Arte Andes y theme-assets.js reconstruidos.");
