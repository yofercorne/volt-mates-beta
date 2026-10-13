/* Volt-Mates: progreso permanente, mejoras de expedición, eventos y rescates.
 * Sin dependencias ni peticiones: conserva la apertura directa con file://. */
(() => {
  "use strict";
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const $ = (id) => document.getElementById(id);
  const cosmetics = {
    paint: [
      {
        id: "original",
        name: "De fábrica",
        color: "#85baff",
        goal: "Siempre disponible",
        metric: "kills",
        need: 0,
        hue: null,
      },
      {
        id: "aurora",
        name: "Aurora",
        color: "#79ffd9",
        goal: "Corta 30 enemigos",
        metric: "kills",
        need: 30,
        hue: 155,
      },
      {
        id: "solar",
        name: "Solar",
        color: "#ffd46e",
        goal: "Supera la oleada 3",
        metric: "bestWave",
        need: 3,
        hue: 40,
      },
      {
        id: "glacier",
        name: "Glaciar",
        color: "#b3dfff",
        goal: "Corta 100 enemigos",
        metric: "kills",
        need: 100,
        hue: 185,
      },
      {
        id: "royal",
        name: "Amatista",
        color: "#cda5ff",
        goal: "Vence al Desconector",
        metric: "wins",
        need: 1,
        hue: 275,
      },
    ],
    accessory: [
      {
        id: "none",
        name: "Sin accesorio",
        color: "#a6bbce",
        goal: "Siempre disponible",
        metric: "kills",
        need: 0,
      },
      {
        id: "ring",
        name: "Halo orbital",
        color: "#c7ff73",
        goal: "Supera la oleada 2",
        metric: "bestWave",
        need: 2,
      },
      {
        id: "satellite",
        name: "Pequeño satélite",
        color: "#8dd9ff",
        goal: "Rescata a tu compañero",
        metric: "rescues",
        need: 1,
      },
      {
        id: "crown",
        name: "Corona del núcleo",
        color: "#ffdb82",
        goal: "Vence al Desconector",
        metric: "wins",
        need: 1,
      },
    ],
    beam: [
      {
        id: "mint",
        name: "Chispa verde",
        color: "#c7ff73",
        goal: "Siempre disponible",
        metric: "kills",
        need: 0,
      },
      {
        id: "cyan",
        name: "Plasma azul",
        color: "#80eaff",
        goal: "Corta 50 enemigos",
        metric: "kills",
        need: 50,
      },
      {
        id: "rose",
        name: "Pulso rosa",
        color: "#ff94c9",
        goal: "Supera la oleada 3",
        metric: "bestWave",
        need: 3,
      },
      {
        id: "gold",
        name: "Arco dorado",
        color: "#ffdf88",
        goal: "Vence al Desconector",
        metric: "wins",
        need: 1,
      },
    ],
  };
  const upgrades = [
    {
      id: "power",
      icon: "ϟ",
      name: "Condensador",
      text: "El rayo hace un 25 % más de daño por nivel.",
      max: 2,
    },
    {
      id: "elastic",
      icon: "↔",
      name: "Cable flexible",
      text: "35 unidades extra de alcance por nivel.",
      max: 2,
    },
    {
      id: "repair",
      icon: "+",
      name: "Circuito médico",
      text: "Cada cuatro cortes recuperan 3 de energía por nivel.",
      max: 2,
    },
    {
      id: "quick",
      icon: "∞",
      name: "Reinicio ágil",
      text: "El aturdimiento dura medio segundo menos por nivel.",
      max: 2,
    },
    {
      id: "edge",
      icon: "◇",
      name: "Al filo",
      text: "60 % más de daño cuando el vínculo está casi al límite.",
      max: 1,
    },
    {
      id: "stride",
      icon: "»",
      name: "Patines iónicos",
      text: "Ambos pilotos se mueven un 10 % más rápido por nivel.",
      max: 2,
    },
    {
      id: "rescue",
      icon: "♡",
      name: "Segunda chispa",
      text: "Tres segundos extra para rescatar y 15 más de energía al volver.",
      max: 1,
    },
  ];
  const defaultOutfit = () => ({ paint: "original", accessory: "none", beam: "mint" });
  const validOutfit = (o) =>
    o && Object.keys(cosmetics).every((k) => cosmetics[k].some((c) => c.id === o[k]));
  const findCosmetic = (category, id) => cosmetics[category].find((c) => c.id === id);
  class PilotProfile {
    constructor() {
      this.stats = { kills: 0, bestWave: 0, rescues: 0, wins: 0 };
      this.outfits = [defaultOutfit(), defaultOutfit()];
      this.names = ["Ion", "Flux"];
      this.duoName = "Volt-Mates";
      try {
        const saved = JSON.parse(localStorage.getItem("volt-mates.pilots.v1") || "null");
        for (const k of Object.keys(this.stats))
          if (Number.isInteger(saved?.stats?.[k]) && saved.stats[k] >= 0 && saved.stats[k] <= 1e7)
            this.stats[k] = saved.stats[k];
        if (window.VoltLeague.validIdentity({ duo: saved?.duoName, names: saved?.names })) {
          this.names = [...saved.names];
          this.duoName = saved.duoName;
        }
        if (Array.isArray(saved?.outfits))
          saved.outfits.slice(0, 2).forEach((o, i) => {
            if (!validOutfit(o)) return;
            for (const k of Object.keys(cosmetics))
              if (this.unlocked(findCosmetic(k, o[k]))) this.outfits[i][k] = o[k];
          });
      } catch {
        /* Perfil en memoria si el navegador limita el almacenamiento. */
      }
    }
    unlocked(item) {
      return this.stats[item.metric] >= item.need;
    }
    save() {
      try {
        localStorage.setItem(
          "volt-mates.pilots.v1",
          JSON.stringify({
            stats: this.stats,
            outfits: this.outfits,
            names: this.names,
            duoName: this.duoName,
          }),
        );
      } catch {}
    }
    credit(kills, wave, rescues, win) {
      const before = new Set(
        Object.values(cosmetics)
          .flat()
          .filter((c) => this.unlocked(c))
          .map((c) => c.id),
      );
      this.stats.kills = clamp(this.stats.kills + kills, 0, 1e7);
      this.stats.bestWave = Math.max(this.stats.bestWave, wave);
      this.stats.rescues = clamp(this.stats.rescues + rescues, 0, 1e7);
      this.stats.wins = clamp(this.stats.wins + Number(win), 0, 1e7);
      this.save();
      return Object.values(cosmetics)
        .flat()
        .filter((c) => this.unlocked(c) && !before.has(c.id));
    }
    equip(pilot, category, id) {
      const item = findCosmetic(category, id);
      if (!item || !this.unlocked(item)) return false;
      this.outfits[pilot][category] = id;
      this.save();
      return true;
    }
  }
  const profile = new PilotProfile();

  class RunSystems {
    constructor(scene, services) {
      this.scene = scene;
      Object.assign(this, services);
      // Las zonas peligrosas permanecen por encima del suelo.
      this.floor = scene.add.graphics().setDepth(5.5);
      this.ornaments = scene.add.graphics().setDepth(13);
      this.workshopPilot = 0;
      this.workshopCategory = "paint";
      this.workshopReturn = "menu";
      this.reset();
      this.bind();
    }
    reset() {
      this.id = window.VoltLeague.runId();
      this.identity = { duo: profile.duoName, names: [...profile.names] };
      if (this.scene.net?.role === "host" && this.scene.net.remoteName)
        this.identity.names[1] = this.scene.net.remoteName;
      this.levels = Object.fromEntries(upgrades.map((u) => [u.id, 0]));
      this.offer = [];
      this.votes = [-1, -1];
      this.draftWave = 0;
      this.rescue = { pilot: -1, remaining: 0, progress: 0 };
      this.usedRescues = [false, false];
      this.rescues = 0;
      this.event = { kind: "none", remaining: 0, warning: 0, progress: 0, offset: 0 };
      this.eventClock = 9000;
      this.eventIndex = 0;
      this.puddles = [];
      this.outfits = profile.outfits.map((o) => ({ ...o }));
      if (this.scene.net?.role === "host" && validOutfit(this.scene.net.remoteOutfit))
        this.outfits[1] = { ...this.scene.net.remoteOutfit };
      this.creditedKills = 0;
      this.creditedRescues = 0;
      this.creditedWave = 0;
      this.recordedWin = false;
      this.noticeUntil = 0;
      this.scene.won = false;
      this.floor.clear();
      this.ornaments.clear();
      this.renderOffer();
    }
    bind() {
      this.click = (e) => {
        const choice = e.target.closest("[data-upgrade]");
        if (choice) {
          this.sound.unlock();
          this.choose(Number(choice.dataset.upgrade));
        }
        const pilot = e.target.closest("[data-pilot]");
        if (pilot) {
          this.workshopPilot = Number(pilot.dataset.pilot);
          this.renderWorkshop();
        }
        const tab = e.target.closest("[data-custom-tab]");
        if (tab) {
          this.workshopCategory = tab.dataset.customTab;
          this.renderWorkshop();
        }
        const item = e.target.closest("[data-cosmetic]");
        if (
          item &&
          profile.equip(this.workshopPilot, this.workshopCategory, item.dataset.cosmetic)
        ) {
          this.outfits[this.workshopPilot] = { ...profile.outfits[this.workshopPilot] };
          this.scene.net?.send({ t: "outfit", outfit: profile.outfits[this.workshopPilot] });
          this.scene.net?.sendSnapshot();
          this.sound.suspended = false;
          this.sound.play("select");
          this.renderWorkshop();
        }
      };
      document.addEventListener("click", this.click);
    }
    destroy() {
      document.removeEventListener("click", this.click);
      this.floor.destroy();
      this.ornaments.destroy();
    }
    get maxDistance() {
      return this.settings.maxDistance + this.levels.elastic * 35;
    }
    get reconnectDistance() {
      return this.settings.reconnectDistance + this.levels.elastic * 35;
    }
    get stunMs() {
      return this.settings.stunMs - this.levels.quick * 500;
    }
    get speed() {
      return this.settings.playerSpeed * (1 + this.levels.stride * 0.1);
    }
    get beamColor() {
      return parseInt(findCosmetic("beam", this.outfits[0].beam).color.slice(1), 16);
    }
    get otherBeamColor() {
      return parseInt(findCosmetic("beam", this.outfits[1].beam).color.slice(1), 16);
    }
    damage() {
      return (
        this.settings.beamDamagePerSecond *
        (1 +
          this.levels.power * 0.25 +
          (this.levels.edge && this.scene.link.distance >= this.maxDistance * 0.82 ? 0.6 : 0))
      );
    }
    openDraft(wave) {
      if (![2, 4, 5].includes(wave)) return;
      const available = upgrades.filter((u) => this.levels[u.id] < u.max);
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }
      this.offer = available.slice(0, 3).map((u) => u.id);
      this.votes = [-1, -1];
      this.draftWave = wave;
      this.event = { kind: "none", remaining: 0, warning: 0, progress: 0, offset: 0 };
      this.scene.ui.show("upgrade");
      this.renderOffer();
    }
    choose(index) {
      if (
        this.scene.ui.state !== "upgrade" ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= this.offer.length
      )
        return;
      if (this.scene.net.isGuest()) {
        this.scene.net.send({
          t: "vote",
          round: this.scene.net.round,
          wave: this.draftWave,
          index,
        });
        return;
      }
      this.vote(0, index);
      if (!this.scene.net.online) this.vote(1, index);
    }
    vote(pilot, index) {
      if (
        this.scene.ui.state !== "upgrade" ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= this.offer.length
      )
        return;
      this.votes[pilot] = index;
      this.renderOffer();
      if (this.votes[0] === this.votes[1] && this.votes[0] >= 0) {
        const id = this.offer[index];
        this.levels[id]++;
        this.scene.fx.message(400, 270, upgrades.find((u) => u.id === id).name.toUpperCase());
        this.offer = [];
        this.votes = [-1, -1];
        this.draftWave = 0;
        // Una petición de pausa que llegó durante la elección conserva su dueño.
        const net = this.scene.net;
        this.scene.ui.resumeState = "playing";
        this.scene.ui.show(
          net.online && (net.hostPaused || net.guestPaused) ? "paused" : "playing",
        );
        this.sound.play("reconnect");
      }
      this.scene.net.sendSnapshot();
    }
    renderOffer() {
      const cards = $("upgrade-options");
      if (!cards) return;
      const focus = document.activeElement?.dataset.upgrade;
      cards.replaceChildren();
      this.offer.forEach((id, index) => {
        const upgrade = upgrades.find((u) => u.id === id),
          button = document.createElement("button");
        button.className = "upgrade-option";
        button.dataset.upgrade = index;
        button.innerHTML =
          '<span class="upgrade-glyph">' +
          upgrade.icon +
          "</span><strong>" +
          upgrade.name +
          "</strong><small>" +
          upgrade.text +
          '</small><span class="upgrade-votes"><i class="vote-ion ' +
          (this.votes[0] === index ? "active" : "") +
          '">ION</i><i class="vote-flux ' +
          (this.votes[1] === index ? "active" : "") +
          '">FLUX</i></span><kbd>' +
          (index + 1) +
          "</kbd>";
        button.querySelector(".vote-ion").textContent = this.identity.names[0];
        button.querySelector(".vote-flux").textContent = this.identity.names[1];
        cards.append(button);
      });
      $("upgrade-note").textContent = this.scene.net?.online
        ? "Elijan la misma mejora para continuar."
        : "Una mejora para ambos. Elijan su estrategia.";
      if (focus != null)
        cards.querySelector('[data-upgrade="' + focus + '"]')?.focus({ preventScroll: true });
    }
    onKill(enemy) {
      if (this.levels.repair && this.scene.kills % 4 === 0) this.heal(3 * this.levels.repair);
      if (enemy.kind === "leaker")
        this.puddles.push({ x: enemy.x, y: enemy.y, remaining: 5000, warning: 900 });
      if (enemy.kind === "boss") {
        this.scene.score += 1000;
        this.scene.fx.message(400, 210, "NÚCLEO DESACTIVADO");
      }
      this.track();
    }
    heal(amount) {
      this.scene.players.forEach((p) => {
        if (p.health > 0) p.health = Math.min(100, p.health + amount);
      });
    }
    down(pilot) {
      const index = this.scene.players.indexOf(pilot),
        other = this.scene.players[1 - index];
      if (this.rescue.pilot >= 0 || this.usedRescues[index] || other.health <= 0) {
        this.scene.finishSession(pilot);
        return;
      }
      this.usedRescues[index] = true;
      this.rescue = { pilot: index, remaining: 8000 + this.levels.rescue * 3000, progress: 0 };
      pilot.stop();
      this.scene.fx.message(
        pilot.x,
        clamp(pilot.y - 40, 35, 555),
        "¡ACÉRCATE PARA RESCATAR!",
        "#ffcd94",
      );
      this.announce(
        (index === 0 ? "Ion" : "Flux") +
          " necesita un rescate. Acércate antes de que termine el tiempo.",
      );
    }
    updateRescue(dt) {
      const r = this.rescue;
      if (r.pilot < 0) return;
      const fallen = this.scene.players[r.pilot],
        helper = this.scene.players[1 - r.pilot];
      r.remaining = Math.max(0, r.remaining - dt);
      if (
        helper.health > 0 &&
        this.scene.link.canMove &&
        Math.hypot(helper.x - fallen.x, helper.y - fallen.y) <= 70
      )
        r.progress = Math.min(1600, r.progress + dt);
      else r.progress = Math.max(0, r.progress - dt * 0.6);
      if (r.progress >= 1600) {
        fallen.health = 35 + this.levels.rescue * 15;
        fallen.invulnerable = 1000;
        this.rescues++;
        this.rescue = { pilot: -1, remaining: 0, progress: 0 };
        this.scene.link.previous = null;
        this.scene.fx.burst(fallen.x, fallen.y, this.beamColor, 32);
        this.sound.play("reconnect");
        this.track();
      } else if (r.remaining === 0) this.scene.finishSession(fallen);
    }
    startEvent(kind) {
      if (!["lanes", "switches"].includes(kind)) return;
      this.event = {
        kind,
        remaining: kind === "switches" ? 10000 : 8500,
        warning: 1600,
        progress: 0,
        offset: Math.random() < 0.5 ? 0 : 1,
      };
      this.eventIndex++;
      this.sound.play("wave");
    }
    update(dt) {
      this.updateRescue(dt);
      if (this.scene.ended) return;
      this.puddles = this.puddles.filter((p) => {
        p.remaining -= dt;
        p.warning = Math.max(0, p.warning - dt);
        if (p.warning === 0)
          this.scene.players.forEach((a) => {
            if (Math.hypot(a.x - p.x, a.y - p.y) < 43) a.takeDamage(9);
          });
        return p.remaining > 0;
      });
      const event = this.event;
      if (event.kind !== "none") {
        event.remaining = Math.max(0, event.remaining - dt);
        event.warning = Math.max(0, event.warning - dt);
        if (event.warning === 0 && event.kind === "lanes")
          this.scene.players.forEach((p) => {
            const x = event.offset ? 320 : 480;
            if (Math.abs(p.x - x) < 36) p.takeDamage(12);
          });
        if (event.kind === "switches" && event.warning === 0) {
          const [a, b] = this.scene.players,
            near = (p, x) => p.health > 0 && Math.hypot(p.x - x, p.y - 300) < 40;
          const ready = (near(a, 300) && near(b, 500)) || (near(b, 300) && near(a, 500));
          event.progress = ready
            ? Math.min(1200, event.progress + dt)
            : Math.max(0, event.progress - dt);
          if (event.progress >= 1200) {
            this.heal(15);
            this.scene.score += 300;
            this.scene.fx.message(400, 245, "+15 ENERGÍA · +300 PTS");
            event.remaining = 0;
          }
        }
        if (event.remaining === 0) {
          this.event = { kind: "none", remaining: 0, warning: 0, progress: 0, offset: 0 };
          this.eventClock = 11000;
        }
      } else if (
        this.scene.director.state === "active" &&
        this.scene.director.wave < 6 &&
        this.rescue.pilot < 0
      ) {
        this.eventClock -= dt;
        if (this.eventClock <= 0) this.startEvent(["lanes", "switches"][this.eventIndex % 2]);
      }
      this.track();
    }
    track() {
      if (this.scene.mode !== "survival") return;
      const kills = Math.max(0, this.scene.kills - this.creditedKills),
        wave = this.scene.director.cleared,
        rescues = Math.max(0, this.rescues - this.creditedRescues),
        win = this.scene.won && !this.recordedWin;
      if (!kills && !rescues && wave <= this.creditedWave && !win) return;
      const earned = profile.credit(kills, wave, rescues, win);
      this.creditedKills = this.scene.kills;
      this.creditedRescues = this.rescues;
      this.creditedWave = Math.max(this.creditedWave, wave);
      this.recordedWin ||= win;
      if (earned.length) {
        $("unlock-toast").textContent =
          "NUEVO EN EL TALLER · " + earned.map((c) => c.name).join(" / ");
        this.noticeUntil = performance.now() + 4500;
        this.announce("Has desbloqueado " + earned.map((c) => c.name).join(", "));
      }
    }
    enemyUpdate(enemy, dt) {
      enemy.clock = (enemy.clock + dt) % 9000;
      if (enemy.kind === "boss") {
        const warned = enemy.clock >= 2600 && enemy.clock < 4200,
          firing = enemy.clock >= 4200 && enemy.clock < 4550;
        if (warned) enemy.facing = enemy.clock;
        if (firing)
          this.scene.players.forEach((p) => {
            const dx = p.x - enemy.x,
              dy = p.y - enemy.y,
              length = Math.hypot(dx, dy) || 1;
            if (length < 120 && p.takeDamage(24) && p.health > 0)
              p.shape.body.reset(
                clamp(p.x + (dx / length) * 35, 25, 775),
                clamp(p.y + (dy / length) * 35, 35, 571),
              );
          });
        // Entre pulsos abre el núcleo. El jefe sólo recibe daño del vínculo.
      }
      if (enemy.kind === "splitter" && enemy.clock >= 1900 && enemy.clock < 3100) {
        const [a, b] = this.scene.players,
          dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy) || 1;
        this.scene.players.forEach((p, i) => {
          if (p.health <= 0 || Math.hypot(p.x - enemy.x, p.y - enemy.y) > 115) return;
          const sign = i === 0 ? -1 : 1;
          p.shape.body.reset(
            clamp(p.x + ((sign * dx) / d) * dt * 0.055, 25, 775),
            clamp(p.y + ((sign * dy) / d) * dt * 0.055, 35, 571),
          );
        });
      }
      const living = this.scene.players.filter((p) => p.health > 0);
      const target = living.reduce(
        (a, p) =>
          !a || Math.hypot(p.x - enemy.x, p.y - enemy.y) < Math.hypot(a.x - enemy.x, a.y - enemy.y)
            ? p
            : a,
        null,
      );
      if (target && enemy.kind === "shield")
        enemy.facing = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    }
    enemyDamage(enemy, amount) {
      if (enemy.kind === "boss" && enemy.clock < 4550) return amount * 0.08;
      if (enemy.kind === "shield") {
        const [a, b] = this.scene.players,
          dx = b.x - a.x,
          dy = b.y - a.y,
          length = Math.hypot(dx, dy) || 1;
        // Un rayo perpendicular al frente pasa por el costado; el frontal queda bloqueado.
        const alignment = Math.abs(
          (dx / length) * Math.cos(enemy.facing) + (dy / length) * Math.sin(enemy.facing),
        );
        if (alignment > 0.65) return amount * 0.08;
      }
      return amount;
    }
    enemyDraw(enemy) {
      const g = enemy.visual,
        x = enemy.x,
        y = enemy.y;
      if (enemy.kind === "shield") {
        g.lineStyle(4, 0x82e9ff, 0.85);
        g.beginPath();
        g.arc(x, y, 25, enemy.facing - 0.9, enemy.facing + 0.9);
        g.strokePath();
      } else if (enemy.kind === "splitter")
        g.lineStyle(1.5, 0xff92cf, 0.55).strokeCircle(
          x,
          y,
          enemy.clock >= 1900 && enemy.clock < 3100 ? 48 : 26,
        );
      else if (enemy.kind === "leaker") g.lineStyle(1.5, 0x83ffaf, 0.55).strokeCircle(x, y, 23);
      else if (enemy.kind === "boss") {
        const open = enemy.clock >= 4550;
        g.lineStyle(3, open ? this.beamColor : 0xff6d85, 0.8).strokeCircle(x, y, 52);
        if (enemy.clock >= 2600 && enemy.clock < 4550)
          g.lineStyle(2, 0xff7e83, 0.85).strokeCircle(x, y, 120);
        if (enemy.clock >= 4200 && enemy.clock < 4550)
          g.fillStyle(0xff5268, 0.25).fillCircle(x, y, 120);
      }
    }
    draw() {
      const g = this.floor,
        o = this.ornaments;
      g.clear();
      o.clear();
      if (this.scene.mode !== "survival") {
        $("event-status").hidden = true;
        $("rescue-status").hidden = true;
        $("boss-status").hidden = true;
      }
      const e = this.event;
      if (this.scene.mode === "survival" && e.kind === "lanes") {
        const x = e.offset ? 320 : 480;
        g.fillStyle(0xff5268, e.warning > 0 ? 0.09 : 0.2).fillRect(x - 36, 20, 72, 566);
        g.lineStyle(2, 0xff9395, 0.8)
          .lineBetween(x - 36, 25, x - 36, 575)
          .lineBetween(x + 36, 25, x + 36, 575);
        for (let y = 40; y < 580; y += 32)
          g.lineStyle(1, 0xff788c, 0.45).lineBetween(x - 28, y, x + 28, y + 18);
      }
      if (this.scene.mode === "survival" && e.kind === "switches")
        for (const x of [300, 500]) {
          g.lineStyle(2, this.beamColor, 0.8).strokeCircle(x, 300, 38);
          g.fillStyle(this.beamColor, 0.1 + (e.progress / 1200) * 0.15).fillCircle(x, 300, 34);
          g.lineStyle(2, this.beamColor, 0.6)
            .lineBetween(x - 8, 300, x + 8, 300)
            .lineBetween(x, 292, x, 308);
        }

      for (const p of this.puddles) {
        g.fillStyle(0x69ee9b, p.warning > 0 ? 0.1 : 0.23).fillCircle(p.x, p.y, 43);
        g.lineStyle(1, 0x89ffb3, 0.6).strokeCircle(p.x, p.y, 43);
      }
      this.scene.players.forEach((p, i) => {
        const outfit = this.outfits[i],
          paint = findCosmetic("paint", outfit.paint);

        if (p.paintApplied !== paint.id) {
          if (paint.hue != null && p.sprite.preFX) p.paintFX ||= p.sprite.preFX.addColorMatrix();
          if (p.paintFX) {
            p.paintFX.active = paint.hue != null;
            p.paintFX.hue(paint.hue == null ? 0 : paint.hue - (i === 0 ? 210 : 330));
          }
          p.paintApplied = paint.id;
        }
        if (p.health > 0 && this.scene.link.state !== "stunned") {
          if (paint.hue == null || p.paintFX) p.sprite.clearTint();
          else p.sprite.setTint(parseInt(paint.color.slice(1), 16));
        }
        p.halo.setTint(paint.hue == null ? p.color : parseInt(paint.color.slice(1), 16));
        if (outfit.accessory === "ring")
          o.lineStyle(1.5, p.color, 0.9).strokeEllipse(p.x, Math.max(6, p.y - 31), 32, 9);
        if (outfit.accessory === "satellite") {
          const angle = this.preferences.reducedMotion ? 0 : this.scene.visualTime / 900;
          const x = clamp(p.x + Math.cos(angle) * 29, 7, 793),
            y = clamp(p.y - 8 + Math.sin(angle) * 12, 7, 593);
          o.fillStyle(0xbdefff).fillCircle(x, y, 3);
          o.lineStyle(1, 0x82d9ff, 0.5).strokeCircle(x, y, 6);
        }
        if (outfit.accessory === "crown") {
          const crownY = Math.max(46, p.y);
          o.lineStyle(2, 0xffdc82, 0.95);
          o.beginPath();
          o.moveTo(p.x - 10, crownY - 30);
          o.lineTo(p.x - 13, crownY - 39);
          o.lineTo(p.x - 5, crownY - 35);
          o.lineTo(p.x, crownY - 44);
          o.lineTo(p.x + 5, crownY - 35);
          o.lineTo(p.x + 13, crownY - 39);
          o.lineTo(p.x + 10, crownY - 30);
          o.closePath();
          o.strokePath();
        }
        if (p.health <= 0) {
          o.lineStyle(2, 0xffd08c, 0.85).strokeCircle(p.x, p.y, 28);
          o.fillStyle(0xffd08c).fillCircle(p.x, p.y - 6, 4);
        }
      });

      const build = upgrades
        .filter((u) => this.levels[u.id] > 0)
        .map((u) => u.name + " " + (this.levels[u.id] === 2 ? "II" : "I"))
        .join(" · ");
      if ($("run-build").textContent !== build) $("run-build").textContent = build;
      $("run-build").hidden = !build;
      const active = this.scene.mode === "survival";
      $("event-status").hidden = !active || e.kind === "none";
      if (e.kind !== "none")
        $("event-status").textContent =
          {
            lanes:
              e.warning > 0
                ? "DESCARGA ENTRANTE · SALGAN DE LA FRANJA"
                : "FRANJA ELÉCTRICA · ESQUÍVENLA",
            switches: "BONUS · UN PILOTO EN CADA ANILLO",
          }[e.kind] +
          " · " +
          Math.ceil(e.remaining / 1000) +
          " s";
      const r = this.rescue;
      $("rescue-status").hidden = !active || r.pilot < 0;
      if (r.pilot >= 0) {
        $("rescue-label").textContent =
          "RESCATA A " +
          this.identity.names[r.pilot] +
          " · " +
          (r.remaining / 1000).toFixed(1) +
          " s";
        $("rescue-fill").style.width = (r.progress / 1600) * 100 + "%";
      }
      const boss = this.scene.targets.find((t) => t.kind === "boss" && !t.dead);
      $("boss-status").hidden = !active || !boss;
      if (boss) {
        $("boss-label").textContent =
          "EL DESCONECTOR · " + (boss.clock >= 4550 ? "NÚCLEO ABIERTO" : "ESCUDO ACTIVO");
        $("boss-fill").style.width = (boss.health / boss.maxHealth) * 100 + "%";
      }
      $("unlock-toast").hidden = performance.now() > this.noticeUntil;
      $("ion-health").textContent =
        this.scene.players[0].health <= 0
          ? "CHISPA CAÍDA"
          : this.scene.players[0].health + " / 100";
      $("flux-health").textContent =
        this.scene.players[1].health <= 0
          ? "CHISPA CAÍDA"
          : this.scene.players[1].health + " / 100";
    }
    openWorkshop(from) {
      this.workshopReturn = from;
      this.workshopPilot = this.scene.net?.isGuest() ? 1 : 0;
      this.scene.ui.show("workshop");
      this.renderWorkshop();
    }
    renderWorkshop() {
      const index = this.workshopPilot,
        outfit = profile.outfits[index],
        paint = findCosmetic("paint", outfit.paint);
      $("workshop-preview").setAttribute(
        "viewBox",
        index === 0 ? "18 64 378 488" : "427 64 379 488",
      );
      $("workshop-preview").style.filter =
        paint.hue == null
          ? "none"
          : "hue-rotate(" + (paint.hue - (index === 0 ? 210 : 330)) + "deg)";
      $("workshop-pilot-name").textContent = profile.names[index];
      $("workshop-avatar").dataset.accessory = outfit.accessory;
      $("workshop-beam").style.backgroundColor = findCosmetic("beam", outfit.beam).color;
      document.querySelectorAll("[data-pilot]").forEach((b) => {
        b.setAttribute("aria-pressed", String(Number(b.dataset.pilot) === index));
        b.disabled =
          this.scene.net?.online && Number(b.dataset.pilot) !== (this.scene.net.isGuest() ? 1 : 0);
      });
      document
        .querySelectorAll("[data-custom-tab]")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.customTab === this.workshopCategory)),
        );
      const list = $("cosmetic-list");
      list.replaceChildren();
      for (const item of cosmetics[this.workshopCategory]) {
        const unlocked = profile.unlocked(item),
          equipped = outfit[this.workshopCategory] === item.id,
          b = document.createElement("button");
        b.className = "cosmetic-item";
        b.dataset.cosmetic = item.id;
        b.disabled = !unlocked;
        b.setAttribute("aria-pressed", String(equipped));
        b.innerHTML =
          '<i style="background:' +
          item.color +
          '"></i><span><strong>' +
          item.name +
          "</strong><small>" +
          (unlocked
            ? equipped
              ? "EQUIPADO"
              : "Disponible"
            : item.goal +
              " · " +
              Math.min(profile.stats[item.metric], item.need) +
              " / " +
              item.need) +
          "</small></span><b>" +
          (equipped ? "✓" : unlocked ? "+" : "◇") +
          "</b>";
        list.append(b);
      }
      $("workshop-summary").textContent =
        profile.stats.kills +
        " CORTES · OLEADA " +
        profile.stats.bestWave +
        " · " +
        profile.stats.rescues +
        " RESCATES";
    }
    snapshot() {
      return {
        id: this.id,
        identity: { duo: this.identity.duo, names: [...this.identity.names] },
        levels: { ...this.levels },
        offer: [...this.offer],
        votes: [...this.votes],
        draftWave: this.draftWave,
        rescue: { ...this.rescue },
        usedRescues: [...this.usedRescues],
        rescues: this.rescues,
        event: { ...this.event },
        puddles: this.puddles.map((p) => ({ ...p })),
        outfits: this.outfits.map((o) => ({ ...o })),
        won: this.scene.won,
      };
    }
    accept(data) {
      const prior = JSON.stringify([this.offer, this.votes]);
      Object.assign(this, {
        id: data.id,
        identity: data.identity,
        levels: data.levels,
        offer: data.offer,
        votes: data.votes,
        draftWave: data.draftWave,
        rescue: data.rescue,
        usedRescues: data.usedRescues,
        rescues: data.rescues,
        event: data.event,
        puddles: data.puddles,
        outfits: data.outfits,
      });
      this.scene.won = data.won;
      if (prior !== JSON.stringify([this.offer, this.votes])) this.renderOffer();
      this.track();
    }
  }
  function validRun(r) {
    const finite = (v, a, b) => typeof v === "number" && Number.isFinite(v) && v >= a && v <= b;
    if (
      !r ||
      !window.VoltLeague.uuidPattern.test(r.id) ||
      !window.VoltLeague.validIdentity(r.identity) ||
      !r.levels ||
      !upgrades.every((u) => Number.isInteger(r.levels[u.id]) && finite(r.levels[u.id], 0, u.max))
    )
      return false;
    if (
      !Array.isArray(r.offer) ||
      r.offer.length > 3 ||
      !r.offer.every((id) => upgrades.some((u) => u.id === id)) ||
      new Set(r.offer).size !== r.offer.length
    )
      return false;
    if (
      !Array.isArray(r.votes) ||
      r.votes.length !== 2 ||
      !r.votes.every((n) => Number.isInteger(n) && finite(n, -1, r.offer.length - 1))
    )
      return false;
    if (
      !Number.isInteger(r.draftWave) ||
      !finite(r.draftWave, 0, 6) ||
      !Number.isInteger(r.rescues) ||
      !finite(r.rescues, 0, 2)
    )
      return false;
    if (
      !r.rescue ||
      !Number.isInteger(r.rescue.pilot) ||
      !finite(r.rescue.pilot, -1, 1) ||
      !finite(r.rescue.remaining, 0, 11000) ||
      !finite(r.rescue.progress, 0, 1600)
    )
      return false;
    if (
      !Array.isArray(r.usedRescues) ||
      r.usedRescues.length !== 2 ||
      !r.usedRescues.every((v) => typeof v === "boolean")
    )
      return false;
    if (
      !r.event ||
      !["none", "lanes", "switches"].includes(r.event.kind) ||
      !finite(r.event.remaining, 0, 10000) ||
      !finite(r.event.warning, 0, 1600) ||
      !finite(r.event.progress, 0, 1200) ||
      ![0, 1].includes(r.event.offset)
    )
      return false;
    if (
      !Array.isArray(r.puddles) ||
      r.puddles.length > 28 ||
      !r.puddles.every(
        (p) =>
          p &&
          finite(p.x, 0, 800) &&
          finite(p.y, 0, 600) &&
          finite(p.remaining, 0, 5000) &&
          finite(p.warning, 0, 900),
      )
    )
      return false;
    return (
      Array.isArray(r.outfits) &&
      r.outfits.length === 2 &&
      r.outfits.every(validOutfit) &&
      typeof r.won === "boolean"
    );
  }
  window.VoltExpedition = Object.freeze({
    RunSystems,
    profile,
    cosmetics,
    upgrades,
    validRun,
    validOutfit,
    defaultOutfit,
  });
})();
