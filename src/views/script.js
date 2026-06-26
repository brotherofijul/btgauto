// src/views/script.js
const LS_TOKENS = "boiauto_tokens";
const LS_COOLDOWN = "boiauto_cooldown";

const SKILL_UI = {
  kisla: "Barak",
  savas_teknikleri: "Teknik Perang",
  bilim_insani: "Ilmuan",
};

const ICONS = {
  success:
    '<svg class="w-3 h-3 text-s1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  warn: '<svg class="w-3 h-3 text-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  error:
    '<svg class="w-3 h-3 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  info: '<svg class="w-3 h-3 text-base-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  retry:
    '<svg class="w-3 h-3 text-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  stopped:
    '<svg class="w-3 h-3 text-base-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
};

function createSlot() {
  return {
    running: false,
    showTk: false,
    error: "",
    token: "",
    skill: "3",
    pay: "1",
    currentLevel: null,
    targetLevel: null,
    pendingAt: null,
    time: "\u2014",
    _timer: null,
  };
}

function spawnParticles() {
  const c = document.getElementById("particles");
  if (!c) return;
  for (let i = 0; i < 14; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const sz = 2 + Math.random() * 2;
    p.style.cssText =
      "left:" +
      Math.random() * 100 +
      "%;width:" +
      sz +
      "px;height:" +
      sz +
      "px;animation-duration:" +
      (14 + Math.random() * 18) +
      "s;animation-delay:" +
      Math.random() * 14 +
      "s;";
    if (i % 3 === 0) p.style.background = "#00c8ff";
    c.appendChild(p);
  }
}

function boiauto() {
  return {
    mode: "diplomacia",
    ws: null,
    wsOk: false,
    wsRetry: 0,
    lastLogId: 0,
    slots: { 1: createSlot(), 2: createSlot() },
    logs: [],
    fSlot: "all",
    fType: "all",
    skills: [
      { value: "1", label: "Barak" },
      { value: "2", label: "Teknik Perang" },
      { value: "3", label: "Ilmuan" },
    ],

    get filteredLogs() {
      return this.logs.filter((l) => {
        if (this.fSlot !== "all" && l.slot !== Number(this.fSlot)) return false;
        if (this.fType !== "all" && l.logType !== this.fType) return false;
        return true;
      });
    },

    init() {
      this.loadTokens();
      this.connectWS();
      spawnParticles();
    },

    loadTokens() {
      try {
        const d = JSON.parse(localStorage.getItem(LS_TOKENS)) || {};
        if (d[1]) this.slots[1].token = d[1];
        if (d[2]) this.slots[2].token = d[2];
      } catch {}
    },

    saveToken(n) {
      try {
        const d = JSON.parse(localStorage.getItem(LS_TOKENS)) || {};
        d[n] = this.slots[n].token;
        localStorage.setItem(LS_TOKENS, JSON.stringify(d));
      } catch {}
    },

    saveCooldown(n) {
      const s = this.slots[n];
      if (!s.pendingAt) return;
      let raw = {};
      try {
        raw = JSON.parse(localStorage.getItem(LS_COOLDOWN)) || {};
      } catch {}
      raw[n] = {
        currentLevel: s.currentLevel,
        targetLevel: s.targetLevel,
        pendingAt: s.pendingAt,
      };
      localStorage.setItem(LS_COOLDOWN, JSON.stringify(raw));
    },

    clearCooldown(n) {
      const s = this.slots[n];
      s.pendingAt = null;
      try {
        const raw = JSON.parse(localStorage.getItem(LS_COOLDOWN)) || {};
        delete raw[n];
        localStorage.setItem(LS_COOLDOWN, JSON.stringify(raw));
      } catch {}
    },

    startCountdown(n) {
      const s = this.slots[n];
      if (s._timer) return;
      const tick = () => {
        if (!s.pendingAt) {
          s.time = "\u2014";
          return;
        }
        const r = new Date(s.pendingAt).getTime() - Date.now();
        s.time = r > 0 ? this.fmtCd(r) : "00:00";
      };
      tick();
      s._timer = setInterval(tick, 500);
    },

    stopCountdown(n) {
      const s = this.slots[n];
      if (s._timer) {
        clearInterval(s._timer);
        s._timer = null;
      }
    },

    connectWS() {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      this.ws = new WebSocket(proto + "//" + location.host + "/ws");
      this.ws.onopen = () => {
        this.wsOk = true;
        this.wsRetry = 0;
      };
      this.ws.onmessage = (e) => {
        try {
          this.handleMsg(JSON.parse(e.data));
        } catch {}
      };
      this.ws.onclose = () => {
        this.wsOk = false;
        setTimeout(
          () => this.connectWS(),
          Math.min(1000 * Math.pow(2, this.wsRetry++), 30000),
        );
      };
      this.ws.onerror = () => {};
    },

    wsSend(data) {
      if (this.ws?.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify(data));
    },

    handleMsg(msg) {
      switch (msg.type) {
        case "init":
        case "sync":
          this.handleServerSync(msg);
          break;

        case "status":
          for (const id of [1, 2]) {
            this.slots[id].running = msg.slots[id]?.running ?? false;
          }
          break;

        case "log":
          this.processLog(msg);
          break;

        case "stopped":
          this.handleStopped(msg);
          break;

        case "error":
          this.handleSlotError(msg);
          break;
      }
    },

    handleServerSync(msg) {
      const st = msg.status || {};
      const cache = msg.cache || {};
      const logs = msg.logs || [];
      this.lastLogId = msg.lastLogId || 0;

      for (const id of [1, 2]) {
        const s = this.slots[id];
        const c = cache[id];
        const slotSt = st[id] || st.slots?.[id];

        if (slotSt) s.running = slotSt.running ?? s.running;

        if (c) {
          if (c.pendingAt) s.pendingAt = c.pendingAt;
          if (c.currentLevel != null) s.currentLevel = c.currentLevel;
          if (c.targetLevel != null) s.targetLevel = c.targetLevel;
        }

        this.stopCountdown(id);
        if (s.pendingAt) {
          const rem = new Date(s.pendingAt).getTime() - Date.now();
          s.time = rem > 0 ? this.fmtCd(rem) : "00:00";
          if (rem > 0 && s.running) this.startCountdown(id);
          this.saveCooldown(id);
        } else {
          s.time = "\u2014";
          this.clearCooldown(id);
        }
      }

      for (const log of logs) {
        if (log._id > this.lastLogId) this.lastLogId = log._id;
        if (!this.logs.some((l) => l._id === log._id)) {
          this.logs.push(this.formatLogEntry(log));
        }
      }
      if (this.logs.length > 600) this.logs = this.logs.slice(-450);
      this.scrollLog();
    },

    processLog(msg) {
      if (msg._id != null) {
        if (msg._id <= this.lastLogId) return;
        this.lastLogId = msg._id;
      }

      const s = this.slots[msg.slot];

      if (msg.logType === "success") {
        msg.text =
          "[" +
          (SKILL_UI[msg.skill] || msg.skill) +
          "] Lv." +
          msg.currentLevel +
          " \u2192 Lv." +
          msg.targetLevel;
        s.currentLevel = msg.currentLevel;
        s.targetLevel = msg.targetLevel;
      } else if (msg.logType === "retry") {
        msg.text =
          "[" +
          (SKILL_UI[msg.skill] || msg.skill) +
          "] Sedang upgrade, menunggu...";
      } else if (
        msg.logType === "info" &&
        msg.skill &&
        msg.text.includes("dibatalkan")
      ) {
        msg.text =
          "[" + (SKILL_UI[msg.skill] || msg.skill) + "] Upgrade dibatalkan.";
      }

      if (msg.pendingAt) {
        s.pendingAt = msg.pendingAt;
        this.stopCountdown(msg.slot);
        this.startCountdown(msg.slot);
        this.saveCooldown(msg.slot);
      }

      this.logs.push(this.formatLogEntry(msg));
      if (this.logs.length > 600) this.logs = this.logs.slice(-450);
      this.scrollLog();
    },

    formatLogEntry(msg) {
      return {
        _id: msg._id ?? 0,
        time: msg.time || this.ts(),
        slot: msg.slot,
        logType: msg.logType,
        text: msg.text,
      };
    },

    handleStopped(msg) {
      const s = this.slots[msg.slot];
      s.running = false;
      this.stopCountdown(msg.slot);
      s.time = "\u2014";
      this.clearCooldown(msg.slot);
      this.logs.push({
        _id: msg._id ?? 0,
        time: this.ts(),
        slot: msg.slot,
        logType: "stopped",
        text: msg.text,
      });
      if (this.logs.length > 600) this.logs = this.logs.slice(-450);
      this.scrollLog();
    },

    handleSlotError(msg) {
      const s = this.slots[msg.slot];
      if (!s) return;
      s.error = msg.text;
      const txt = msg.text;
      setTimeout(() => {
        if (s.error === txt) s.error = "";
      }, 6000);
    },

    startSlot(n) {
      const s = this.slots[n];
      s.error = "";
      this.wsSend({
        action: "start",
        slot: n,
        game: this.mode,
        authorization: s.token,
        skill: s.skill,
        pay: s.pay,
      });
    },

    stopSlot(n) {
      this.wsSend({ action: "stop", slot: n });
    },

    clearLogs() {
      this.logs = [];
    },

    logColor(l) {
      if (l.logType === "success") return l.slot === 1 ? "text-s1" : "text-s2";
      if (l.logType === "warn") return "text-warn";
      if (l.logType === "error") return "text-danger";
      if (l.logType === "stopped") return "text-base-400";
      return "text-base-400";
    },

    logIcon(t) {
      return ICONS[t] || ICONS.info;
    },

    timeClass(n) {
      const s = this.slots[n];
      if (!s.pendingAt) return "text-base-500";
      const rem = new Date(s.pendingAt).getTime() - Date.now();
      if (rem <= 0) return "text-base-500";
      if (rem < 10000) return "text-warn";
      return n === 1 ? "text-s1" : "text-s2";
    },

    timeLow(n) {
      const pa = this.slots[n].pendingAt;
      if (!pa) return false;
      const rem = new Date(pa).getTime() - Date.now();
      return rem > 0 && rem < 10000;
    },

    fmtCd(ms) {
      if (ms <= 0) return "00:00";
      const t = Math.floor(ms / 1000);
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const sec = t % 60;
      const ss = String(sec).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
    },

    ts() {
      return new Date().toTimeString().slice(0, 8);
    },

    scrollLog() {
      this.$nextTick(() => {
        this.$refs.logBox &&
          (this.$refs.logBox.scrollTop = this.$refs.logBox.scrollHeight);
      });
    },
  };
}
