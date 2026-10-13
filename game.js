/* Volt-Mates / Dúos 7. Script clásico compatible con file://.
 * Módulos: geometría, preferencias, audio, jugadores, vínculo, drones, efectos,
 * arena, pantallas y sesiones PeerJS. El anfitrión mantiene la autoridad de la simulación.
 */
(() => {
  "use strict";
  const SETTINGS = Object.freeze({
    width: 800,
    height: 600,
    playerSpeed: 220,
    maxDistance: 300,
    reconnectDistance: 270,
    overloadMs: 1000,
    stunMs: 2000,
    beamDamagePerSecond: 120,
    targetHealth: 80,
    playerHealth: 100,
    hitImmunityMs: 1000,
    comboMs: 2500,
    spawnWarningMs: 900,
    waveRestMs: 4000,
    waveHeal: 8,
    blue: 0x4e99ff,
    pink: 0xff639f,
    beam: 0xc7ff73,
    danger: 0xff5268,
  });
  const byId = (id) => document.getElementById(id);
  const announce = (text) => {
    byId("announcement").textContent = text;
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  /** Liang–Barsky: segmento contra hitbox rectangular. Incluye extremos,
   * tangencias, líneas verticales y segmentos degenerados de longitud cero. */
  function segmentIntersectsRect(a, b, rect) {
    const dx = b.x - a.x,
      dy = b.y - a.y;
    let enter = 0,
      exit = 1;
    for (const [p, q] of [
      [-dx, a.x - rect.x],
      [dx, rect.x + rect.width - a.x],
      [-dy, a.y - rect.y],
      [dy, rect.y + rect.height - a.y],
    ]) {
      if (Math.abs(p) < 1e-9) {
        if (q < 0) return false;
        continue;
      }
      const t = q / p;
      if (p < 0) enter = Math.max(enter, t);
      else exit = Math.min(exit, t);
      if (enter > exit) return false;
    }
    return true;
  }

  class Preferences {
    constructor() {
      this.sound = true;
      this.music = true;
      this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      try {
        const saved = JSON.parse(localStorage.getItem("volt-mates.preferences.v2") || "null");
        if (typeof saved?.sound === "boolean") this.sound = saved.sound;
        if (typeof saved?.music === "boolean") this.music = saved.music;
        if (typeof saved?.reducedMotion === "boolean") this.reducedMotion = saved.reducedMotion;
      } catch {
        /* file:// o modo privado pueden limitar localStorage. */
      }
      this.apply();
    }
    apply() {
      document.body.classList.toggle("reduced-motion", this.reducedMotion);
      document.body.classList.toggle("full-motion", !this.reducedMotion);
      byId("audio-value").textContent = this.sound ? "ACTIVOS" : "SILENCIADOS";
      byId("music-value").textContent = this.music ? "ACTIVA" : "SILENCIADA";
      byId("motion-value").textContent = this.reducedMotion ? "REDUCIDO" : "COMPLETO";
      byId("sound-button").textContent = this.sound ? "♪" : "×♪";
      byId("sound-button").setAttribute(
        "aria-label",
        this.sound ? "Silenciar sonido" : "Activar sonido",
      );
      byId("sound-button").setAttribute("aria-pressed", String(this.sound));
      try {
        localStorage.setItem(
          "volt-mates.preferences.v2",
          JSON.stringify({
            sound: this.sound,
            music: this.music,
            reducedMotion: this.reducedMotion,
          }),
        );
      } catch {
        /* Se guardan en memoria. */
      }
    }
  }
  const preferences = new Preferences();
  // Banda sonora original y efectos Web Audio. Sólo se activan tras un gesto.
  class SoundSystem {
    constructor() {
      this.context = null;
      this.suspended = false;
      this.musicMode = "menu";
      this.musicLoading = null;
      this.musicSource = null;
      this.musicGain = null;
      this.musicFilter = null;
    }
    unlock() {
      if (!preferences.sound) return;
      try {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        this.context ||= new Context();
        this.context.resume().catch(() => {});
        this.startMusic();
      } catch {
        /* Sin audio, todas las mecánicas siguen disponibles. */
      }
    }
    startMusic() {
      if (this.musicLoading || !window.VOLT_ASSETS?.music) return;
      const bytes = Uint8Array.from(atob(window.VOLT_ASSETS.music.split(",")[1]), (c) =>
        c.charCodeAt(0),
      );
      this.musicLoading = this.context
        .decodeAudioData(bytes.buffer)
        .then((buffer) => {
          if (this.context.state === "closed") return;
          this.musicSource = this.context.createBufferSource();
          this.musicSource.buffer = buffer;
          this.musicSource.loop = true;
          this.musicFilter = this.context.createBiquadFilter();
          this.musicFilter.type = "lowpass";
          this.musicGain = this.context.createGain();
          this.musicGain.gain.value = 0;
          this.musicSource.connect(this.musicFilter);
          this.musicFilter.connect(this.musicGain);
          this.musicGain.connect(this.context.destination);
          this.musicSource.start();
          this.updateMix();
        })
        .catch(() => {
          /* Los efectos siguen funcionando si falla la pista. */
        });
    }
    setScene(state) {
      this.musicMode = state;
      this.updateMix();
    }
    updateMix() {
      if (!this.musicGain) return;
      const playing = ["playing", "deploy"].includes(this.musicMode);
      const paused = ["paused", "disconnected", "boot"].includes(this.musicMode);
      const volume =
        preferences.sound && preferences.music && !document.hidden
          ? paused
            ? 0.06
            : playing
              ? 0.42
              : 0.22
          : 0;
      const now = this.context.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(volume, now + 0.25);
      this.musicFilter.frequency.setTargetAtTime(
        playing ? 6500 : 1300,
        this.context.currentTime,
        0.2,
      );
    }
    destroy() {
      this.musicSource?.stop();
      this.musicSource?.disconnect();
      this.musicFilter?.disconnect();
      this.musicGain?.disconnect();
      this.context?.close().catch(() => {});
    }
    play(kind = "select") {
      if (!preferences.sound || this.suspended || !this.context || this.context.state !== "running")
        return;
      const notes = {
        select: [620, 820, 0.07, "sine"],
        enter: [220, 880, 0.35, "sine"],
        cut: [950, 150, 0.22, "triangle"],
        snap: [120, 35, 0.4, "sawtooth"],
        reconnect: [300, 1100, 0.3, "sine"],
        tick: [500, 650, 0.07, "sine"],
        hit: [180, 65, 0.16, "triangle"],
        wave: [180, 480, 0.4, "triangle"],
        defeat: [300, 45, 0.8, "sine"],
      };
      const [from, to, duration, type] = notes[kind] || notes.select,
        now = this.context.currentTime;
      const oscillator = this.context.createOscillator(),
        gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
  }
  const sound = new SoundSystem();
  function showError(message) {
    document.querySelectorAll(".screen").forEach((s) => {
      s.hidden = true;
    });
    byId("hud").hidden = true;
    byId("system-controls").hidden = true;
    byId("error-screen").hidden = false;
    if (message) byId("error-message").textContent = message;
    byId("reload-button").focus({ preventScroll: true });
  }
  byId("reload-button").addEventListener("click", () => location.reload());
  if (!window.Phaser || !window.VoltExpedition || !window.VoltLeague) {
    showError(
      !window.VoltExpedition
        ? "Falta expedition.js. Conserva todos los archivos juntos."
        : undefined,
    );
    return;
  }

  class LocalPlayer {
    constructor(scene, { x, y, color, name, keys }) {
      this.scene = scene;
      this.spawn = { x, y };
      this.color = color;
      this.trailClock = 0;
      this.health = SETTINGS.playerHealth;
      this.invulnerable = 0;
      this.keys = scene.input.keyboard.addKeys(keys);
      this.direction = new Phaser.Math.Vector2();
      this.shadow = scene.add.ellipse(x + 4, y + 10, 42, 17, 0x000000, 0.45).setDepth(8);
      this.halo = scene.add
        .image(x, y, "glow")
        .setTint(color)
        .setDisplaySize(110, 110)
        .setAlpha(0.32)
        .setDepth(7);
      this.shape = scene.add
        .rectangle(x, y, 30, 30, color)
        .setStrokeStyle(1, 0xe4f6ff, 0.8)
        .setDepth(10);
      scene.physics.add.existing(this.shape);
      this.shape.body.setCollideWorldBounds(true).setAllowGravity(false);
      // Margen visual: antenas y pies permanecen dentro de la arena.
      this.shape.body.setBoundsRectangle(new Phaser.Geom.Rectangle(10, 20, 780, 566));
      // La hitbox sigue siendo independiente del arte y del escalado HiDPI.
      this.sprite = scene.add
        .image(x, y, "pilots", color === SETTINGS.blue ? "ion" : "flux")
        .setDisplaySize(42, 54)
        .setDepth(11);
      this.shape.setVisible(false);
      this.label = scene.add
        .text(x, y + 30, name, {
          resolution: 3,
          fontFamily: "Consolas, monospace",
          fontSize: "8px",
          color: color === SETTINGS.blue ? "#84bbff" : "#ff9bc4",
          letterSpacing: 1,
        })
        .setOrigin(0.5)
        .setDepth(12);
      this.label.setText(color === SETTINGS.blue ? "ION" : "FLUX");
    }
    get x() {
      return this.shape.x;
    }
    get y() {
      return this.shape.y;
    }
    moveFromBits(bits, allowed) {
      if (!allowed || this.health <= 0) {
        this.stop();
        return;
      }
      this.direction.set(
        Number(!!(bits & 8)) - Number(!!(bits & 4)),
        Number(!!(bits & 2)) - Number(!!(bits & 1)),
      );
      this.direction.normalize().scale(this.scene.run?.speed || SETTINGS.playerSpeed);
      this.shape.body.setVelocity(this.direction.x, this.direction.y);
    }
    move(allowed) {
      if (!allowed || this.health <= 0) {
        this.stop();
        return;
      }
      const { left, right, up, down } = this.keys;
      this.direction.set(
        Number(right.isDown) - Number(left.isDown),
        Number(down.isDown) - Number(up.isDown),
      );
      this.direction.normalize().scale(this.scene.run?.speed || SETTINGS.playerSpeed); // Diagonales sin ventaja.
      this.shape.body.setVelocity(this.direction.x, this.direction.y);
    }
    stop() {
      this.shape.body.setVelocity(0, 0);
    }
    reset() {
      this.health = SETTINGS.playerHealth;
      this.invulnerable = 0;
      this.shape.body.reset(this.spawn.x, this.spawn.y);
      this.stop();
      this.trailClock = 0;
      this.syncVisuals(0, 0, false);
    }
    takeDamage(amount) {
      if (
        this.scene.mode !== "survival" ||
        !this.scene.activeSession ||
        this.scene.ended ||
        this.invulnerable > 0 ||
        this.health <= 0
      )
        return false;
      this.health = Math.max(0, this.health - amount);
      this.invulnerable = SETTINGS.hitImmunityMs;
      this.scene.chain = 0;
      this.scene.multiplier = 1;
      this.scene.comboRemaining = 0;
      this.scene.fx.burst(this.x, this.y, SETTINGS.danger, 14);
      this.scene.fx.message(
        this.x,
        clamp(this.y - 35, 35, 555),
        "-" + amount + " ENERGÍA",
        "#ff748b",
      );
      if (!preferences.reducedMotion) this.scene.cameras.main.shake(90, 0.003);
      sound.play("hit");
      if (!this.health) this.scene.run.down(this);
      return true;
    }
    syncVisuals(time, dt, stunned) {
      this.shadow.setPosition(this.x + 4, this.y + 10);
      this.halo.setPosition(this.x, this.y).setAlpha(stunned ? 0.12 : 0.32);
      this.label.setPosition(
        clamp(this.x, this.label.width / 2 + 8, 792 - this.label.width / 2),
        this.y > 555 ? this.y - 29 : this.y + 30,
      );
      this.shape.setAlpha(
        (stunned || this.invulnerable > 0) && !preferences.reducedMotion
          ? 0.6 + Math.sin(time / 90) * 0.2
          : 1,
      );
      const bob = preferences.reducedMotion
        ? 0
        : Math.sin(time / 170) * (this.shape.body.speed > 0 ? 1.7 : 0.6);
      this.sprite.setPosition(this.x, this.y - 4 + bob).setAlpha(this.shape.alpha);
      this.sprite.setRotation(
        preferences.reducedMotion ? 0 : (this.direction.x / SETTINGS.playerSpeed) * 0.07,
      );
      if (stunned || !this.health) this.sprite.setTint(0x89919d);
      else this.sprite.clearTint();
      this.trailClock += dt;
      if (
        this.scene.activeSession &&
        !stunned &&
        this.shape.body.speed > 0 &&
        this.trailClock >= 40
      ) {
        this.scene.fx.spark(this.x, this.y, this.color, 0, 0, 300, 3);
        this.trailClock = 0;
      }
    }
  }

  // Máquina de estados. El dibujado no controla daño, movimiento ni tiempos.
  class EnergyLink {
    constructor(scene) {
      this.scene = scene;
      this.reset();
    }
    reset() {
      this.state = "stable";
      this.overload = 0;
      this.remaining = 0;
      this.distance = 0;
      this.previous = null;
    }
    get conducting() {
      return this.state === "stable" || this.state === "strained";
    }
    get canMove() {
      return this.state !== "stunned";
    }
    endpoints() {
      return this.scene.players.map((p) => ({ x: p.x, y: p.y }));
    }
    update(dt) {
      const [a, b] = this.endpoints();
      this.distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (this.state === "stunned") {
        this.remaining = Math.max(0, this.remaining - dt);
        if (this.remaining === 0) this.state = "disconnected";
      }
      if (this.state === "disconnected") {
        if (this.distance <= (this.scene.run?.reconnectDistance || SETTINGS.reconnectDistance)) {
          this.state = "stable";
          this.overload = 0;
          this.scene.onReconnect();
        }
        return;
      }
      if (this.state === "stunned") return;
      if (this.distance > (this.scene.run?.maxDistance || SETTINGS.maxDistance)) {
        this.state = "strained";
        this.overload += dt;
        if (this.overload >= SETTINGS.overloadMs) {
          this.state = "stunned";
          this.remaining = this.scene.run?.stunMs || SETTINGS.stunMs;
          this.overload = 0;
          this.scene.players.forEach((p) => p.stop());
          this.scene.onBreak();
        }
      } else {
        this.state = "stable";
        this.overload = 0;
      }
    }
    hits(rect) {
      if (!this.conducting) return false;
      const current = this.endpoints();
      if (segmentIntersectsRect(current[0], current[1], rect)) return true;
      if (!this.previous) return false;
      // Barrido muestreado cada ≤4 px; una sola aplicación de daño por frame.
      const travel = Math.max(
        ...current.map((p, i) => Math.hypot(p.x - this.previous[i].x, p.y - this.previous[i].y)),
      );
      const steps = Math.max(1, Math.ceil(travel / 4));
      for (let i = 0; i < steps; i++) {
        const t = i / steps,
          points = current.map((p, j) => ({
            x: this.previous[j].x + (p.x - this.previous[j].x) * t,
            y: this.previous[j].y + (p.y - this.previous[j].y) * t,
          }));
        if (segmentIntersectsRect(points[0], points[1], rect)) return true;
      }
      return false;
    }
    saveEndpoints() {
      this.previous = this.endpoints();
    }
  }

  class Effects {
    constructor(scene) {
      this.scene = scene;
      this.graphics = scene.add.graphics().setDepth(15);
      this.particles = [];
      this.messages = [];
    }
    spark(x, y, color, vx, vy, life = 450, size = 2) {
      if (preferences.reducedMotion || this.particles.length >= 160) return;
      this.particles.push({ x, y, color, vx, vy, life, total: life, size });
    }
    burst(x, y, color, count = 25) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2,
          s = 35 + Math.random() * 170;
        this.spark(
          x,
          y,
          color,
          Math.cos(a) * s,
          Math.sin(a) * s,
          300 + Math.random() * 400,
          1 + Math.random() * 2,
        );
      }
    }
    message(x, y, text, color = "#c7ff73") {
      const label = this.scene.add
        .text(x, y, text, {
          resolution: 3,
          fontFamily: "Consolas, monospace",
          fontSize: "10px",
          color,
          letterSpacing: 1,
          backgroundColor: "#091725",
        })
        .setPadding(7)
        .setOrigin(0.5)
        .setDepth(20);
      if (this.messages.length >= 24) this.messages.shift().label.destroy();
      this.messages.push({ label, remaining: 1400, y });
    }
    reset() {
      this.particles = [];
      this.messages.forEach((m) => m.label.destroy());
      this.messages = [];
      this.graphics.clear();
    }
    update(dt) {
      this.graphics.clear();
      if (preferences.reducedMotion) this.particles = [];
      this.particles = this.particles.filter((p) => {
        p.life -= dt;
        if (p.life <= 0) return false;
        p.x += (p.vx * dt) / 1000;
        p.y += (p.vy * dt) / 1000;
        this.graphics.fillStyle(p.color, p.life / p.total).fillRect(p.x, p.y, p.size, p.size);
        return true;
      });
      this.messages = this.messages.filter((m) => {
        m.remaining -= dt;
        if (m.remaining <= 0) {
          m.label.destroy();
          return false;
        }
        m.label.setAlpha(Math.min(1, m.remaining / 350));
        if (!preferences.reducedMotion) m.label.y = m.y - (1400 - m.remaining) / 70;
        return true;
      });
    }
  }

  // Drones inmóviles para el modo de calibración, sin oleadas ni daño a los pilotos.
  class TrainingDrone {
    constructor(scene, x, y, index) {
      this.scene = scene;
      this.x = x;
      this.y = y;
      this.index = index;
      this.maxHealth = SETTINGS.targetHealth;
      this.health = this.maxHealth;
      this.dead = false;
      this.contact = false;
      this.hitbox = { x: x - 17, y: y - 17, width: 34, height: 34 };
      this.visual = scene.add.graphics().setDepth(9);
      this.sprite = scene.add.image(x, y, "pilots", "hunter").setDisplaySize(44, 44).setDepth(9);
      this.label = scene.add
        .text(x, y + 36, "DRON / 0" + index, {
          resolution: 3,
          fontFamily: "Consolas, monospace",
          fontSize: "8px",
          color: "#8c7d90",
        })
        .setOrigin(0.5)
        .setDepth(9);
      this.draw(0);
    }
    applyDamage(amount) {
      if (this.dead || amount <= 0) return;
      this.health = Math.max(0, this.health - amount);
      if (this.health <= 0) {
        this.dead = true;
        this.visual.clear();
        this.sprite.setVisible(false);
        this.label.setVisible(false);
        this.scene.fx.burst(this.x, this.y, 0xff9176, 40);
        if (this.scene.mode === "training")
          this.scene.fx.message(this.x, this.y - 30, "¡CORTE!", "#ffb69a");
        sound.play("cut");
        this.scene.onDroneDestroyed(this);
      }
    }
    draw(time) {
      this.drawBody(time, 44, 0xee876f, true);
    }
    drawBody(time, size, color, showHealth) {
      const g = this.visual;
      g.clear();
      this.sprite.setVisible(!this.dead);
      if (this.dead) return;
      const bob = preferences.reducedMotion ? 0 : Math.sin(time / 390 + this.index) * 1.3;
      this.sprite.setPosition(this.x, this.y - 3 + bob);
      g.fillStyle(0x000000, 0.4).fillEllipse(this.x + 2, this.y + size * 0.3, size, size * 0.26);
      if (this.contact) {
        this.sprite.setTint(0xe5ffd0);
        g.lineStyle(1.5, SETTINGS.beam, 0.65).strokeCircle(this.x, this.y, size * 0.58);
      } else this.sprite.clearTint();
      if (showHealth) {
        const width = size * 0.75,
          y = this.y + size * 0.6;
        g.lineStyle(3, 0x06101b, 0.9).lineBetween(this.x - width / 2, y, this.x + width / 2, y);
        g.lineStyle(3, color).lineBetween(
          this.x - width / 2,
          y,
          this.x - width / 2 + (width * this.health) / this.maxHealth,
          y,
        );
      }
    }
    destroy() {
      this.visual.destroy();
      this.sprite.destroy();
      this.label.destroy();
    }
  }

  const ENEMY_TYPES = Object.freeze({
    hunter: {
      name: "RASTREADOR",
      health: 32,
      speed: 58,
      damage: 18,
      points: 75,
      size: 30,
      color: 0xf28b75,
    },
    runner: {
      name: "IMPULSOR",
      health: 26,
      speed: 103,
      damage: 15,
      points: 100,
      size: 26,
      color: 0xffce76,
    },
    tank: {
      name: "BASTIÓN",
      health: 110,
      speed: 36,
      damage: 25,
      points: 200,
      size: 44,
      color: 0xc594ff,
    },

    shield: {
      name: "GUARDIÁN",
      health: 70,
      speed: 45,
      damage: 17,
      points: 130,
      size: 34,
      color: 0x83eaff,
      frame: "tank",
    },
    splitter: {
      name: "SEPARADOR",
      health: 48,
      speed: 51,
      damage: 15,
      points: 150,
      size: 32,
      color: 0xff92ce,
      frame: "runner",
    },
    leaker: {
      name: "FUGA",
      health: 38,
      speed: 52,
      damage: 14,
      points: 120,
      size: 30,
      color: 0x8affae,
      frame: "hunter",
    },
    boss: {
      name: "EL DESCONECTOR",
      health: 520,
      speed: 24,
      damage: 24,
      points: 900,
      size: 76,
      color: 0xff728e,
      frame: "tank",
    },
  });

  // El punto de aparición se elige lejos de ambos pilotos y se anuncia antes de activarse.
  function chooseSpawnPoint(players, enemies = [], random = Math.random) {
    let best = { x: 36, y: 36 },
      bestDistance = -1;
    for (let i = 0; i < 32; i++) {
      const side = Math.floor(random() * 4),
        offset = random();
      const point =
        side === 0
          ? { x: 36 + offset * 728, y: 36 }
          : side === 1
            ? { x: 764, y: 36 + offset * 528 }
            : side === 2
              ? { x: 36 + offset * 728, y: 564 }
              : { x: 36, y: 36 + offset * 528 };
      const distance = Math.min(...players.map((p) => Math.hypot(p.x - point.x, p.y - point.y)));
      if (distance > bestDistance) {
        best = point;
        bestDistance = distance;
      }
      if (
        distance >= 145 &&
        enemies.every((e) => e.dead || Math.hypot(e.x - point.x, e.y - point.y) >= 45)
      )
        return point;
    }
    return best;
  }

  // Entidades móviles con hitbox rectangular: sólo EnergyLink puede quitarles salud.
  class ArenaEnemy extends TrainingDrone {
    constructor(scene, x, y, kind, wave, id) {
      super(scene, x, y, id);
      this.kind = kind;
      this.clock = 0;
      this.facing = 0;
      this.type = ENEMY_TYPES[kind];
      this.radius = this.type.size / 2;
      this.maxHealth = this.type.health + Math.min(48, Math.max(0, wave - 1) * 3);
      this.health = this.maxHealth;
      this.speed = this.type.speed + Math.min(36, Math.max(0, wave - 1) * 3);
      this.hitbox = {
        x: x - this.radius,
        y: y - this.radius,
        width: this.type.size,
        height: this.type.size,
      };
      this.label.setVisible(false);
      this.previousPosition = { x, y };
      this.draw(0);
    }
    applyDamage(amount) {
      super.applyDamage(this.scene.run.enemyDamage(this, amount));
    }
    syncHitbox() {
      this.hitbox.x = this.x - this.radius;
      this.hitbox.y = this.y - this.radius;
    }
    update(dt) {
      if (this.dead) return;
      this.scene.run.enemyUpdate(this, dt);
      this.previousPosition = { x: this.x, y: this.y };
      const players = this.scene.players.filter((p) => p.health > 0);
      if (!players.length) return;
      const target = players.reduce((nearest, p) =>
        Math.hypot(p.x - this.x, p.y - this.y) < Math.hypot(nearest.x - this.x, nearest.y - this.y)
          ? p
          : nearest,
      );
      let dx = target.x - this.x,
        dy = target.y - this.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.001) {
        dx /= distance;
        dy /= distance;
      } else {
        dx = 0;
        dy = 0;
      }
      // Separación suave y acotada: no se acumulan todos en un mismo píxel.
      let sx = 0,
        sy = 0;
      for (const other of this.scene.targets) {
        if (other === this || other.dead) continue;
        const ox = this.x - other.x,
          oy = this.y - other.y,
          gap = Math.hypot(ox, oy);
        const safeGap = this.radius + other.radius + 3;
        if (gap < safeGap) {
          const force = (safeGap - gap) / safeGap;
          sx += gap > 0.001 ? (ox / gap) * force : this.index % 2 ? 1 : -1;
          sy += gap > 0.001 ? (oy / gap) * force : 0;
        }
      }
      const vx = dx * this.speed + sx * 28,
        vy = dy * this.speed + sy * 28;
      const speed = Math.hypot(vx, vy),
        limit = this.speed * 1.2,
        factor = speed > limit ? limit / speed : 1;
      const marginX = Math.max(this.radius, this.sprite.displayWidth / 2 + 4);
      const marginY = Math.max(this.radius, this.sprite.displayHeight / 2 + 9);
      this.x = clamp(this.x + (vx * factor * dt) / 1000, marginX, 800 - marginX);
      this.y = clamp(this.y + (vy * factor * dt) / 1000, marginY, 600 - marginY);
      this.syncHitbox();
    }
    draw(time) {
      // super() se ejecuta antes de asignar el tipo del enemigo.
      if (!this.type) {
        super.draw(time);
        return;
      }
      const size = this.type.size + (["tank", "boss"].includes(this.kind) ? 16 : 12);
      const frame = this.scene.textures.getFrame("pilots", this.type.frame || this.kind);
      this.sprite
        .setFrame(this.type.frame || this.kind)
        .setDisplaySize(size, (size * frame.height) / frame.width);
      this.drawBody(
        time,
        size,
        this.type.color,
        this.health < this.maxHealth || this.kind === "tank",
      );
      const lean = this.previousPosition
        ? clamp((this.x - this.previousPosition.x) * 0.015, -0.1, 0.1)
        : 0;
      this.sprite.setRotation(preferences.reducedMotion ? 0 : lean);
      if (!this.dead) this.scene.run?.enemyDraw(this);
    }
  }

  // Director de oleadas finitas. Todas las esperas usan dt de simulación y respetan la pausa.
  class WaveDirector {
    constructor(scene) {
      this.scene = scene;
      this.graphics = scene.add.graphics().setDepth(4);
      this.reset();
    }
    reset() {
      this.wave = 0;
      this.cleared = 0;
      this.state = "ready";
      this.wait = 700;
      this.queue = [];
      this.pending = [];
      this.spawnClock = 0;
      this.nextId = 1;
      this.bannerRemaining = 0;
      this.graphics.clear();
    }
    beginWave() {
      this.wave++;
      this.state = "active";
      this.spawnClock = 0;
      this.bannerRemaining = 2000;
      const count = Math.min(28, 6 + (this.wave - 1) * 2);
      this.queue = Array.from({ length: count }, (_, i) =>
        this.wave >= 5 && i % 5 === 4
          ? "tank"
          : this.wave >= 3 && i % 3 === 2
            ? "runner"
            : "hunter",
      );

      if (this.wave === 6) {
        this.queue = ["boss", "hunter", "runner", "hunter", "runner"];
        this.scene.run.event = { kind: "none", remaining: 0, warning: 0, progress: 0, offset: 0 };
      } else {
        this.queue = this.queue.map((kind, i) =>
          this.wave >= 5 && i % 6 === 2
            ? "splitter"
            : this.wave >= 4 && i % 5 === 1
              ? "leaker"
              : this.wave >= 3 && i % 5 === 0
                ? "shield"
                : kind,
        );
      }
      sound.play("wave");
      announce("Oleada " + this.wave + ". " + count + " enemigos.");
    }
    update(dt) {
      this.bannerRemaining = Math.max(0, this.bannerRemaining - dt);
      if (this.state === "ready" || this.state === "intermission") {
        this.wait = Math.max(0, this.wait - dt);
        if (this.wait === 0) this.beginWave();
        return;
      }
      this.pending = this.pending.filter((spawn) => {
        spawn.remaining -= dt;
        if (spawn.remaining > 0) return true;
        // Si un piloto entró en el aviso, se reubica y vuelve a anunciarse: nunca aparece encima.
        if (this.scene.players.some((p) => Math.hypot(p.x - spawn.x, p.y - spawn.y) < 100)) {
          Object.assign(spawn, chooseSpawnPoint(this.scene.players, this.scene.targets));
          spawn.remaining = SETTINGS.spawnWarningMs;
          return true;
        }
        this.scene.targets.push(
          new ArenaEnemy(this.scene, spawn.x, spawn.y, spawn.kind, this.wave, this.nextId++),
        );
        return false;
      });
      this.spawnClock -= dt;
      if (this.queue.length && this.spawnClock <= 0 && this.pending.length < 4) {
        const point = chooseSpawnPoint(this.scene.players, this.scene.targets);
        this.pending.push({
          ...point,
          kind: this.queue.shift(),
          remaining: SETTINGS.spawnWarningMs,
        });
        this.spawnClock = Math.max(330, 850 - this.wave * 35);
      }
      if (!this.queue.length && !this.pending.length && !this.scene.targets.some((t) => !t.dead)) {
        this.cleared = this.wave;
        this.state = "intermission";
        this.wait = SETTINGS.waveRestMs;
        this.scene.onWaveCleared(this.wave);
      }
    }
    draw(time) {
      const g = this.graphics;
      g.clear();
      for (const spawn of this.pending) {
        const progress = clamp(1 - spawn.remaining / SETTINGS.spawnWarningMs, 0, 1);
        const color = ENEMY_TYPES[spawn.kind].color;
        const pulse = preferences.reducedMotion ? 0.7 : 0.5 + Math.sin(time / 80) * 0.2;
        g.lineStyle(1, color, 0.3).strokeCircle(spawn.x, spawn.y, 30);
        g.lineStyle(2, color, pulse).strokeCircle(spawn.x, spawn.y, 27 - progress * 13);
        g.lineBetween(spawn.x - 6, spawn.y, spawn.x + 6, spawn.y).lineBetween(
          spawn.x,
          spawn.y - 6,
          spawn.x,
          spawn.y + 6,
        );
      }
    }
    remainingCount() {
      return (
        this.queue.length + this.pending.length + this.scene.targets.filter((t) => !t.dead).length
      );
    }
  }

  const NET_PROTOCOL = "volt-mates/7";
  const NET_STATES = ["lobby", "deploy", "playing", "paused", "gameover", "upgrade"];
  const finite = (n, min, max) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

  // Nunca se aceptan posiciones, daño ni puntuación procedentes del invitado.
  function validSnapshot(s) {
    if (
      !s ||
      !Number.isInteger(s.round) ||
      s.round < 1 ||
      !Number.isInteger(s.seq) ||
      s.seq < 1 ||
      !NET_STATES.includes(s.state) ||
      !window.VoltExpedition.validRun(s.run) ||
      (s.state === "upgrade" &&
        (s.run.offer.length !== 3 || s.run.draftWave !== s.director?.cleared))
    )
      return false;
    if (
      !finite(s.elapsed, 0, 1e10) ||
      !finite(s.score, 0, 1e10) ||
      !finite(s.kills, 0, 1e7) ||
      !finite(s.chain, 0, 1e7) ||
      !finite(s.multiplier, 1, 4) ||
      !finite(s.combo, 0, SETTINGS.comboMs) ||
      !finite(s.deploy, 0, 2400)
    )
      return false;
    if (
      !Array.isArray(s.players) ||
      s.players.length !== 2 ||
      !s.players.every(
        (p) =>
          p &&
          finite(p.x, 0, 800) &&
          finite(p.y, 0, 600) &&
          finite(p.health, 0, 100) &&
          finite(p.immune, 0, 1000),
      )
    )
      return false;
    const l = s.link,
      d = s.director;
    if (
      !l ||
      !["stable", "strained", "stunned", "disconnected"].includes(l.state) ||
      !finite(l.distance, 0, 1100) ||
      !finite(l.overload, 0, 1000) ||
      !finite(l.remaining, 0, 2000)
    )
      return false;
    if (
      !d ||
      !Number.isInteger(d.wave) ||
      !finite(d.wave, 0, 1e7) ||
      !finite(d.cleared, 0, d.wave) ||
      !["ready", "active", "intermission"].includes(d.state) ||
      !finite(d.wait, 0, 4000) ||
      !finite(d.banner, 0, 2000)
    )
      return false;
    if (
      !Array.isArray(d.queue) ||
      d.queue.length > 28 ||
      !d.queue.every((k) => Object.hasOwn(ENEMY_TYPES, k))
    )
      return false;
    if (
      !Array.isArray(d.pending) ||
      d.pending.length > 4 ||
      !d.pending.every(
        (p) =>
          p &&
          finite(p.x, 0, 800) &&
          finite(p.y, 0, 600) &&
          finite(p.remaining, 0, 900) &&
          Object.hasOwn(ENEMY_TYPES, p.kind),
      )
    )
      return false;
    if (
      !Array.isArray(s.enemies) ||
      s.enemies.length > 28 ||
      !s.enemies.every(
        (e) =>
          e &&
          Number.isInteger(e.id) &&
          finite(e.id, 1, 1e8) &&
          Object.hasOwn(ENEMY_TYPES, e.kind) &&
          finite(e.x, 0, 800) &&
          finite(e.y, 0, 600) &&
          finite(e.maxHealth, 1, e.kind === "boss" ? 1000 : 200) &&
          finite(e.health, 0, e.maxHealth) &&
          finite(e.clock, 0, 9000) &&
          finite(e.facing, -4, 9000),
      )
    )
      return false;
    if (new Set(s.enemies.map((e) => e.id)).size !== s.enemies.length) return false;
    return typeof s.ended === "boolean" && finite(s.best, 0, 1e10);
  }

  class OnlineSession {
    constructor(scene) {
      this.scene = scene;
      this.role = "local";
      this.connection = null;
      this.peer = null;
      this.ready = false;
      this.attempt = 0;
      this.round = 0;
      this.packetSeq = 0;
      this.inputSeq = 0;
      this.remoteSeq = -1;
      this.remoteBits = 0;
      this.lastInput = 0;
      this.lastReceive = 0;
      this.lastSnapshot = -1;
      this.frames = [];
      this.inputClock = 0;
      this.snapshotClock = 0;
      this.rtt = 0;
      this.hostPaused = false;
      this.guestPaused = false;
      this.localPaused = false;
      this.applying = false;
      this.timers = new Set();
      this.interval = null;
      this.setupTimer = null;
      this.code = "";
      this.lastState = "lobby";
      this.remoteOutfit = null;
      this.remoteName = null;
    }
    get online() {
      return this.role === "host" || this.role === "guest";
    }
    isGuest() {
      return this.role === "guest";
    }
    schedule(fn, ms) {
      const id = setTimeout(() => {
        this.timers.delete(id);
        fn();
      }, ms);
      this.timers.add(id);
      return id;
    }
    stop(notify = true) {
      if (notify && this.connection?.open) this.send({ t: "leave" });
      this.attempt++;
      this.ready = false;
      for (const id of this.timers) clearTimeout(id);
      this.timers.clear();
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      try {
        this.connection?.close();
        this.peer?.destroy();
      } catch {}
      this.connection = null;
      this.peer = null;
      this.role = "local";
      this.remoteBits = 0;
      this.frames = [];
      this.localPaused = false;
      this.hostPaused = false;
      this.guestPaused = false;
      this.round = 0;
      this.lastSnapshot = -1;
      this.packetSeq = 0;
      this.remoteSeq = -1;
      this.code = "";
      this.remoteOutfit = null;
      this.remoteName = null;
      document.body.dataset.connection = "local";
      byId("connection-info").textContent = "DOS PILOTOS · UN VÍNCULO";
    }
    openLobby() {
      this.stop();
      const p = window.VoltExpedition.profile;
      this.scene.run.identity = { duo: p.duoName, names: [...p.names] };
      this.scene.ranking.refreshNames();
      this.scene.ui.show("lobby");
      byId("room-controls").hidden = false;
      byId("room-details").hidden = true;
      byId("room-start").disabled = true;
      byId("room-code").textContent = "--------";
      this.status("Crea una sala o introduce el código de tu compañero.");
      byId("create-room").disabled = false;
      byId("join-room").disabled = false;
      const code = new URL(location.href).searchParams.get("room");
      if (code && /^[A-HJ-NP-Z2-9]{8}$/i.test(code)) byId("room-input").value = code.toUpperCase();
    }
    status(text, error = false) {
      byId("lobby-status").textContent = text;
      byId("lobby-status").classList.toggle("error", error);
      announce(text);
    }
    makeCode() {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      return [...bytes].map((n) => alphabet[n & 31]).join("");
    }
    create() {
      this.connect("host", this.makeCode());
    }
    join() {
      if (byId("join-room").disabled) return;
      const code = byId("room-input").value.trim().toUpperCase();
      byId("room-input").value = code;
      if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
        this.status("Introduce las 8 letras o números del código de sala.", true);
        byId("room-input").focus();
        return;
      }
      this.connect("guest", code);
    }
    connect(role, code) {
      this.stop(false);
      if (!window.Peer) {
        this.status(
          "No se pudo cargar PeerJS. Revisa internet y recarga; el modo local sigue disponible.",
          true,
        );
        return;
      }
      this.role = role;
      this.code = code;
      this.round = 0;
      this.packetSeq = 0;
      this.inputSeq = 0;
      this.lastSnapshot = -1;
      this.lastReceive = performance.now();
      const token = this.attempt;
      document.body.dataset.connection = role;
      byId("create-room").disabled = true;
      byId("join-room").disabled = true;
      byId("room-start").disabled = true;
      byId("room-controls").hidden = false;
      byId("room-details").hidden = true;
      this.status(
        role === "host" ? "Registrando la sala…" : "Buscando la sala y negociando la conexión…",
      );
      try {
        this.peer =
          role === "host"
            ? new Peer("vm4-" + code.toLowerCase(), { debug: 0 })
            : new Peer({ debug: 0 });
        this.setupTimer = this.schedule(() => {
          if (token === this.attempt && !this.ready)
            this.fail("La conexión tardó demasiado. Prueba otra sala o revisa la red.");
        }, 20000);
        this.peer.on("open", () => {
          if (token !== this.attempt) return;
          if (role === "host") {
            clearTimeout(this.setupTimer);
            this.timers.delete(this.setupTimer);
            this.roomView();
            this.status("Sala creada. Comparte el código y espera a Flux.");
          } else {
            const conn = this.peer.connect("vm4-" + code.toLowerCase(), {
              reliable: true,
              serialization: "json",
              metadata: { protocol: NET_PROTOCOL },
            });
            this.bindConnection(conn, token);
          }
        });
        this.peer.on("connection", (conn) => {
          if (token !== this.attempt) {
            conn.close();
            return;
          }
          if (role !== "host" || this.connection) {
            this.reject(conn, "Sala ocupada. Sólo admite dos pilotos.");
            return;
          }
          if (conn.metadata?.protocol !== NET_PROTOCOL) {
            this.reject(conn, "Las versiones del juego no coinciden.");
            return;
          }
          this.bindConnection(conn, token);
        });
        this.peer.on("error", (error) => {
          if (token !== this.attempt) return;
          if (
            this.connection?.open &&
            ["network", "server-error", "socket-error", "socket-closed"].includes(error.type)
          )
            return;
          const messages = {
            "peer-unavailable":
              "No se encontró esa sala. Comprueba el código y que el anfitrión siga conectado.",
            "unavailable-id": "Ese código ya está ocupado. Crea otra sala.",
            "browser-incompatible":
              "Este navegador no admite WebRTC. Prueba Chrome, Edge o Firefox actualizado.",
            network: "No se pudo acceder al servidor de señalización.",
            webrtc: "La red no permitió establecer el enlace WebRTC.",
          };
          this.fail(
            messages[error.type] ||
              "No se pudo completar la conexión. Revisa la red y vuelve a intentarlo.",
          );
        });
        this.peer.on("disconnected", () => {
          if (token !== this.attempt || this.connection?.open) return;
          this.fail("Se perdió la conexión con el servicio de salas.");
        });
      } catch {
        this.fail("No se pudo iniciar WebRTC en este navegador.");
      }
    }
    reject(conn, reason) {
      const rejectOpen = () => {
        try {
          conn.send({ t: "reject", reason });
        } catch {}
        this.schedule(() => conn.close(), 300);
      };
      if (conn.open) rejectOpen();
      else conn.on("open", rejectOpen);
    }
    sendIdentity() {
      if (this.role === "host" && this.ready && this.round === 0)
        this.send({ t: "identity", identity: this.scene.run.identity });
    }
    roomView() {
      byId("copy-room").textContent = "COPIAR";
      byId("room-copy-fallback").hidden = true;
      byId("room-controls").hidden = true;
      byId("room-details").hidden = false;
      byId("room-code").textContent = this.code;
      byId("ion-role").textContent = this.role === "host" ? "TÚ · ION / WASD" : "ANFITRIÓN · ION";
      byId("flux-role").textContent =
        this.role === "guest" ? "TÚ · FLUX / WASD" : "FLUX · ESPERANDO";
      byId("ion-seat").classList.add("connected");
      byId("flux-seat").classList.toggle("connected", this.ready);
      byId("room-start").hidden = this.role !== "host";
      byId("guest-wait").hidden = this.role !== "guest";
    }
    bindConnection(conn, token) {
      this.connection = conn;
      conn.on("open", () => {
        if (token !== this.attempt) return;
        this.lastReceive = performance.now();
        if (this.role === "guest")
          this.send({
            t: "hello",
            protocol: NET_PROTOCOL,
            outfit: window.VoltExpedition.profile.outfits[1],
            name: window.VoltExpedition.profile.names[1],
          });
        this.interval = setInterval(() => {
          if (token !== this.attempt) return;
          if (performance.now() - this.lastReceive > 8000) {
            this.fail("El otro piloto dejó de responder. La partida está detenida.");
            return;
          }
          this.send({ t: "ping", time: performance.now() });
        }, 1000);
      });
      conn.on("data", (data) => {
        if (token === this.attempt) this.receive(data);
      });
      conn.on("close", () => {
        if (token === this.attempt)
          this.fail("El otro piloto se desconectó. La partida está detenida.");
      });
      conn.on("error", () => {
        if (token === this.attempt)
          this.fail("El enlace WebRTC se interrumpió. La partida está detenida.");
      });
    }
    send(packet) {
      if (!this.connection?.open) return false;
      if ((this.connection.dataChannel?.bufferedAmount || 0) > 128000) return false;
      try {
        this.connection.send(packet);
        return true;
      } catch {
        return false;
      }
    }
    receive(m) {
      if (!m || typeof m !== "object" || typeof m.t !== "string") return;
      if (m.t === "ping" && finite(m.time, 0, 1e12)) {
        this.lastReceive = performance.now();
        this.send({ t: "pong", time: m.time });
        return;
      }
      if (m.t === "pong" && finite(m.time, 0, performance.now())) {
        this.lastReceive = performance.now();
        this.rtt = Math.round(performance.now() - m.time);
        return;
      }
      if (m.t === "reject") {
        this.fail(typeof m.reason === "string" ? m.reason.slice(0, 150) : "Sala no disponible.");
        return;
      }
      if (m.t === "leave") {
        this.fail("Tu compañero salió de la sala. La partida está detenida.");
        return;
      }
      if (this.role === "host") {
        if (m.t === "hello") {
          if (this.ready) return;
          if (m.protocol !== NET_PROTOCOL) {
            this.reject(this.connection, "Las versiones del juego no coinciden.");
            return;
          }
          this.ready = true;
          if (window.VoltExpedition.validOutfit(m.outfit)) this.remoteOutfit = { ...m.outfit };
          this.lastReceive = performance.now();

          this.remoteName = window.VoltLeague.validName(m.name, 16) ? m.name : "Flux";
          this.scene.run.identity = {
            duo: window.VoltExpedition.profile.duoName,
            names: [window.VoltExpedition.profile.names[0], this.remoteName],
          };
          this.send({
            t: "welcome",
            protocol: NET_PROTOCOL,
            code: this.code,
            identity: this.scene.run.identity,
          });
          this.scene.ranking.refreshNames();
          this.roomView();
          byId("room-start").disabled = false;
          byId("flux-role").textContent = "FLUX · CONECTADO";
          this.status("Ambos pilotos conectados. Ion puede iniciar la partida.");
          return;
        }
        if (!this.ready) return;

        if (m.t === "identity" && this.round === 0 && window.VoltLeague.validName(m.name, 16)) {
          this.remoteName = m.name;
          this.scene.run.identity.names[1] = m.name;
          this.scene.ranking.refreshNames();
          this.sendIdentity();
          return;
        }
        if (m.t === "outfit" && window.VoltExpedition.validOutfit(m.outfit)) {
          this.remoteOutfit = { ...m.outfit };
          this.scene.run.outfits[1] = { ...m.outfit };
          this.sendSnapshot();
          return;
        }
        if (
          m.t === "vote" &&
          m.round === this.round &&
          m.wave === this.scene.run.draftWave &&
          this.scene.ui.state === "upgrade"
        ) {
          this.scene.run.vote(1, m.index);
          return;
        }
        if (
          m.t === "input" &&
          m.round === this.round &&
          Number.isInteger(m.seq) &&
          m.seq > this.remoteSeq &&
          finite(m.seq, 0, 1e10) &&
          Number.isInteger(m.bits) &&
          finite(m.bits, 0, 15)
        ) {
          this.remoteSeq = m.seq;
          this.remoteBits = m.bits;
          this.lastInput = performance.now();
          this.lastReceive = performance.now();
          return;
        }
        if (m.t === "pause" && m.round === this.round && typeof m.paused === "boolean") {
          this.lastReceive = performance.now();
          this.guestPaused = m.paused;
          this.remoteBits = 0;
          this.applying = true;
          try {
            if (m.paused && ["playing", "deploy"].includes(this.scene.ui.state))
              this.scene.ui.pause(false);
            else if (!m.paused && !this.hostPaused && this.scene.ui.state === "paused")
              this.scene.ui.show(this.scene.ui.resumeState);
          } finally {
            this.applying = false;
          }
          this.sendSnapshot();
          return;
        }
        if (
          m.t === "restart" &&
          m.round === this.round &&
          this.scene.ended &&
          ["gameover", "ranking", "identity"].includes(this.scene.ui.state)
        ) {
          this.lastReceive = performance.now();
          this.scene.ui.start("survival");
        }
      } else if (this.role === "guest") {
        if (m.t === "identity" && this.round === 0 && window.VoltLeague.validIdentity(m.identity)) {
          this.scene.run.identity = { duo: m.identity.duo, names: [...m.identity.names] };
          this.scene.ranking.refreshNames();
          return;
        }
        if (m.t === "welcome" && m.protocol === NET_PROTOCOL && m.code === this.code) {
          this.ready = true;
          if (window.VoltLeague.validIdentity(m.identity))
            this.scene.run.identity = { duo: m.identity.duo, names: [...m.identity.names] };
          this.scene.ranking.refreshNames();
          this.lastReceive = performance.now();
          clearTimeout(this.setupTimer);
          this.timers.delete(this.setupTimer);
          this.roomView();
          this.status("Conectado como Flux. El anfitrión iniciará la partida.");
          return;
        }
        if (m.t === "snapshot" && this.ready && validSnapshot(m.s) && m.s.round >= this.round) {
          const s = m.s;
          if (s.round === this.round && s.seq <= this.lastSnapshot) return;
          this.lastReceive = performance.now();
          this.acceptSnapshot(s);
        }
      }
    }
    beginRound() {
      if (this.role !== "host" || !this.ready) return false;
      this.round++;
      this.packetSeq = 0;
      this.remoteSeq = -1;
      this.remoteBits = 0;
      this.hostPaused = false;
      this.guestPaused = false;
      this.localPaused = false;
      this.lastInput = performance.now();
      return true;
    }
    pauseLocal() {
      if (!this.online || !this.ready || this.applying) return;
      this.remoteBits = 0;
      this.localPaused = true;
      if (this.role === "host") {
        this.hostPaused = true;
        this.sendSnapshot();
      } else this.send({ t: "pause", round: this.round, paused: true });
    }
    resumeLocal() {
      this.localPaused = false;
      if (this.role === "guest") {
        this.send({ t: "pause", round: this.round, paused: false });
        byId("pause-note").textContent = "Esperando que el anfitrión continúe…";
        return false;
      }
      this.hostPaused = false;
      if (this.guestPaused) {
        byId("pause-note").textContent = "Flux sigue en pausa. Espera a tu compañero.";
        this.sendSnapshot();
        return false;
      }
      return true;
    }
    snapshot() {
      const s = this.scene,
        u = s.ui;

      let state = ["tutorial", "settings", "workshop", "identity", "ranking"].includes(u.state)
        ? "paused"
        : u.state;
      if (
        (u.state === "ranking" && s.ranking.returnState === "gameover") ||
        (u.state === "identity" &&
          s.ranking.identityReturn === "ranking" &&
          s.ranking.returnState === "gameover")
      )
        state = "gameover";
      if (!NET_STATES.includes(state) || this.round < 1) return null;
      return {
        round: this.round,
        seq: ++this.packetSeq,
        state,
        deploy: u.deployRemaining,
        elapsed: s.elapsed,
        score: s.score,
        kills: s.kills,
        chain: s.chain,
        multiplier: s.multiplier,
        combo: s.comboRemaining,
        ended: s.ended,
        best: s.bestScore,
        run: s.run.snapshot(),
        players: s.players.map((p) => ({
          x: p.x,
          y: p.y,
          health: p.health,
          immune: p.invulnerable,
        })),
        link: {
          state: s.link.state,
          distance: s.link.distance,
          overload: s.link.overload,
          remaining: s.link.remaining,
        },
        director: {
          wave: s.director.wave,
          cleared: s.director.cleared,
          state: s.director.state,
          wait: s.director.wait,
          banner: s.director.bannerRemaining,
          queue: [...s.director.queue],
          pending: s.director.pending.map((p) => ({ ...p })),
        },
        enemies: s.targets
          .filter((e) => !e.dead)
          .map((e) => ({
            id: e.index,
            kind: e.kind,
            x: e.x,
            y: e.y,
            health: e.health,
            maxHealth: e.maxHealth,
            contact: e.contact,
            clock: e.clock,
            facing: e.facing,
          })),
      };
    }
    sendSnapshot() {
      if (this.role === "host" && this.ready) {
        const s = this.snapshot();
        if (s) this.send({ t: "snapshot", s });
      }
    }
    acceptSnapshot(s) {
      const scene = this.scene,
        newRound = s.round > this.round;
      this.applying = true;
      try {
        if (newRound) {
          this.round = s.round;
          this.frames = [];
          this.lastSnapshot = -1;
          this.inputSeq = 0;
          scene.resetSession("survival");
          this.remoteBits = 0;
        }
        this.lastSnapshot = s.seq;
        this.frames.push({ time: performance.now(), s });
        if (this.frames.length > 12) this.frames.shift();
        scene.elapsed = s.elapsed;
        scene.visualTime = s.elapsed;
        scene.score = s.score;
        scene.kills = s.kills;
        scene.chain = s.chain;
        scene.multiplier = s.multiplier;
        scene.comboRemaining = s.combo;
        scene.ended = s.ended;
        scene.run.accept(s.run);
        Object.assign(scene.link, s.link);
        Object.assign(scene.director, {
          wave: s.director.wave,
          cleared: s.director.cleared,
          state: s.director.state,
          wait: s.director.wait,
          bannerRemaining: s.director.banner,
          queue: s.director.queue,
          pending: s.director.pending,
        });
        scene.players.forEach((p, i) => {
          if (s.players[i].health < p.health && !newRound) {
            scene.fx.burst(s.players[i].x, s.players[i].y, SETTINGS.danger, 12);
            sound.play("hit");
          }
          p.health = s.players[i].health;
          p.invulnerable = s.players[i].immune;
        });
        const present = new Set(s.enemies.map((e) => e.id));
        scene.targets = scene.targets.filter((e) => {
          if (present.has(e.index)) return true;
          if (!newRound) {
            scene.fx.burst(e.x, e.y, e.type.color, 20);
            sound.play("cut");
          }
          e.destroy();
          return false;
        });
        for (const data of s.enemies) {
          let enemy = scene.targets.find((e) => e.index === data.id);
          if (!enemy) {
            enemy = new ArenaEnemy(scene, data.x, data.y, data.kind, s.director.wave, data.id);
            scene.targets.push(enemy);
          }
          enemy.health = data.health;
          enemy.maxHealth = data.maxHealth;
          enemy.contact = !!data.contact;
          enemy.clock = data.clock;
          enemy.facing = data.facing;
        }
        if (s.state === "deploy") {
          scene.ui.deployRemaining = s.deploy;
          byId("deploy-count").textContent = Math.max(1, Math.ceil(s.deploy / 800));
          byId("deploy-title").textContent = "Sincronizados con " + s.run.identity.names[0] + ".";
          byId("deploy-tip").textContent =
            "Controlas a " + s.run.identity.names[1] + " con WASD o flechas.";
        }
        let desired = s.state;
        if (s.state === "gameover") this.localPaused = false;
        if (this.localPaused && ["playing", "deploy"].includes(desired)) desired = "paused";
        if (
          (newRound ||
            (s.state === "gameover" &&
              !(scene.ui.state === "ranking" && scene.ranking.returnState === "gameover") &&
              !(
                scene.ui.state === "identity" &&
                scene.ranking.identityReturn === "ranking" &&
                scene.ranking.returnState === "gameover"
              )) ||
            s.state === "upgrade" ||
            !["tutorial", "settings", "workshop", "identity", "ranking"].includes(
              scene.ui.state,
            )) &&
          scene.ui.state !== desired
        )
          scene.ui.show(desired, false);
        if (s.state === "gameover") {
          scene.bestScore = Math.max(scene.bestScore, s.best, s.score);
          try {
            localStorage.setItem("volt-mates.best.v3", String(scene.bestScore));
          } catch {}
          byId("menu-best").textContent = "RÉCORD " + scene.bestScore.toLocaleString("es-PE");
          byId("result-score").textContent = s.score.toLocaleString("es-PE");
          byId("result-waves").textContent = s.director.cleared;
          byId("result-kills").textContent = s.kills;
          byId("result-time").textContent =
            String(Math.floor(s.elapsed / 60000)).padStart(2, "0") +
            ":" +
            String(Math.floor(s.elapsed / 1000) % 60).padStart(2, "0");

          byId("result-title").textContent = s.run.won
            ? "La estación es de ustedes."
            : "La chispa no se apaga.";
          byId("result-reason").textContent = s.run.won
            ? "EL DESCONECTOR HA CAÍDO"
            : s.run.identity.names[s.players[0].health <= 0 ? 0 : 1] + " SE QUEDÓ SIN ENERGÍA";
          byId("result-record").textContent = "RÉCORD " + scene.bestScore.toLocaleString("es-PE");
          scene.ranking.capture();
        }
        scene.ranking.refreshNames();
        scene.updateHud();
        this.lastState = s.state;
      } finally {
        this.applying = false;
      }
      if (newRound && this.localPaused) this.send({ t: "pause", round: this.round, paused: true });
    }
    localBits() {
      const a = this.scene.players[0].keys,
        b = this.scene.players[1].keys;
      return (
        (a.up.isDown || b.up.isDown ? 1 : 0) |
        (a.down.isDown || b.down.isDown ? 2 : 0) |
        (a.left.isDown || b.left.isDown ? 4 : 0) |
        (a.right.isDown || b.right.isDown ? 8 : 0)
      );
    }
    tick(dt) {
      if (!this.online || !this.ready) return;
      byId("connection-info").textContent =
        this.scene.run.identity.names[this.role === "host" ? 0 : 1] +
        (this.role === "host" ? " · ANFITRIÓN" : " · INVITADO") +
        " / " +
        this.rtt +
        " ms";
      if (this.role === "guest") {
        this.inputClock += dt;
        if (this.inputClock >= 33) {
          this.inputClock = 0;
          const bits =
            this.scene.ui.state === "playing" && !this.localPaused ? this.localBits() : 0;
          this.send({ t: "input", round: this.round, seq: ++this.inputSeq, bits });
        }
        const frames = this.frames;
        if (!frames.length) return;
        const renderTime = performance.now() - 75;
        let a = frames[0],
          b = frames.at(-1);
        for (let i = 0; i < frames.length - 1; i++)
          if (frames[i].time <= renderTime) {
            a = frames[i];
            b = frames[i + 1];
          }
        const t = clamp((renderTime - a.time) / Math.max(1, b.time - a.time), 0, 1);
        const mix = (x, y) => x + (y - x) * t;
        this.scene.players.forEach((p, i) =>
          p.shape.body.reset(
            mix(a.s.players[i].x, b.s.players[i].x),
            mix(a.s.players[i].y, b.s.players[i].y),
          ),
        );
        for (const e of this.scene.targets) {
          const previous = a.s.enemies.find((v) => v.id === e.index),
            next =
              b.s.enemies.find((v) => v.id === e.index) ||
              frames.at(-1).s.enemies.find((v) => v.id === e.index);
          if (next) {
            e.x = previous ? mix(previous.x, next.x) : next.x;
            e.y = previous ? mix(previous.y, next.y) : next.y;
            e.syncHitbox();
          }
        }
      } else if (performance.now() - this.lastInput > 250) this.remoteBits = 0;
    }
    afterFrame(dt) {
      if (this.role !== "host" || !this.ready) return;
      this.snapshotClock += dt;
      if (this.snapshotClock >= 50) {
        this.snapshotClock = 0;
        this.sendSnapshot();
      }
    }
    async copyCode() {
      try {
        await navigator.clipboard.writeText(this.code);
        byId("copy-room").textContent = "COPIADO ✓";
      } catch {
        byId("room-copy-fallback").hidden = false;
        byId("room-copy-fallback").value = this.code;
        byId("room-copy-fallback").select();
        announce("Selecciona y copia el código de sala.");
      }
    }
    fail(message) {
      const wasPlaying = this.round > 0;
      this.stop(false);
      this.scene.setRunning(false);
      if (wasPlaying) {
        byId("disconnect-message").textContent = message;
        this.scene.ui.show("disconnected");
      } else {
        this.scene.ui.show("lobby");
        byId("room-controls").hidden = false;
        byId("room-details").hidden = true;
        byId("create-room").disabled = false;
        byId("join-room").disabled = false;
        this.status(message, true);
      }
    }
  }

  // La simulación conserva 800×600; el buffer sigue los píxeles físicos visibles.
  class CrispRenderer {
    constructor(scene) {
      this.scene = scene;
      this.pending = false;
      this.resize = () => {
        if (this.pending) return;
        this.pending = true;
        requestAnimationFrame(() => {
          this.pending = false;
          this.refresh();
        });
      };
      this.observer = new ResizeObserver(this.resize);
      this.observer.observe(byId("game"));
      window.addEventListener("resize", this.resize);
      this.refresh();
    }
    refresh() {
      const bounds = byId("game").getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const fit = Math.min(bounds.width / 800, bounds.height / 600);
      const density = Math.min(3, Math.max(1, fit * (window.devicePixelRatio || 1)));
      const unit = Math.ceil(200 * density),
        width = unit * 4,
        height = unit * 3;
      if (this.scene.game.canvas.width !== width || this.scene.game.canvas.height !== height)
        this.scene.scale.resize(width, height);
      this.scene.cameras.main
        .setSize(width, height)
        .setZoom(width / 800)
        .centerOn(400, 300);
      this.scene.game.canvas.style.imageRendering = "auto";
    }
    destroy() {
      this.observer.disconnect();
      window.removeEventListener("resize", this.resize);
    }
  }

  class ArenaScene extends Phaser.Scene {
    constructor() {
      super("Arena");
    }
    preload() {
      if (!window.VOLT_ASSETS) {
        showError("Falta assets.js. Conserva todos los archivos de la carpeta.");
        return;
      }
      this.load.on("progress", (value) => {
        byId("boot-status").textContent = "CARGANDO EL NÚCLEO · " + Math.round(value * 100) + "%";
        byId("boot-loader").querySelector("i").style.width = Math.round(value * 100) + "%";
      });
      this.load.image("pilots", window.VOLT_ASSETS.atlas);
      this.load.image("reactor", window.VOLT_ASSETS.arena);
      document
        .querySelectorAll("[data-atlas]")
        .forEach((image) => image.setAttribute("href", window.VOLT_ASSETS.atlas));
      document.querySelector(".menu-atmosphere").style.backgroundImage =
        'url("' + window.VOLT_ASSETS.arena + '")';
    }
    create() {
      if (!this.textures.exists("pilots") || !this.textures.exists("reactor")) {
        showError("No se pudo cargar el arte. Recarga la página para volver a intentarlo.");
        return;
      }
      Object.entries(window.VOLT_ASSETS.frames).forEach(([name, frame]) =>
        this.textures.get("pilots").add(name, 0, ...frame),
      );
      this.activeSession = false;
      this.elapsed = 0;
      this.visualTime = 0;
      this.lastSecond = -1;
      byId("boot-status").textContent = "CONSTRUYENDO LA ESTACIÓN…";
      this.createTextures();
      this.drawArena();
      this.ambient = this.add.graphics().setDepth(2);
      this.fx = new Effects(this);
      this.beam = this.add.graphics().setDepth(6);
      const k = Phaser.Input.Keyboard.KeyCodes;
      this.players = [
        new LocalPlayer(this, {
          x: 295,
          y: 335,
          color: SETTINGS.blue,
          name: "01 / ION",
          keys: { up: k.W, left: k.A, down: k.S, right: k.D },
        }),
        new LocalPlayer(this, {
          x: 505,
          y: 335,
          color: SETTINGS.pink,
          name: "02 / FLUX",
          keys: { up: k.UP, left: k.LEFT, down: k.DOWN, right: k.RIGHT },
        }),
      ];
      this.link = new EnergyLink(this);
      this.targets = [];
      this.mode = "training";
      this.ended = false;
      this.score = 0;
      this.kills = 0;
      this.chain = 0;
      this.multiplier = 1;
      this.comboRemaining = 0;
      this.director = new WaveDirector(this);
      this.run = new window.VoltExpedition.RunSystems(this, {
        settings: SETTINGS,
        preferences,
        sound,
        announce,
      });
      this.bestScore = this.loadBestScore();
      byId("menu-best").textContent = "RÉCORD " + this.bestScore.toLocaleString("es-PE");
      this.rearmTargets();
      this.link.update(0);
      this.link.saveEndpoints();
      this.drawBeam(0);
      this.updateHud();
      this.physics.world.setBounds(0, 0, 800, 600);
      this.physics.world.pause();
      this.game.canvas.setAttribute("tabindex", "0");
      this.game.canvas.setAttribute("role", "img");
      this.game.canvas.setAttribute(
        "aria-label",
        "Arena Volt-Mates. Ion WASD, Flux flechas. Escape pausa. T rearma drones.",
      );
      this.ui = new ScreenController(this);
      this.net = new OnlineSession(this);
      this.ranking = new window.VoltLeague.LeagueUI(this);
      this.crispRenderer = new CrispRenderer(this);
      byId("boot-loader").hidden = true;
      byId("boot-status").textContent = "NÚCLEO LISTO / ESPERANDO PILOTOS";
      byId("enter-button").hidden = false;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.ui.destroy();
        this.crispRenderer.destroy();
        this.net?.stop();
        sound.destroy();
        this.run.destroy();
        this.ranking.destroy();
      });
    }
    createTextures() {
      const glow = this.textures.createCanvas("glow", 128, 128),
        ctx = glow.getContext(),
        gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "#ffffff88");
      gradient.addColorStop(0.3, "#ffffff33");
      gradient.addColorStop(1, "#ffffff00");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      glow.refresh();
    }
    drawArena() {
      this.add.image(400, 300, "reactor").setDisplaySize(800, 600).setDepth(0);
      // El contraste del suelo favorece la lectura del rayo y de las siluetas.
      this.add.rectangle(400, 300, 800, 600, 0x020817, 0.13).setDepth(1);
      this.arenaTitle = this.add
        .text(400, 535, "CÁMARA DE CALIBRACIÓN", {
          resolution: 3,
          fontFamily: "Consolas, monospace",
          fontSize: "9px",
          color: "#7c97a6",
          letterSpacing: 3,
        })
        .setOrigin(0.5)
        .setAlpha(0.6)
        .setDepth(2);
    }
    rearmTargets() {
      if (this.mode !== "training") return;
      this.fx.reset();
      this.targets.forEach((t) => t.destroy());
      this.targets = [
        [400, 190],
        [235, 395],
        [575, 395],
      ].map(([x, y], i) => new TrainingDrone(this, x, y, i + 1));
      this.destroyedTargets = 0;
      byId("target-count").textContent = "DRONES 0 / 3";
      byId("mission-instruction").textContent = "Atraviesen los drones con el rayo.";
    }
    onDroneDestroyed(enemy) {
      if (this.mode === "survival") {
        this.kills++;
        this.chain = this.comboRemaining > 0 ? this.chain + 1 : 1;
        this.comboRemaining = SETTINGS.comboMs;
        this.multiplier = Math.min(4, 1 + Math.floor((this.chain - 1) / 4));
        const points = enemy.type.points * this.multiplier;
        this.score += points;
        this.run.onKill(enemy);
        this.fx.message(
          enemy.x,
          clamp(enemy.y - 48, 30, 555),
          "+" + points + " / x" + this.multiplier,
        );
        return;
      }
      this.destroyedTargets++;
      byId("target-count").textContent = "DRONES " + this.destroyedTargets + " / 3";
      if (this.destroyedTargets === 3) {
        byId("mission-instruction").textContent = "Prueba completada. T para rearmar.";
        this.fx.message(400, 260, "CALIBRACIÓN COMPLETA");
        announce("Calibración completa. Tres drones cortados. T para rearmar.");
      }
    }
    onBreak() {
      this.players.forEach((p) => this.fx.burst(p.x, p.y, SETTINGS.danger, 30));
      const [a, b] = this.players;
      this.fx.burst((a.x + b.x) / 2, (a.y + b.y) / 2, SETTINGS.danger, 45);
      if (!preferences.reducedMotion) {
        this.cameras.main.shake(180, 0.006);
        this.cameras.main.flash(90, 90, 18, 30);
      }
      sound.play("snap");
      announce("Vínculo roto. Aturdimiento de " + this.run.stunMs / 1000 + " segundos.");
    }
    onReconnect() {
      this.players.forEach((p) => this.fx.burst(p.x, p.y, SETTINGS.beam, 15));
      sound.play("reconnect");
      announce("Vínculo restaurado.");
    }
    drawBeam(time) {
      const g = this.beam;
      g.clear();
      const [a, b] = this.players,
        link = this.link;
      if (!link.conducting || this.run.rescue.pilot >= 0) {
        if (this.run.rescue.pilot >= 0)
          g.lineStyle(1, 0xffd08c, 0.3).lineBetween(a.x, a.y, b.x, b.y);
        if (link.state === "stunned" && !preferences.reducedMotion) {
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          g.lineStyle(2, SETTINGS.danger, 0.5);
          g.lineBetween(
            a.x,
            a.y,
            a.x + Math.cos(angle) * 22,
            a.y + Math.sin(angle) * 22,
          ).lineBetween(b.x, b.y, b.x - Math.cos(angle) * 22, b.y - Math.sin(angle) * 22);
          this.players.forEach((p) =>
            g
              .lineStyle(1, SETTINGS.danger, 0.65)
              .strokeCircle(p.x, p.y, 25 + Math.sin(time / 100) * 2),
          );
        }
        return;
      }
      const strained = link.state === "strained",
        color = strained ? SETTINGS.danger : this.run.beamColor,
        pulse = preferences.reducedMotion
          ? 0.85
          : 0.75 + Math.sin(time / (strained ? 65 : 210)) * 0.15;
      g.lineStyle(20, color, 0.035).lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(8, color, 0.12).lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(3, color, pulse).lineBetween(a.x, a.y, b.x, b.y);

      if (!strained && this.run.otherBeamColor !== color) {
        const middleX = (a.x + b.x) / 2,
          middleY = (a.y + b.y) / 2,
          c = this.run.otherBeamColor;
        g.lineStyle(20, c, 0.035).lineBetween(middleX, middleY, b.x, b.y);
        g.lineStyle(8, c, 0.12).lineBetween(middleX, middleY, b.x, b.y);
        g.lineStyle(3, c, pulse).lineBetween(middleX, middleY, b.x, b.y);
      }
      g.lineStyle(1, strained ? 0xffc1c4 : 0xf2ffdc, 0.9).lineBetween(a.x, a.y, b.x, b.y);
      if (!preferences.reducedMotion) {
        const dx = b.x - a.x,
          dy = b.y - a.y,
          length = Math.max(1, link.distance);
        let px = a.x,
          py = a.y;
        g.lineStyle(1, color, 0.4);
        // El arco decorativo no cambia el segmento que aplica daño.
        for (let i = 1; i <= 12; i++) {
          const t = i / 12,
            offset = i === 12 ? 0 : Math.sin(time / 55 + i * 3) * (strained ? 6 : 2),
            x = a.x + dx * t - (dy / length) * offset,
            y = a.y + dy * t + (dx / length) * offset;
          g.lineBetween(px, py, x, y);
          px = x;
          py = y;
        }
        g.fillStyle(0xf3ffe0);
        for (let i = 0; i < 4; i++) {
          const t = (time / 1200 + i / 4) % 1;
          g.fillCircle(a.x + dx * t, a.y + dy * t, 1.6);
        }
      }
    }
    drawAmbient(time) {
      const g = this.ambient;
      g.clear();
      g.lineStyle(2, SETTINGS.beam, 0.19);
      const angle = preferences.reducedMotion ? 0 : time / 9000;
      for (let i = 0; i < 3; i++) {
        const a = angle + (i * Math.PI * 2) / 3;
        g.beginPath();
        g.arc(400, 300, 124, a, a + 0.5);
        g.strokePath();
      }
    }
    setRunning(running) {
      this.activeSession = running && !this.net?.isGuest();
      this.players.forEach((p) => p.stop());
      this.input.keyboard.resetKeys();
      if (this.activeSession) this.physics.world.resume();
      else this.physics.world.pause();
      sound.suspended = !running;
    }

    clearTargets() {
      this.targets.forEach((target) => target.destroy());
      this.targets = [];
    }
    loadBestScore() {
      try {
        const stored = Number(localStorage.getItem("volt-mates.best.v3"));
        return Number.isFinite(stored) && stored >= 0 && stored <= 1e10 ? Math.floor(stored) : 0;
      } catch {
        return 0;
      }
    }
    onWaveCleared(wave) {
      this.score += wave * 200;
      this.players.forEach((p) => {
        if (p.health > 0) p.health = Math.min(SETTINGS.playerHealth, p.health + SETTINGS.waveHeal);
      });
      this.fx.message(400, 270, "OLEADA " + wave + " SUPERADA");
      this.fx.message(
        400,
        300,
        "+" + wave * 200 + " PTS · RECUPERACIÓN +" + SETTINGS.waveHeal,
        "#9ecbff",
      );
      sound.play("reconnect");

      this.run.track();
      if (wave === 6) {
        this.finishSession(null, true);
        return;
      }
      this.run.openDraft(wave);
      announce("Oleada superada. Energía recuperada.");
    }
    updateCombatHud() {
      const survival = this.mode === "survival";
      byId("mission-title").textContent = survival
        ? "OLEADA " + Math.max(1, this.director.wave).toString().padStart(2, "0")
        : "CALIBRACIÓN";
      byId("target-count").textContent = survival
        ? "HOSTILES " + this.director.remainingCount()
        : "DRONES " + this.destroyedTargets + " / 3";
      byId("score-hud").hidden = !survival;
      byId("vitals").hidden = !survival;
      byId("targets-button").hidden = survival;
      byId("wave-banner").hidden = !survival;
      byId("score-value").textContent = this.score.toLocaleString("es-PE");
      byId("combo-value").textContent =
        this.chain > 1 ? "CADENA " + this.chain + " / x" + this.multiplier : "";
      const director = this.director;
      if (survival) {
        const rest = director.state === "intermission";
        byId("wave-banner").hidden =
          !rest && director.bannerRemaining <= 0 && director.state !== "ready";
        byId("wave-banner").classList.toggle("rest", rest);
        byId("wave-label").textContent = rest
          ? "OLEADA SUPERADA"
          : director.state === "ready"
            ? "ESTACIÓN EN ALERTA"
            : "OLEADA " + director.wave;
        byId("wave-detail").textContent = rest
          ? "SIGUIENTE EN " +
            (director.wait / 1000).toFixed(1) +
            " s · RECUPERACIÓN +" +
            SETTINGS.waveHeal
          : director.wave >= 5
            ? director.wave === 6
              ? "EL DESCONECTOR · NÚCLEO HOSTIL"
              : "SEPARADORES DETECTADOS"
            : director.wave >= 3
              ? "IMPULSORES DETECTADOS"
              : "RASTREADORES ENTRANTES";
        byId("mission-instruction").textContent = rest
          ? "Respiren. Reúnanse. Prepárense."
          : "Corten hostiles. Protejan a su compañero.";
      }
      this.players.forEach((p, i) => {
        const name = i === 0 ? "ion" : "flux";
        byId(name + "-health").textContent = p.health + " / " + SETTINGS.playerHealth;
        byId(name + "-health-fill").style.width = (p.health / SETTINGS.playerHealth) * 100 + "%";
        byId(name + "-vital").classList.toggle("critical", p.health <= 30);
        byId(name + "-vital").classList.toggle("immune", p.invulnerable > 0);
        byId(name + "-bar").setAttribute("aria-valuenow", p.health);
      });
    }
    finishSession(pilot, victory = false) {
      if (this.ended || this.mode !== "survival") return;
      this.ended = true;
      this.won = victory;
      this.run.track();
      this.updateHud();
      this.newRecord = this.score > this.bestScore;
      this.bestScore = Math.max(this.bestScore, this.score);
      try {
        localStorage.setItem("volt-mates.best.v3", String(this.bestScore));
      } catch {
        /* Récord en memoria. */
      }
      byId("menu-best").textContent = "RÉCORD " + this.bestScore.toLocaleString("es-PE");

      byId("result-title").textContent = victory
        ? "La estación es de ustedes."
        : "La chispa no se apaga.";
      byId("result-reason").textContent = victory
        ? "EL DESCONECTOR HA CAÍDO"
        : this.run.identity.names[pilot === this.players[0] ? 0 : 1] + " SE QUEDÓ SIN ENERGÍA";

      byId("result-score").textContent = this.score.toLocaleString("es-PE");
      byId("result-waves").textContent = this.director.cleared;
      byId("result-kills").textContent = this.kills;
      byId("result-time").textContent = byId("session-time").textContent;
      byId("result-record").textContent = this.newRecord
        ? "NUEVO RÉCORD DE LA ESTACIÓN"
        : "RÉCORD " + this.bestScore.toLocaleString("es-PE");
      this.ranking.capture();
      this.ui.show("gameover");
      sound.suspended = false;
      sound.play(victory ? "reconnect" : "defeat");
      announce(
        "Conexión perdida. " + this.score + " puntos, " + this.kills + " enemigos cortados.",
      );
    }
    resetSession(mode = this.mode) {
      this.run.track();
      this.mode = mode;
      this.arenaTitle.setText(
        mode === "survival" ? "CÁMARA DE RESISTENCIA" : "CÁMARA DE CALIBRACIÓN",
      );
      this.game.canvas.setAttribute(
        "aria-label",
        mode === "survival"
          ? "Supervivencia Volt-Mates. Ion WASD, Flux flechas. Escape pausa. Protejan la energía de ambos pilotos."
          : "Calibración Volt-Mates. Ion WASD, Flux flechas. Escape pausa. T rearma drones.",
      );
      this.ended = false;
      this.score = 0;
      this.kills = 0;
      this.chain = 0;
      this.multiplier = 1;
      this.comboRemaining = 0;
      this.players.forEach((p) => p.reset());
      this.link.reset();
      this.link.update(0);
      this.link.saveEndpoints();
      this.fx.reset();
      this.clearTargets();
      this.director.reset();
      this.run.reset();
      this.ranking.refreshNames();
      if (mode === "training") this.rearmTargets();
      this.elapsed = 0;
      this.visualTime = 0;
      this.lastSecond = -1;
      this.cameras.main.resetFX();
      this.updateHud();
      this.drawBeam(0);
    }
    updateHud() {
      this.updateCombatHud();
      const l = this.link,
        s = l.state;
      byId("link-hud").dataset.link = s;
      byId("link-status").textContent = {
        stable: "ENLACE ESTABLE",
        strained: "SOBRECARGA " + ((SETTINGS.overloadMs - l.overload) / 1000).toFixed(1) + " s",
        stunned: "VÍNCULO ROTO",
        disconnected: "SIN CONEXIÓN",
      }[s];
      byId("link-distance").textContent = Math.round(l.distance) + " / " + this.run.maxDistance;
      byId("tension-fill").style.width =
        Math.min(100, (l.distance / this.run.maxDistance) * 100) + "%";
      document
        .querySelector(".tension-track")
        .setAttribute(
          "aria-valuenow",
          String(Math.round(Math.min(l.distance, this.run.maxDistance))),
        );
      byId("link-instruction").textContent = {
        stable: "",
        strained: "¡Acérquense antes de que se rompa!",
        stunned: "Descarga crítica. Esperen " + (this.run.stunMs / 1000).toFixed(1) + " s.",
        disconnected: "Acérquense a " + this.run.reconnectDistance + " para reconectar.",
      }[s];
      document.querySelector(".tension-track").setAttribute("aria-valuemax", this.run.maxDistance);
      byId("break-alert").hidden = l.conducting || this.run.rescue.pilot >= 0;
      byId("break-alert").classList.toggle("reconnect", s === "disconnected");
      byId("break-title").textContent = s === "stunned" ? "VÍNCULO ROTO" : "RECONEXIÓN PENDIENTE";
      byId("stun-count").textContent =
        s === "stunned" ? (l.remaining / 1000).toFixed(1) : "ACÉRQUENSE";
      byId("break-description").textContent =
        s === "stunned"
          ? "Sobrecarga. Pilotos aturdidos."
          : "El movimiento vuelve. El rayo aún no.";
      const second = Math.floor(this.elapsed / 1000);
      if (this.lastSecond !== second) {
        this.lastSecond = second;
        byId("session-time").textContent =
          String(Math.floor(second / 60)).padStart(2, "0") +
          ":" +
          String(second % 60).padStart(2, "0");
      }
    }
    update(time, delta) {
      if (!this.ui) return;
      const dt = Math.min(delta, 100);
      this.net.tick(dt);
      this.ui.tick(dt);
      if (this.activeSession && !this.ended) {
        this.elapsed += dt;
        this.visualTime += dt;
        this.link.update(dt);
        this.players.forEach((p, i) => {
          p.invulnerable = Math.max(0, p.invulnerable - dt);
          if (this.net.role === "host" && i === 1)
            p.moveFromBits(this.net.remoteBits, this.link.canMove);
          else p.move(this.link.canMove);
        });
        if (this.mode === "survival") {
          this.comboRemaining = Math.max(0, this.comboRemaining - dt);
          if (!this.comboRemaining) {
            this.chain = 0;
            this.multiplier = 1;
          }
          this.run.update(dt);
          if (!this.ended) this.director.update(dt);
        }
        for (const target of this.targets) {
          if (target.dead || !this.activeSession || this.ended) continue;
          if (this.mode === "survival") target.update(dt);
          if (this.ended) break;
          target.contact = this.link.hits(target.hitbox);
          if (target.contact && this.run.rescue.pilot < 0)
            target.applyDamage((this.run.damage() * dt) / 1000);
          if (this.mode === "survival" && !target.dead) {
            for (const player of this.players) {
              const r = target.hitbox;
              if (
                player.x + 15 >= r.x &&
                player.x - 15 <= r.x + r.width &&
                player.y + 15 >= r.y &&
                player.y - 15 <= r.y + r.height
              ) {
                if (player.takeDamage(target.type.damage)) {
                  const dx = target.x - player.x,
                    dy = target.y - player.y,
                    d = Math.hypot(dx, dy) || 1;
                  target.x = clamp(
                    target.x + (dx / d || 1) * 14,
                    target.radius,
                    800 - target.radius,
                  );
                  target.y = clamp(target.y + (dy / d) * 14, target.radius, 600 - target.radius);
                  target.syncHitbox();
                }
              }
              if (this.ended) break;
            }
          }
          if (this.ended) break;
        }
        if (this.mode === "survival") {
          this.targets = this.targets.filter((t) => {
            if (!t.dead) return true;
            t.destroy();
            return false;
          });
        }
        this.link.saveEndpoints();
        this.updateHud();
      }
      const visualDelta =
        this.activeSession || (this.net.isGuest() && this.ui.state === "playing" && !this.ended)
          ? dt
          : 0;
      this.players.forEach((p) =>
        p.syncVisuals(this.visualTime, visualDelta, this.link.state === "stunned"),
      );
      this.targets.forEach((t) => t.draw(this.visualTime));
      if (this.mode === "survival") this.director.draw(this.visualTime);
      else this.director.graphics.clear();
      this.drawAmbient(this.visualTime);
      this.drawBeam(this.visualTime);
      this.fx.update(visualDelta);
      this.run.draw();
      this.net.afterFrame(dt);
    }
  }

  // Sin setTimeout: una entrada cancelada nunca reabre la partida más tarde.
  class ScreenController {
    constructor(scene) {
      this.scene = scene;
      this.state = "boot";
      this.tutorialReturn = "menu";
      this.settingsReturn = "menu";
      this.step = 0;
      this.menuIndex = 0;
      this.deployRemaining = 0;
      this.lastCount = -1;
      this.resumeState = "playing";
      this.listeners = [];
      this.screens = Object.fromEntries(
        [
          "boot",
          "menu",
          "deploy",
          "tutorial",
          "pause",
          "settings",
          "ranking",
          "identity",
          "gameover",
          "lobby",
          "disconnected",
          "upgrade",
          "workshop",
        ].map((n) => [n === "pause" ? "paused" : n, byId(n + "-screen")]),
      );
      this.menuButtons = [...document.querySelectorAll(".menu-action")];
      this.bindButtons();
      this.listen(document, "keydown", (e) => this.handleKeyboard(e));
      this.listen(window, "blur", () => this.autoPause());
      this.listen(document, "visibilitychange", () => {
        if (document.hidden) this.autoPause();
        sound.updateMix();
      });
      this.listen(document, "fullscreenchange", () => {
        byId("fullscreen-button").setAttribute(
          "aria-label",
          document.fullscreenElement ? "Salir de pantalla completa" : "Entrar en pantalla completa",
        );
        this.scene.scale.refresh();
        this.scene.crispRenderer?.refresh();
      });
      this.show("boot", false);
    }
    listen(target, type, handler) {
      target.addEventListener(type, handler);
      this.listeners.push(() => target.removeEventListener(type, handler));
    }
    bindButtons() {
      const actions = {
        "enter-button": () => {
          this.show("menu");
          sound.suspended = false;
          sound.play("enter");
        },
        "start-button": () => this.start("survival"),
        "online-button": () => this.scene.net.openLobby(),
        "create-room": () => this.scene.net.create(),
        "join-room": () => this.scene.net.join(),
        "copy-room": () => this.scene.net.copyCode(),
        "room-start": () => {
          if (this.scene.net.role === "host" && this.scene.net.ready) this.start("survival");
        },
        "lobby-back": () => this.show("menu"),
        "disconnect-home": () => this.show("menu"),
        "calibrate-button": () => this.start("training"),
        "retry-button": () => this.start(this.scene.mode),
        "result-home-button": () => this.show("menu"),
        "tutorial-button": () => this.openTutorial(),
        "help-button": () => this.openTutorial(),
        "pause-tutorial-button": () => this.openTutorial(),
        "settings-button": () => this.openSettings(),
        "pause-settings-button": () => this.openSettings(),
        "settings-close": () => this.closeSettings(),

        "workshop-button": () => this.scene.run.openWorkshop("menu"),
        "pause-workshop-button": () => this.scene.run.openWorkshop("paused"),
        "lobby-workshop-button": () => this.scene.run.openWorkshop("lobby"),
        "workshop-close": () => this.show(this.scene.run.workshopReturn),
        "workshop-done": () => this.show(this.scene.run.workshopReturn),

        "ranking-button": () => this.scene.ranking.open("menu"),
        "result-ranking-button": () => this.scene.ranking.open("gameover"),
        "ranking-close": () => {
          this.scene.ranking.epoch++;
          this.show(this.scene.ranking.returnState);
        },
        "ranking-refresh": () => this.scene.ranking.load(),
        "ranking-identity-button": () => this.scene.ranking.openIdentity("ranking"),
        "workshop-identity-button": () => this.scene.ranking.openIdentity("workshop"),
        "lobby-identity-button": () => this.scene.ranking.openIdentity("lobby"),
        "identity-close": () => this.scene.ranking.closeIdentity(),
        "pause-button": () => this.pause(),
        "resume-button": () => this.resume(),
        "restart-button": () => this.start(),
        "home-button": () => this.show("menu"),
        "targets-button": () => {
          if (this.state === "playing" && this.scene.mode === "training") this.scene.rearmTargets();
        },
        "tutorial-back": () => {
          this.step = Math.max(0, this.step - 1);
          this.renderTutorial();
        },
        "tutorial-next": () => {
          if (this.step < 3) {
            this.step++;
            this.renderTutorial();
          } else if (this.tutorialReturn === "paused") this.resume();
          else this.start("survival");
        },
        "fullscreen-button": () => this.toggleFullscreen(),
        "sound-button": () => this.toggleSound(),
        "audio-setting": () => this.toggleSound(),
        "music-setting": () => {
          preferences.music = !preferences.music;
          preferences.apply();
          sound.updateMix();
        },
        "motion-setting": () => {
          preferences.reducedMotion = !preferences.reducedMotion;
          preferences.apply();
          if (preferences.reducedMotion) this.scene.cameras.main.resetFX();
        },
      };
      Object.entries(actions).forEach(([id, action]) =>
        this.listen(byId(id), "click", () => {
          sound.unlock();
          action();
        }),
      );
      document.querySelectorAll("[data-close]").forEach((b) =>
        this.listen(b, "click", () => {
          if (b.dataset.close === "tutorial") this.show(this.tutorialReturn);
          else if (b.dataset.close === "settings") this.closeSettings();
          else this.show("menu");
        }),
      );
      this.menuButtons.forEach((b, i) => {
        this.listen(b, "pointerenter", () => this.selectMenu(i, false));
        this.listen(b, "focus", () => this.selectMenu(i, false));
      });
      this.listen(this.scene.game.canvas, "pointerdown", () => {
        if (this.state === "playing") this.scene.game.canvas.focus({ preventScroll: true });
      });
      if (!document.fullscreenEnabled) byId("fullscreen-button").hidden = true;
    }
    selectMenu(index, focus = true) {
      this.menuIndex = (index + this.menuButtons.length) % this.menuButtons.length;
      this.menuButtons.forEach((b, i) => b.classList.toggle("selected", i === this.menuIndex));
      if (focus) this.menuButtons[this.menuIndex].focus({ preventScroll: true });
      sound.suspended = false;
      sound.play("select");
    }
    show(state, focus = true) {
      const net = this.scene.net;
      if (state === "menu" && net?.online) net.stop();
      if (state === "menu" && this.scene.ranking) {
        const p = window.VoltExpedition.profile;
        this.scene.run.identity = { duo: p.duoName, names: [...p.names] };
        this.scene.ranking.refreshNames();
      }
      if (state === "upgrade") this.scene.run.renderOffer();
      if (
        net?.online &&
        !net.applying &&
        ((["playing", "deploy"].includes(this.state) &&
          ["paused", "tutorial", "settings", "workshop"].includes(state)) ||
          (this.state === "paused" && ["tutorial", "settings", "workshop"].includes(state)))
      ) {
        if (["playing", "deploy"].includes(this.state)) this.resumeState = this.state;
        net.pauseLocal();
      }
      this.state = state;
      byId("restart-button").disabled = !!net?.isGuest();
      byId("restart-button").textContent = net?.isGuest()
        ? "EL ANFITRIÓN REINICIA LA PARTIDA"
        : this.scene.mode === "training"
          ? "Reiniciar práctica"
          : "Reiniciar partida";
      byId("retry-button").textContent = net?.isGuest()
        ? "PEDIR REINTENTO ↗"
        : "VOLVER A CONECTAR ↗";
      byId("flux-keys").textContent = net?.online ? "WASD" : "↑←↓→";
      if (state === "playing" && net?.online)
        this.scene.game.canvas.setAttribute(
          "aria-label",
          "Juegas como " +
            (net.role === "host" ? "Ion" : "Flux") +
            ". WASD para moverte. Escape comparte la pausa con tu compañero.",
        );
      document.body.dataset.screen = state;
      sound.setScene(state);
      if (["lobby", "workshop", "upgrade", "identity", "ranking"].includes(state))
        this.scene.input.keyboard.disableGlobalCapture();
      else this.scene.input.keyboard.enableGlobalCapture();
      this.scene.setRunning(state === "playing");
      Object.entries(this.screens).forEach(([n, s]) => {
        s.hidden = n !== state;
      });
      byId("hud").hidden =
        !["playing", "paused"].includes(state) &&
        !(
          ["tutorial", "settings"].includes(state) &&
          (state === "tutorial" ? this.tutorialReturn : this.settingsReturn) === "paused"
        );
      byId("system-controls").hidden = [
        "boot",
        "deploy",
        "gameover",
        "lobby",
        "disconnected",
        "upgrade",
        "workshop",
        "ranking",
        "identity",
      ].includes(state);
      if (state === "menu") {
        this.deployRemaining = 0;
        this.selectMenu(0, false);
      }
      if (["menu", "ranking", "identity", "settings", "tutorial"].includes(state))
        sound.suspended = false;
      announce(
        {
          boot: "Núcleo listo. Enter para entrar.",
          menu: "Menú principal. Flechas para elegir, Enter para confirmar.",
          deploy: "Sincronizando pilotos.",
          playing:
            this.scene.mode === "survival"
              ? "Supervivencia activa. Ion WASD, Flux flechas. Escape pausa."
              : "Calibración activa. WASD, flechas, Escape pausa, T rearma drones.",
          paused: "Simulación en pausa.",
          tutorial: "Manual de enlace.",
          settings: "Ajustes.",
          lobby: "Salas online. Crea una sala o introduce un código.",
          disconnected: "Conexión interrumpida. Partida detenida.",
          ranking: "Ranking de dúos.",
          identity: "Nombres de tu dúo.",
          upgrade: "Elijan una mejora compartida.",
          workshop: "Taller de pilotos. Personaliza tu diseño.",
          gameover: this.scene.won
            ? "Expedición completada."
            : "Conexión perdida. Resultados de la partida.",
        }[state],
      );
      if (focus) {
        const target =
          state === "playing"
            ? this.scene.game.canvas
            : state === "menu"
              ? this.menuButtons[this.menuIndex]
              : this.screens[state]?.querySelector("button:not(:disabled):not([hidden])");
        target?.focus({ preventScroll: true });
      }
      if (net?.role === "host" && !net.applying) net.sendSnapshot();
    }
    start(mode = this.scene.mode) {
      const net = this.scene.net;
      if (net.isGuest()) {
        if (this.state === "gameover") net.send({ t: "restart", round: net.round });
        return;
      }
      if (net.role === "host" && !net.beginRound()) return;
      this.scene.resetSession(mode);
      byId("deploy-title").textContent =
        mode === "survival" ? "Preparando la resistencia." : "Calibrando el vínculo.";
      byId("deploy-tip").textContent =
        mode === "survival"
          ? "Seis oleadas. Mejoras compartidas. Un núcleo que desactivar."
          : "Práctica sin daño. T para rearmar drones.";
      this.deployRemaining = preferences.reducedMotion ? 600 : 2400;
      this.lastCount = -1;
      this.resumeState = "deploy";
      byId("deploy-count").textContent = "3";
      this.show("deploy");
      sound.suspended = false;
      sound.play("enter");
    }
    tick(dt) {
      if (this.scene.net.isGuest() || this.state !== "deploy" || document.hidden) return;
      this.deployRemaining = Math.max(0, this.deployRemaining - dt);
      const count = Math.max(
        1,
        Math.ceil(this.deployRemaining / (preferences.reducedMotion ? 200 : 800)),
      );
      if (count !== this.lastCount) {
        this.lastCount = count;
        byId("deploy-count").textContent = count;
        sound.play("tick");
      }
      if (this.deployRemaining === 0) {
        this.resumeState = "playing";
        this.show("playing");
        if (!preferences.reducedMotion) this.scene.cameras.main.fadeIn(380, 5, 9, 16);
        this.scene.fx.message(400, 285, "CONEXIÓN ESTABLECIDA");
      }
    }
    pause(focus = true) {
      if (!["playing", "deploy"].includes(this.state)) return;
      byId("pause-note").textContent = this.scene.net.online
        ? "LA PAUSA SE COMPARTE CON TU COMPAÑERO"
        : "ESC PARA CONTINUAR";
      this.resumeState = this.state;
      this.show("paused", focus);
    }
    resume() {
      if (this.scene.net.online && !this.scene.net.applying && !this.scene.net.resumeLocal())
        return;
      this.show(this.resumeState);
    }
    autoPause() {
      this.pause(false);
    }
    openTutorial() {
      if (["tutorial", "boot", "deploy"].includes(this.state)) return;
      if (this.state === "playing") {
        this.resumeState = "playing";
        this.tutorialReturn = "paused";
      } else
        this.tutorialReturn =
          this.state === "paused" || (this.state === "settings" && this.settingsReturn === "paused")
            ? "paused"
            : "menu";
      this.step = 0;
      this.renderTutorial();
      this.show("tutorial");
    }
    openSettings() {
      this.settingsReturn =
        ["playing", "paused"].includes(this.state) ||
        (this.state === "tutorial" && this.tutorialReturn === "paused")
          ? "paused"
          : "menu";
      if (this.state === "playing") this.resumeState = "playing";
      this.show("settings");
    }
    closeSettings() {
      this.show(this.settingsReturn);
    }
    toggleSound() {
      preferences.sound = !preferences.sound;
      preferences.apply();
      sound.updateMix();
      if (preferences.sound) {
        sound.unlock();
        sound.play("select");
      }
    }
    renderTutorial() {
      document.querySelector(".tutorial-tension > span").textContent =
        this.scene.run.maxDistance + " UNIDADES";
      document.querySelector(".tutorial-tension > strong").textContent =
        "1 s DE SOBRECARGA → " + this.scene.run.stunMs / 1000 + " s DE ATURDIMIENTO";
      document.querySelector(".tutorial-tension > p").textContent =
        "Acérquense a " + this.scene.run.reconnectDistance + " para reconectar.";
      const steps = [
        [
          "Dos pilotos. Un teclado.",
          "Local: piloto azul con WASD; piloto rosa con flechas. Online: ambos usan WASD desde su equipo.",
        ],
        [
          "El vínculo es el arma.",
          "Rodeen a los enemigos y hagan que crucen el rayo. Esa conexión es su única arma.",
        ],
        [
          "La distancia tiene un precio.",
          "El rojo avisa: acérquense. Si el vínculo se rompe, ambos quedan aturdidos.",
        ],
        [
          "Sobrevivan juntos.",
          "Si tu compañero cae, acércate para rescatarlo. Elijan mejoras juntos y desactiven al jefe de la oleada 6.",
        ],
      ];
      byId("tutorial-title").textContent = steps[this.step][0];
      byId("tutorial-description").textContent = steps[this.step][1];
      byId("step-number").textContent = "0" + (this.step + 1) + " / 04";
      document
        .querySelectorAll(".step-dot")
        .forEach((d, i) => d.classList.toggle("active", i === this.step));
      ["tutorial-controls", "tutorial-link", "tutorial-tension", "tutorial-tips"].forEach(
        (id, i) => {
          byId(id).hidden = i !== this.step;
        },
      );
      byId("tutorial-back").disabled = this.step === 0;
      byId("tutorial-next").textContent =
        this.step < 3
          ? "Siguiente →"
          : this.tutorialReturn === "paused"
            ? "Continuar →"
            : "¡Conectar! →";
      announce("Paso " + (this.step + 1) + " de 4. " + steps[this.step][0]);
    }

    handleKeyboard(e) {
      if (this.state === "identity" && e.code !== "Escape" && e.code !== "Tab") return;
      if (this.state === "identity" && e.code === "Escape") {
        e.preventDefault();
        this.scene.ranking.closeIdentity();
        return;
      }
      if (this.state === "ranking" && e.code === "Escape") {
        e.preventDefault();
        this.scene.ranking.epoch++;
        this.show(this.scene.ranking.returnState);
        return;
      }
      if (
        this.state === "upgrade" &&
        ["Digit1", "Digit2", "Digit3"].includes(e.code) &&
        !e.repeat
      ) {
        e.preventDefault();
        this.scene.run.choose(Number(e.code.slice(-1)) - 1);
        return;
      }
      if (this.state === "workshop" && e.code === "Escape") {
        e.preventDefault();
        this.show(this.scene.run.workshopReturn);
        return;
      }
      if (this.state === "lobby" && e.target instanceof HTMLInputElement) {
        if (e.code === "Enter") {
          e.preventDefault();
          this.scene.net.join();
        } else if (e.code === "Escape") {
          e.preventDefault();
          this.show("menu");
        }
        if (e.code !== "Tab") return;
      }
      if (e.code === "Enter" && this.state === "boot" && !e.repeat) {
        e.preventDefault();
        byId("enter-button").click();
        return;
      }
      if (this.state === "menu" && ["ArrowUp", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) this.selectMenu(this.menuIndex + (e.code === "ArrowDown" ? 1 : -1));
        return;
      }
      if (
        e.code === "Enter" &&
        this.state === "menu" &&
        document.activeElement?.classList.contains("menu-action") &&
        !e.repeat
      ) {
        e.preventDefault();
        this.menuButtons[this.menuIndex].click();
        return;
      }
      if (e.code === "Escape" && !e.repeat) {
        e.preventDefault();
        if (["playing", "deploy"].includes(this.state)) this.pause();
        else if (this.state === "paused") this.resume();
        else if (this.state === "tutorial") this.show(this.tutorialReturn);
        else if (this.state === "settings") this.closeSettings();
        else if (["gameover", "lobby", "disconnected"].includes(this.state)) this.show("menu");
      }
      if (e.code === "KeyR" && ["paused", "gameover"].includes(this.state) && !e.repeat) {
        e.preventDefault();
        this.start();
      }
      if (
        e.code === "KeyT" &&
        this.state === "playing" &&
        this.scene.mode === "training" &&
        !e.repeat
      ) {
        e.preventDefault();
        this.scene.rearmTargets();
      }
      if (e.code === "Tab" && this.state === "playing") this.pause(false);
      if (
        e.code === "Tab" &&
        [
          "paused",
          "tutorial",
          "settings",
          "gameover",
          "lobby",
          "disconnected",
          "workshop",
          "upgrade",
          "ranking",
          "identity",
        ].includes(this.state)
      ) {
        const s = this.screens[this.state],
          buttons = [
            ...s.querySelectorAll("button:not(:disabled), input:not(:disabled):not([readonly])"),
          ].filter((el) => el.getClientRects().length),
          first = buttons[0],
          last = buttons.at(-1),
          inside = s.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    async toggleFullscreen() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await byId("viewport").requestFullscreen();
      } catch {
        announce("Este navegador no permite pantalla completa en este contexto.");
      }
    }
    destroy() {
      this.listeners.forEach((remove) => remove());
    }
  }
  try {
    new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game",
      width: SETTINGS.width,
      height: SETTINGS.height,
      backgroundColor: "#050910",
      render: { antialias: true },
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { keyboard: { capture: [37, 38, 39, 40, 87, 65, 83, 68] } },
      scene: [ArenaScene],
      banner: false,
    });
  } catch (error) {
    console.error("Volt-Mates: fallo al iniciar.", error);
    showError("No se pudo encender el motor gráfico. Prueba con un navegador actualizado.");
  }
})();
