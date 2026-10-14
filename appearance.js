/* Universo visual local. No escribe en física, progreso, puntuaciones ni PeerJS.
 * Ambos atlas usan exactamente los mismos recortes y tamaños de presentación. */
(() => {
  "use strict";
  const storageKey = "volt-mates.appearance.v1";
  const themes = Object.freeze({
    normal: {
      atlasKey: "pilots",
      arenaKey: "reactor",
      label: "Estación 07",
      assets: window.VOLT_ASSETS,
    },
    andes: {
      atlasKey: "pilots-andes",
      arenaKey: "reactor-andes",
      label: "Andes · Circuito del Sol",
      assets: window.VOLT_THEME_ASSETS.andes,
    },
  });
  let selected = "normal",
    scene = null;
  try {
    const saved = localStorage.getItem(storageKey);
    if (Object.hasOwn(themes, saved)) selected = saved;
  } catch {
    /* La selección funciona también sin almacenamiento. */
  }

  function updateMarkup() {
    const theme = themes[selected];
    document.body.dataset.theme = selected;
    document
      .querySelectorAll("[data-atlas]")
      .forEach((image) => image.setAttribute("href", theme.assets.atlas));
    document.querySelector(".menu-atmosphere").style.backgroundImage =
      `url("${theme.assets.arena}")`;
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === selected));
    });
    document.querySelectorAll("[data-world-label]").forEach((label) => {
      label.textContent = theme.label;
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = selected === "andes" ? "#131a24" : "#050910";
  }

  function reskin(sprite, atlasKey) {
    if (!sprite || sprite.texture.key === atlasKey) return;
    const width = sprite.displayWidth,
      height = sprite.displayHeight,
      frame = sprite.frame.name;
    sprite.setTexture(atlasKey, frame).setDisplaySize(width, height);
  }

  function apply(id) {
    if (!Object.hasOwn(themes, id)) return;
    const theme = themes[id];
    if (scene && (!scene.textures.exists(theme.atlasKey) || !scene.textures.exists(theme.arenaKey)))
      return;
    selected = id;
    updateMarkup();
    if (scene) {
      scene.arenaBackground.setTexture(theme.arenaKey).setDisplaySize(800, 600);
      scene.players.forEach((player) => reskin(player.sprite, theme.atlasKey));
      scene.targets.forEach((target) => reskin(target.sprite, theme.atlasKey));
      if (scene.ui?.state === "workshop") scene.run.renderWorkshop();
    }
    try {
      localStorage.setItem(storageKey, selected);
    } catch {
      /* Preferencia en memoria. */
    }
  }

  window.VoltAppearance = Object.freeze({
    get selected() {
      return selected;
    },
    get atlasKey() {
      return themes[selected].atlasKey;
    },
    get arenaKey() {
      return themes[selected].arenaKey;
    },
    apply,
    preload(currentScene) {
      currentScene.load.image("pilots-andes", themes.andes.assets.atlas);
      currentScene.load.image("reactor-andes", themes.andes.assets.arena);
    },
    register(currentScene) {
      if (
        currentScene.textures.exists("pilots-andes") &&
        currentScene.textures.exists("reactor-andes")
      ) {
        Object.entries(window.VOLT_ASSETS.frames).forEach(([name, frame]) =>
          currentScene.textures.get("pilots-andes").add(name, 0, ...frame),
        );
      } else {
        selected = "normal";
        document.querySelectorAll('[data-theme-choice="andes"]').forEach((button) => {
          button.disabled = true;
        });
      }
      updateMarkup();
    },
    mount(currentScene) {
      scene = currentScene;
      apply(selected);
      const onClick = (event) => {
        const button = event.target.closest("[data-theme-choice]");
        if (button && !button.disabled) apply(button.dataset.themeChoice);
      };
      document.addEventListener("click", onClick);
      currentScene.events.once("shutdown", () => {
        document.removeEventListener("click", onClick);
        scene = null;
      });
    },
  });
  updateMarkup();
})();
