/* Volt-Mates: identidades, ranking de dúos y adaptador REST de Supabase.
 * El resultado se guarda una sola vez por expedición, no al abrir la pantalla. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const MAX_SCORES = 100;
  const normalizeName = (value, max = 16) =>
    typeof value === "string"
      ? value
          .normalize("NFC")
          .replace(/[\p{Cc}<>]/gu, "")
          .replace(/\s+/gu, " ")
          .trim()
          .slice(0, max)
          .replace(/[\uD800-\uDBFF]$/, "")
      : "";
  const validName = (value, max) =>
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    normalizeName(value, max) === value;
  const validIdentity = (value) =>
    value &&
    validName(value.duo, 24) &&
    Array.isArray(value.names) &&
    value.names.length === 2 &&
    value.names.every((n) => validName(n, 16));
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function runId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
    return (
      hex.slice(0, 8) +
      "-" +
      hex.slice(8, 12) +
      "-" +
      hex.slice(12, 16) +
      "-" +
      hex.slice(16, 20) +
      "-" +
      hex.slice(20)
    );
  }
  const compare = (a, b) =>
    b.score - a.score ||
    b.waves - a.waves ||
    a.duration_ms - b.duration_ms ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id);
  const teamKey = (row) =>
    JSON.stringify([
      row.duo_name.toLocaleLowerCase(),
      [row.pilot_one.toLocaleLowerCase(), row.pilot_two.toLocaleLowerCase()].sort(),
    ]);
  const validScore = (row) =>
    row &&
    uuidPattern.test(row.id) &&
    row.season === "expedition-7" &&
    validName(row.duo_name, 24) &&
    validName(row.pilot_one, 16) &&
    validName(row.pilot_two, 16) &&
    Number.isInteger(row.score) &&
    row.score > 0 &&
    row.score <= 1e6 &&
    Number.isInteger(row.waves) &&
    row.waves >= 0 &&
    row.waves <= 6 &&
    Number.isInteger(row.kills) &&
    row.kills >= 0 &&
    row.kills <= 55 &&
    Number.isInteger(row.duration_ms) &&
    row.duration_ms >= 1000 &&
    row.duration_ms <= 7200000 &&
    typeof row.won === "boolean" &&
    row.won === (row.waves === 6) &&
    ["local", "online"].includes(row.mode) &&
    typeof row.created_at === "string" &&
    Number.isFinite(Date.parse(row.created_at));
  const bestTeams = (rows) => {
    const unique = new Map();
    rows
      .filter(validScore)
      .sort(compare)
      .forEach((row) => {
        const key = teamKey(row);
        if (!unique.has(key)) unique.set(key, row);
      });
    return [...unique.values()].sort(compare).slice(0, 20);
  };
  function connectionConfig() {
    const config = window.VOLT_RANKING_CONFIG;
    if (!config?.supabaseUrl || !config?.publishableKey) return null;
    try {
      const url = new URL(config.supabaseUrl),
        key = config.publishableKey;
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        config.season !== "expedition-7"
      )
        return null;
      if (key.startsWith("sb_secret_")) return null;
      if (key.startsWith("sb_publishable_")) return { url: url.origin, key };
      if (
        key.startsWith("eyJ") &&
        JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "anon"
      )
        return { url: url.origin, key };
    } catch {}
    return null;
  }
  class LeagueStore {
    constructor() {
      this.rows = [];
      this.inflight = new Map();
      this.controllers = new Set();
      try {
        const saved = JSON.parse(localStorage.getItem("volt-mates.league.v1") || "[]");
        if (Array.isArray(saved))
          this.rows = saved
            .filter(validScore)
            .slice(0, MAX_SCORES)
            .map((r) => ({ ...r, pending: r.pending === true }));
      } catch {}
    }
    save() {
      try {
        localStorage.setItem("volt-mates.league.v1", JSON.stringify(this.rows));
      } catch {}
    }
    add(entry, pending) {
      if (!validScore(entry)) return false;
      if (this.rows.some((r) => r.id === entry.id)) return false;
      this.rows.unshift({ ...entry, pending });
      this.rows = this.rows.slice(0, MAX_SCORES);
      this.save();
      return true;
    }
    local() {
      return bestTeams([...this.rows]);
    }
    async request(path, options = {}) {
      const config = connectionConfig();
      if (!config) throw Error("not-configured");
      const controller = new AbortController();
      this.controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(config.url + "/rest/v1/" + path, {
          ...options,
          signal: controller.signal,
          headers: { apikey: config.key, "Content-Type": "application/json", ...options.headers },
        });
        if (!response.ok) throw Error("ranking-unavailable");
        return await response.json();
      } finally {
        clearTimeout(timeout);
        this.controllers.delete(controller);
      }
    }
    async submit(entry) {
      if (!validScore(entry)) throw Error("invalid-score");
      if (this.inflight.has(entry.id)) return this.inflight.get(entry.id);
      const payload = { ...entry };
      delete payload.pending;
      delete payload.created_at;
      const task = this.request("rpc/submit_duo_score", {
        method: "POST",
        body: JSON.stringify({ p_entry: payload }),
      })
        .then((id) => {
          if (id !== entry.id) throw Error("invalid-response");
          const row = this.rows.find((r) => r.id === entry.id);
          if (row) {
            row.pending = false;
            this.save();
          }
          return id;
        })
        .finally(() => this.inflight.delete(entry.id));
      this.inflight.set(entry.id, task);
      return task;
    }
    async global() {
      const data = await this.request(
        "duo_leaderboard?season=eq.expedition-7&order=score.desc,waves.desc,duration_ms.asc,created_at.asc,id.asc&limit=20",
      );
      if (!Array.isArray(data)) throw Error("invalid-response");
      return bestTeams(data);
    }
    async flush() {
      for (const row of this.rows.filter((r) => r.pending).slice(0, 5)) await this.submit(row);
    }
    destroy() {
      this.controllers.forEach((c) => c.abort());
      this.controllers.clear();
    }
  }
  const store = new LeagueStore();
  class LeagueUI {
    constructor(scene) {
      this.scene = scene;
      this.returnState = "menu";
      this.identityReturn = "workshop";
      this.scope = connectionConfig() ? "global" : "local";
      this.epoch = 0;
      this.lastId = "";
      this.click = (e) => {
        const tab = e.target.closest("[data-league-scope]");
        if (tab) {
          this.scope = tab.dataset.leagueScope;
          this.load();
        }
      };
      this.submit = (e) => {
        if (e.target.id !== "identity-form") return;
        e.preventDefault();
        this.saveIdentity();
      };
      this.input = () => {
        $("identity-error").textContent = "";
      };
      document.addEventListener("click", this.click);
      document.addEventListener("submit", this.submit);
      $("identity-form").addEventListener("input", this.input);
      this.refreshNames();
    }
    refreshNames() {
      const run = this.scene.run,
        identity = run.identity || {
          duo: window.VoltExpedition.profile.duoName,
          names: window.VoltExpedition.profile.names,
        };
      this.scene.players.forEach((p, i) => {
        if (p.label.text !== identity.names[i]) p.label.setText(identity.names[i]);
      });
      ["ion", "flux"].forEach((role, i) =>
        document.querySelectorAll('[data-name="' + role + '"]').forEach((el) => {
          if (el.textContent !== identity.names[i]) el.textContent = identity.names[i];
          el.title = identity.names[i];
        }),
      );
      document.querySelectorAll("[data-duo-name]").forEach((el) => {
        if (el.textContent !== identity.duo) el.textContent = identity.duo;
      });
      $("ion-seat").querySelector("strong").textContent = identity.names[0];
      $("flux-seat").querySelector("strong").textContent = identity.names[1];
    }
    open(from) {
      this.returnState = from;
      this.scene.ui.show("ranking");
      this.load();
    }
    namesForNextRun() {
      return (
        this.scene.net.round > 0 ||
        ["paused", "gameover"].includes(this.identityReturn) ||
        (this.identityReturn === "ranking" && this.returnState === "gameover") ||
        (this.identityReturn === "workshop" && this.scene.run.workshopReturn === "paused")
      );
    }
    openIdentity(from) {
      this.identityReturn = from;
      const p = window.VoltExpedition.profile,
        n = this.scene.net,
        identity = this.scene.run.identity;
      $("duo-name-input").value = n.isGuest() ? identity.duo : p.duoName;
      $("ion-name-input").value = n.isGuest() ? identity.names[0] : p.names[0];
      $("flux-name-input").value = n.role === "host" ? identity.names[1] : p.names[1];
      $("duo-name-input").readOnly = n.isGuest();
      $("ion-name-input").readOnly = n.isGuest();
      $("flux-name-input").readOnly = n.role === "host";
      $("identity-error").textContent = "";
      $("identity-note").textContent = this.namesForNextRun()
        ? "Los nombres nuevos se usarán en la próxima partida."
        : n.online
          ? "Cada piloto nombra su personaje. El anfitrión elige el nombre del dúo."
          : "Tu dúo llevará estos nombres al ranking.";
      this.scene.ui.show("identity");
    }
    closeIdentity() {
      this.scene.ui.show(this.identityReturn);
      if (this.identityReturn === "workshop") this.scene.run.renderWorkshop();
      if (this.identityReturn === "ranking") this.load();
    }
    saveIdentity() {
      const p = window.VoltExpedition.profile,
        n = this.scene.net,
        duo = normalizeName($("duo-name-input").value, 24),
        names = [
          normalizeName($("ion-name-input").value),
          normalizeName($("flux-name-input").value),
        ];
      if (!validIdentity({ duo, names })) {
        $("identity-error").textContent = "Escribe un nombre para el dúo y para cada piloto.";
        return;
      }
      if (!n.isGuest()) {
        p.duoName = duo;
        p.names[0] = names[0];
      }
      if (n.role !== "host") p.names[1] = names[1];
      p.save();
      if (!this.namesForNextRun()) {
        if (n.role === "local") this.scene.run.identity = { duo: p.duoName, names: [...p.names] };
        else if (n.role === "host")
          this.scene.run.identity = {
            duo: p.duoName,
            names: [p.names[0], n.remoteName || p.names[1]],
          };
        else {
          this.scene.run.identity.names[1] = p.names[1];
          n.send({ t: "identity", name: p.names[1] });
        }
        n.sendIdentity?.();
        this.refreshNames();
      }
      this.closeIdentity();
    }
    capture() {
      const s = this.scene;
      if (s.mode !== "survival" || !s.ended) return;
      const entry = {
        id: s.run.id,
        season: "expedition-7",
        duo_name: s.run.identity.duo,
        pilot_one: s.run.identity.names[0],
        pilot_two: s.run.identity.names[1],
        score: Math.floor(s.score),
        waves: s.director.cleared,
        kills: s.kills,
        duration_ms: Math.round(s.elapsed),
        won: s.won,
        mode: s.net.online ? "online" : "local",
        created_at: new Date().toISOString(),
      };
      if (this.recordedId === entry.id) return;
      this.recordedId = entry.id;
      this.lastId = entry.id;
      if (!validScore(entry)) {
        $("result-league-status").textContent =
          entry.score === 0
            ? "La próxima chispa entrará al ranking."
            : "Esta partida no cumple los requisitos del ranking.";
        return;
      }
      const publish = !s.net.isGuest(),
        added = store.add(entry, publish);
      const rank = store.local().findIndex((row) => row.id === entry.id);
      $("result-league-status").textContent =
        rank >= 0
          ? "PUESTO " + (rank + 1) + " EN ESTE DISPOSITIVO"
          : "RESULTADO GUARDADO EN ESTE DISPOSITIVO";
      if (added && publish && connectionConfig())
        store
          .submit(entry)
          .then(() => {
            if (this.lastId === entry.id)
              $("result-league-status").textContent = "RESULTADO REGISTRADO EN EL RANKING GLOBAL";
          })
          .catch(() => {
            if (this.lastId === entry.id)
              $("result-league-status").textContent = "GUARDADO AQUÍ · ENVÍO GLOBAL PENDIENTE";
          });
    }
    async load() {
      const epoch = ++this.epoch;
      document
        .querySelectorAll("[data-league-scope]")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.leagueScope === this.scope)),
        );
      $("ranking-refresh").disabled = true;
      if (this.scope === "local") {
        this.render(store.local());
        $("ranking-status").textContent = "Mejor partida de cada dúo · Guardado en este navegador.";
        $("ranking-refresh").disabled = false;
        return;
      }
      if (!connectionConfig()) {
        this.render([]);
        $("ranking-empty").textContent = "El ranking global todavía no está disponible.";
        $("ranking-status").textContent =
          "Puedes competir en la clasificación de este dispositivo.";
        $("ranking-refresh").disabled = false;
        return;
      }
      $("ranking-status").textContent = "Buscando las mejores chispas…";
      try {
        await store.flush().catch(() => {});
        const rows = await store.global();
        if (epoch !== this.epoch || this.scene.ui.state !== "ranking") return;
        this.render(rows);
        $("ranking-status").textContent =
          "Dúos de todos los jugadores · Mejor partida de cada equipo.";
      } catch {
        if (epoch !== this.epoch || this.scene.ui.state !== "ranking") return;
        this.render([]);
        $("ranking-empty").textContent = "No pudimos cargar la clasificación.";
        $("ranking-status").textContent =
          "Tus resultados siguen guardados. Puedes volver a intentarlo.";
      } finally {
        if (epoch === this.epoch) $("ranking-refresh").disabled = false;
      }
    }
    render(rows) {
      const list = $("ranking-list");
      list.replaceChildren();
      $("ranking-empty").hidden = rows.length > 0;
      $("ranking-empty").textContent =
        "La primera chispa puede ser la de tu dúo. Juega una expedición para entrar.";
      rows.forEach((row, index) => {
        const item = document.createElement("li");
        item.className = "ranking-row" + (row.id === this.lastId ? " own-result" : "");
        const position = document.createElement("b");
        position.className = "ranking-position";
        position.textContent = index + 1;
        const team = document.createElement("div");
        team.className = "ranking-team";
        const name = document.createElement("strong");
        name.textContent = row.duo_name;
        const pilots = document.createElement("small");
        pilots.textContent = row.pilot_one + " + " + row.pilot_two;
        team.append(name, pilots);
        const details = document.createElement("div");
        details.className = "ranking-details";
        const points = document.createElement("strong");
        points.textContent = row.score.toLocaleString("es-PE");
        const info = document.createElement("small");
        info.textContent =
          (row.won ? "VICTORIA" : "OLEADA " + row.waves) +
          " · " +
          String(Math.floor(row.duration_ms / 60000)).padStart(2, "0") +
          ":" +
          String(Math.floor(row.duration_ms / 1000) % 60).padStart(2, "0") +
          " · " +
          (row.mode === "online" ? "ONLINE" : "LOCAL");
        details.append(points, info);
        item.append(position, team, details);
        list.append(item);
      });
    }
    destroy() {
      document.removeEventListener("click", this.click);
      document.removeEventListener("submit", this.submit);
      $("identity-form").removeEventListener("input", this.input);
      this.epoch++;
      store.destroy();
    }
  }
  window.VoltLeague = Object.freeze({
    normalizeName,
    validName,
    validIdentity,
    runId,
    uuidPattern,
    validScore,
    bestTeams,
    connectionConfig,
    store,
    LeagueUI,
  });
})();
