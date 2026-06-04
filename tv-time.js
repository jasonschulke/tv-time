/* ============================================================
   TV Time — custom Lovelace card
   Drop in /config/www/, register as a resource (module),
   then add to a dashboard with: type: custom:tv-time-card
   No token needed: it uses your logged-in Home Assistant session.
   ============================================================ */

const FONT_URL = "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap";
const ACCENTS = ["#34e3ff", "#8a4bff", "#ff6b35"];
const GHOST_CSS = "position:fixed;z-index:99999;width:56px;height:56px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3b0,#ffd23f 45%,#c98a12 100%);border:2px solid #8a5d05;box-shadow:0 0 18px rgba(255,210,63,1),0 8px 16px rgba(0,0,0,.5);pointer-events:none;transform:translate(-50%,-50%) scale(1.08);";

const DEFAULTS = {
  coin_entity: "input_number.tv_coins_remaining",
  reset_hour: 6,
  minutes_per_coin: 15,
  weekday_coins: 4,
  weekend_coins: 8,
  wallet_slots: 10,
  action_entity: "",                  // e.g. media_player.living_room_tv / switch.tv / script.tv_time
  action_service: "homeassistant.turn_on",
  action_label: "TURN ON TV",
  sound: true,
  music: true,
  music_volume: 0.45,
  shows: [
    { name: "Quick Video", cost: 1 },
    { name: "Episode", cost: 2 },
    { name: "Movie", cost: 8 }
  ]
};

const MUSIC = {
  bpm: 104,
  prog: [
    [130.81, [261.63, 329.63, 392.00, 329.63]],
    [110.00, [261.63, 329.63, 440.00, 329.63]],
    [87.31, [174.61, 261.63, 349.23, 261.63]],
    [98.00, [196.00, 246.94, 392.00, 246.94]]
  ]
};

/* ---- pure helpers ---- */
function coinsHTML(filled, total) { let h = ""; for (let i = 0; i < total; i++) h += '<span class="coin' + (i < filled ? "" : " empty") + '"></span>'; return h; }
function hexGlow(hex) { const h = hex.replace("#", ""); return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) + "," + parseInt(h.substr(4, 2), 16) + ",0.45)"; }
function durLabel(c, mpc) { const m = c * mpc; if (m < 60) return m + " MIN"; if (m % 60 === 0) return (m / 60) + (m === 60 ? " HR" : " HRS"); return Math.floor(m / 60) + "H " + (m % 60) + "M"; }
function fmtCountdown(ms) { const s = Math.max(0, Math.floor(ms / 1000)); const p = (n) => String(n).padStart(2, "0"); return p(Math.floor(s / 3600)) + ":" + p(Math.floor((s % 3600) / 60)) + ":" + p(s % 60); }
const isWeekend = (d) => { const w = d.getDay(); return w === 0 || w === 6; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const STYLES = `
  :host { display:block;
    --bg:#0a0612; --bg2:#140a24; --ink:#f4ecff; --gold:#ffd23f; --gold-deep:#c98a12;
    --magenta:#ff2e88; --cyan:#34e3ff; --lime:#b6ff3c; --purple:#8a4bff;
    --panel:#1b0f31; --panel-edge:#3a2160; --danger:#ff3b5c; --hot1:#ff3b2e; --hot2:#ff9d2f; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  .app { position:relative; display:flex; flex-direction:row; min-height:560px; border-radius:18px; overflow:hidden; color:var(--ink); font-family:'VT323',monospace; user-select:none;
    background:
      radial-gradient(120% 70% at 50% -10%, rgba(138,75,255,.28), transparent 55%),
      radial-gradient(90% 60% at 50% 120%, rgba(52,227,255,.12), transparent 60%),
      linear-gradient(180deg, var(--bg) 0%, var(--bg2) 100%); }
  .scanlines { position:absolute; inset:0; pointer-events:none; z-index:50; background:repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.16) 3px, rgba(0,0,0,0) 4px); mix-blend-mode:multiply; animation:flicker 6s infinite steps(60); }
  @keyframes flicker { 0%,97%{opacity:1} 98%{opacity:.82} 99%{opacity:1} 100%{opacity:.9} }

  .rail { flex:0 0 auto; width:clamp(78px,15vw,128px); display:flex; flex-direction:column; align-items:center; gap:8px; padding:clamp(10px,2vh,16px) 6px; background:linear-gradient(180deg,#06121e,#02060c); border-right:3px solid var(--panel-edge); box-shadow:inset -10px 0 22px rgba(0,0,0,.55); z-index:3; }
  .wallet-label { font-family:'Press Start 2P',monospace; font-size:9px; color:var(--cyan); text-shadow:0 0 8px rgba(52,227,255,.8); letter-spacing:1px; }
  .rack { display:flex; flex-direction:column; gap:clamp(6px,1.1vh,10px); align-items:center; }
  .rack .coin { --sz:clamp(38px,8vw,54px); }

  .main { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; padding:clamp(16px,2.2vw,22px) clamp(10px,2.2vw,22px); gap:clamp(8px,1.6vh,16px); }
  .marquee { text-align:center; flex:0 0 auto; }
  .marquee h1 { font-family:'Press Start 2P',monospace; font-size:clamp(22px,4.5vw,46px); margin:0; letter-spacing:3px; color:var(--gold); text-shadow:0 0 6px var(--gold),0 0 18px rgba(255,210,63,.7),3px 3px 0 var(--gold-deep),0 0 38px rgba(255,46,136,.5); animation:hum 3.5s ease-in-out infinite; }
  .marquee .sub { margin-top:8px; font-size:clamp(15px,2.2vw,22px); color:var(--cyan); letter-spacing:2px; text-shadow:0 0 10px rgba(52,227,255,.7); }
  @keyframes hum { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.18)} }
  .meta { display:flex; gap:18px; justify-content:center; flex-wrap:wrap; align-items:baseline; flex:0 0 auto; }
  .day-tag { font-size:clamp(15px,2vw,22px); letter-spacing:1px; color:var(--lime); text-shadow:0 0 8px rgba(182,255,60,.6); }
  .reset-tag { font-size:clamp(14px,1.8vw,20px); color:#b79be0; }
  .reset-tag b { color:var(--cyan); }

  .coin { --sz:20px; width:var(--sz); height:var(--sz); border-radius:50%; background:radial-gradient(circle at 35% 30%, #fff3b0, var(--gold) 45%, var(--gold-deep) 100%); border:2px solid #8a5d05; box-shadow:0 0 8px rgba(255,210,63,.7), inset 0 -2px 3px rgba(0,0,0,.3); display:inline-block; flex:0 0 auto; position:relative; }
  .coin::after { content:""; position:absolute; inset:22%; border-radius:50%; border:1.5px solid rgba(107,69,0,.55); }
  .coin.empty { background:#160c2a; border:2px dashed #4a2f78; box-shadow:inset 0 0 8px rgba(0,0,0,.6); opacity:.8; }
  .coin.empty::after { border-color:rgba(74,47,120,.5); }
  .rack .coin:not(.empty) { cursor:grab; touch-action:none; animation:coinhint 2.4s ease-in-out infinite; }
  .rack .coin:not(.empty):active { cursor:grabbing; }
  .rack .coin:nth-child(2n){ animation-delay:.3s } .rack .coin:nth-child(3n){ animation-delay:.6s } .rack .coin:nth-child(4n){ animation-delay:.9s }
  @keyframes coinhint { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px); filter:brightness(1.15)} }

  .picker-label { text-align:center; font-family:'Press Start 2P',monospace; font-size:9px; color:#9d86b8; letter-spacing:1px; flex:0 0 auto; }
  .picker { display:flex; gap:clamp(7px,1.4vw,12px); justify-content:center; flex-wrap:nowrap; flex:0 0 auto; width:100%; max-width:560px; margin:0 auto; }
  .chip { flex:1 1 0; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; padding:clamp(10px,1.6vw,16px) clamp(6px,1.2vw,14px); border-radius:14px; background:linear-gradient(180deg,var(--panel),#110826); border:3px solid var(--panel-edge); cursor:pointer; transition:.15s; position:relative; }
  .chip .ctime { font-family:'Press Start 2P',monospace; font-size:clamp(12px,2.3vw,20px); color:var(--gold); text-shadow:0 0 10px rgba(255,210,63,.6); line-height:1.3; }
  .chip .cname { font-size:clamp(13px,1.8vw,17px); color:#9d86b8; letter-spacing:.5px; text-align:center; }
  .chip.selected { border-color:var(--lime); box-shadow:0 0 18px rgba(182,255,60,.45); transform:translateY(-3px); }
  .chip.selected .ctime { color:var(--lime); text-shadow:0 0 12px var(--lime); }

  .slot-panel { display:flex; flex-direction:column; align-items:center; gap:clamp(10px,2vh,16px); margin:0 auto; max-width:340px; width:100%; padding:clamp(16px,3vw,28px); border-radius:24px; background:linear-gradient(180deg,var(--panel),#0d0620); border:3px solid var(--panel-edge); box-shadow:0 8px 0 #0a0418, 0 14px 30px rgba(0,0,0,.5), inset 0 0 22px rgba(138,75,255,.12); flex:0 0 auto; }
  .slot-panel .sp-name { font-family:'Press Start 2P',monospace; font-size:clamp(13px,2.2vw,18px); color:var(--ink); letter-spacing:1px; }
  .slot-panel .door .coin { --sz:clamp(40px,9vw,56px); }

  .door { padding:16px 16px 17px; border-radius:18px; position:relative; border:4px solid transparent; background:linear-gradient(#0c0508,#0c0508) padding-box, linear-gradient(135deg,var(--hot1),var(--hot2),var(--hot1)) border-box; box-shadow:0 0 20px rgba(255,90,40,.4), inset 0 0 20px rgba(0,0,0,.85); transition:transform .12s, box-shadow .12s, filter .12s; }
  .door .channel { width:34px; height:10px; margin:0 auto 14px; border-radius:5px; background:#000; box-shadow:0 0 14px var(--hot2), inset 0 0 7px var(--hot1); }
  .door .slots { display:flex; flex-direction:column; gap:8px; justify-content:center; align-items:center; margin:0 auto; }
  .door .slots.two-col { display:grid; grid-template-columns:repeat(2, auto); gap:8px; justify-items:center; align-items:center; }
  .door .coin { --sz:clamp(36px,8vw,48px); }
  .door .coin.empty { border:2px dashed var(--hot2); background:#160a08; box-shadow:inset 0 0 10px rgba(255,90,40,.25), 0 0 8px rgba(255,90,40,.2); animation:slotpulse 1.7s ease-in-out infinite; }
  .door .coin.empty::after { border-color:rgba(255,140,60,.4); }
  @keyframes slotpulse { 0%,100%{box-shadow:inset 0 0 10px rgba(255,90,40,.25), 0 0 6px rgba(255,90,40,.15)} 50%{box-shadow:inset 0 0 14px rgba(255,140,60,.55), 0 0 18px rgba(255,140,60,.55)} }
  .door.hot { transform:scale(1.05); box-shadow:0 0 30px rgba(255,157,47,.9), inset 0 0 20px rgba(255,59,46,.45); filter:brightness(1.15); }
  .door.complete { animation:doorwin .5s ease; }
  @keyframes doorwin { 0%{box-shadow:0 0 0 rgba(182,255,60,0)} 40%{box-shadow:0 0 44px rgba(182,255,60,.95), inset 0 0 26px rgba(182,255,60,.5); filter:brightness(1.5)} 100%{box-shadow:inset 0 0 20px rgba(0,0,0,.8)} }
  .door.complete .coin:not(.empty) { animation:coinsink .42s ease forwards; }
  @keyframes coinsink { to{ transform:scale(.2) translateY(8px); opacity:0 } }

  @media (max-width:430px){ .rail{ width:clamp(70px,20vw,92px);} .rack .coin{ --sz:clamp(34px,9vw,46px);} }

  .ready-overlay { position:absolute; inset:0; z-index:80; display:none; align-items:center; justify-content:center; background:rgba(4,2,10,.85); backdrop-filter:blur(3px); }
  .ready-overlay.show { display:flex; animation:fade .2s ease; }
  @keyframes fade { from{opacity:0} to{opacity:1} }
  .ready-card { position:relative; background:linear-gradient(180deg,var(--panel),#0d0620); border:4px solid var(--lime); border-radius:26px; padding:34px 30px 30px; text-align:center; max-width:420px; width:88%; box-shadow:0 0 0 3px #000, 0 0 50px rgba(182,255,60,.45); animation:pop .3s cubic-bezier(.2,1.3,.5,1); }
  @keyframes pop { from{transform:scale(.8);opacity:0} to{transform:scale(1);opacity:1} }
  .ready-card .art { font-size:64px; color:var(--lime); text-shadow:0 0 18px var(--lime); }
  .ready-card h2 { font-family:'Press Start 2P',monospace; font-size:clamp(14px,3vw,20px); color:var(--lime); text-shadow:0 0 14px var(--lime); margin:12px 0 6px; line-height:1.6; }
  .ready-time { font-family:'Press Start 2P',monospace; font-size:clamp(16px,3vw,24px); color:var(--gold); text-shadow:0 0 12px rgba(255,210,63,.6); margin:0 0 22px; }
  .ready-primary { font-family:'Press Start 2P',monospace; font-size:clamp(13px,2.6vw,18px); background:var(--lime); color:#173500; border:3px solid #000; border-radius:16px; padding:20px 22px; cursor:pointer; box-shadow:0 6px 0 rgba(0,0,0,.6); width:100%; line-height:1.4; }
  .ready-primary:active { transform:translateY(4px); box-shadow:0 2px 0 rgba(0,0,0,.6); }
  .ready-x { position:absolute; top:8px; right:14px; background:none; border:none; color:#9d86b8; font-size:26px; cursor:pointer; line-height:1; }

  .gameover { position:absolute; inset:0; z-index:75; display:none; flex-direction:column; align-items:center; justify-content:center; gap:16px; background:radial-gradient(circle at 50% 38%, rgba(138,75,255,.22), transparent 60%), rgba(6,2,12,.97); text-align:center; padding:24px; }
  .gameover.show { display:flex; }
  .gameover .moon { font-size:clamp(60px,12vw,110px); filter:drop-shadow(0 0 24px rgba(255,210,63,.5)); animation:bob 3s ease-in-out infinite; }
  @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
  .gameover h2 { font-family:'Press Start 2P',monospace; font-size:clamp(20px,5vw,40px); color:var(--gold); text-shadow:0 0 14px rgba(255,210,63,.7),3px 3px 0 #5c3a00; margin:0; }
  .gameover .reset-big { font-family:'VT323',monospace; font-size:clamp(18px,2.6vw,26px); color:#b79be0; margin:4px 0 0; }
  .gameover .reset-big b { color:var(--cyan); }
  .gameover .rack { flex-direction:row; flex-wrap:wrap; justify-content:center; max-width:80%; overflow:visible; flex:0 0 auto; }
  .gameover .rack .coin { --sz:34px; }

  .music-toggle { position:absolute; bottom:12px; left:12px; z-index:60; background:rgba(20,10,36,.8); border:2px solid var(--panel-edge); color:var(--cyan); font-size:18px; width:40px; height:40px; border-radius:10px; cursor:pointer; line-height:1; }
  .music-toggle.off { color:#5a4a78; }
  .music-toggle.off::after { content:""; position:absolute; left:6px; right:6px; top:50%; height:2px; background:#5a4a78; transform:rotate(-30deg); }

  .toast { position:absolute; left:50%; bottom:28px; transform:translateX(-50%) translateY(220%); z-index:70; background:var(--panel); color:var(--ink); font-family:'VT323',monospace; font-size:22px; padding:12px 22px; border-radius:12px; border:3px solid var(--panel-edge); box-shadow:0 0 24px rgba(0,0,0,.7); transition:transform .3s cubic-bezier(.2,1.3,.5,1); letter-spacing:1px; }
  .toast.show { transform:translateX(-50%) translateY(0); }
`;

const MARKUP = `
  <div class="app" id="app">
    <div class="scanlines"></div>
    <button class="music-toggle" id="musicToggle">&#127925;</button>
    <aside class="rail">
      <div class="wallet-label">COINS</div>
      <div class="rack" id="rack"></div>
    </aside>
    <main class="main">
      <div class="marquee">
        <h1>TV TIME</h1>
        <div class="sub" id="sub">DRAG A COIN IN!</div>
      </div>
      <div class="meta">
        <span class="day-tag" id="dayTag">&#9728; TODAY</span>
        <span class="reset-tag" id="resetTag">more coins in <b>--:--:--</b></span>
      </div>
      <div class="picker-label">GROWN-UP: PICK A TIME</div>
      <div class="picker" id="picker"></div>
      <div class="slot-panel" id="slotPanel">
        <div class="sp-name" id="spName"></div>
        <div class="door" id="slot"><div class="channel"></div><div class="slots"></div></div>
      </div>
    </main>
    <div class="ready-overlay" id="ready">
      <div class="ready-card">
        <button class="ready-x" id="readyX">&#10006;</button>
        <div class="art">&#9654;</div>
        <h2>READY TO PLAY!</h2>
        <div class="ready-time" id="readyTime"></div>
        <button class="ready-primary" id="readyPrimary">&#9654;</button>
      </div>
    </div>
    <div class="gameover" id="gameover">
      <div class="moon">&#127769;</div>
      <h2>ALL DONE!</h2>
      <div class="rack" id="goRack"></div>
      <p class="reset-big" id="goReset">more coins in --:--:--</p>
    </div>
    <div class="toast" id="toast"></div>
  </div>
`;

class TvTimeCard extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._hass = null; this._cfg = null;
    this._credits = 0; this._active = 0; this._staged = 0;
    this._busy = false; this._drag = null;
    this._audioCtx = null; this._musicGain = null;
    this._music = { on: true, step: 0, nextTime: 0, timer: null };
    this._seq = null; this._built = false; this._tick = null; this._toastTimer = null;
    this._boundMove = (e) => this._onMove(e);
    this._boundUp = (e) => this._onUp(e);
  }

  /* ---- config ---- */
  setConfig(config) {
    const cfg = Object.assign({}, DEFAULTS, config || {});
    cfg.shows = (config && config.shows && config.shows.length)
      ? config.shows.map((s) => Object.assign({}, s))
      : DEFAULTS.shows.map((s) => Object.assign({}, s));
    cfg.shows.forEach((s, i) => { if (!s.accent) s.accent = ACCENTS[i % ACCENTS.length]; });
    this._cfg = cfg;
    this._music.on = !!cfg.music;
    this._seq = this._buildSequence();
    this._staged = 0;
    this._credits = this._todaysAllotment();
    this._active = this._chooseDefault();
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._cfg) return;
    const st = hass.states[this._cfg.coin_entity];
    if (st && st.state !== "unknown" && st.state !== "unavailable") {
      const v = Math.round(parseFloat(st.state));
      if (!isNaN(v) && !this._busy && this._staged === 0 && v !== this._credits) {
        this._credits = v;
        this._render();
      }
    }
  }

  getCardSize() { return 9; }
  static getStubConfig() { return { coin_entity: "input_number.tv_coins_remaining" }; }

  connectedCallback() {
    if (this._built && !this._tick) this._startCountdown();
    if (this._built && this._music.on && this._audioCtx) this._startMusic();
  }
  disconnectedCallback() {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
    if (this._music.timer) { clearTimeout(this._music.timer); this._music.timer = null; }
    window.removeEventListener("pointermove", this._boundMove);
    window.removeEventListener("pointerup", this._boundUp);
  }

  /* ---- build / render ---- */
  _injectFont() {
    if (document.getElementById("tvtime-font")) return;
    const l = document.createElement("link");
    l.id = "tvtime-font"; l.rel = "stylesheet"; l.href = FONT_URL;
    document.head.appendChild(l);
  }
  _build() {
    this._injectFont();
    this._root.innerHTML = "<style>" + STYLES + "</style>" + MARKUP;
    this._buildPicker();
    this._wire();
    this._startCountdown();
    this._render();
    this._built = true;
  }
  _buildPicker() {
    const picker = this._root.getElementById("picker");
    picker.innerHTML = "";
    this._cfg.shows.forEach((s, i) => {
      const chip = document.createElement("div");
      chip.className = "chip"; chip.dataset.idx = i;
      chip.innerHTML = '<div class="ctime">' + durLabel(s.cost, this._cfg.minutes_per_coin) + '</div><div class="cname">' + s.name + "</div>";
      picker.appendChild(chip);
    });
  }
  _render() {
    if (!this._built && !this._root.getElementById("rack")) return;
    const cfg = this._cfg;
    const total = Math.max(cfg.wallet_slots, this._credits);
    this._root.getElementById("rack").innerHTML = coinsHTML(this._available(), total);
    this._root.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("selected", +c.dataset.idx === this._active);
    });
    const show = cfg.shows[this._active];
    this._root.getElementById("spName").textContent = show.name;
    this._root.getElementById("slotPanel").style.setProperty("--accentglow", hexGlow(show.accent || "#34e3ff"));
    const slotsEl = this._root.querySelector("#slot .slots");
    slotsEl.classList.toggle("two-col", this._cost(this._active) > 4);
    slotsEl.innerHTML = coinsHTML(this._staged, this._cost(this._active));
    const done = this._credits < this._cheapest();
    this._root.getElementById("gameover").classList.toggle("show", done);
    if (done) this._root.getElementById("goRack").innerHTML = coinsHTML(0, cfg.wallet_slots);
    this._root.getElementById("sub").textContent = done ? "SEE YOU TOMORROW" : "DRAG A COIN IN!";
  }

  /* ---- day / countdown ---- */
  _todaysAllotment() { return isWeekend(new Date()) ? this._cfg.weekend_coins : this._cfg.weekday_coins; }
  _nextReset() { const now = new Date(), r = new Date(now); r.setHours(this._cfg.reset_hour, 0, 0, 0); if (r <= now) r.setDate(r.getDate() + 1); return r; }
  _chooseDefault() { for (let i = 0; i < this._cfg.shows.length; i++) if (this._cost(i) <= this._credits) return i; return 0; }
  _tickCountdown() {
    const t = fmtCountdown(this._nextReset() - new Date());
    this._root.getElementById("resetTag").innerHTML = "more coins in <b>" + t + "</b>";
    this._root.getElementById("goReset").innerHTML = "more coins in <b>" + t + "</b>";
    this._root.getElementById("dayTag").innerHTML = isWeekend(new Date()) ? "&#9733; WEEKEND" : "&#9728; WEEKDAY";
  }
  _startCountdown() { if (this._tick) clearInterval(this._tick); this._tickCountdown(); this._tick = setInterval(() => this._tickCountdown(), 1000); }

  /* ---- math ---- */
  _available() { return this._credits - this._staged; }
  _cost(i) { return this._cfg.shows[i].cost; }
  _cheapest() { return Math.min.apply(null, this._cfg.shows.map((s) => s.cost)); }

  /* ---- audio ---- */
  _ensureAudio() {
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this._musicGain = this._audioCtx.createGain();
      this._musicGain.gain.value = this._music.on ? this._cfg.music_volume : 0;
      this._musicGain.connect(this._audioCtx.destination);
    }
  }
  _beep(freq, dur, type, vol) {
    if (!this._cfg.sound) return;
    try {
      this._ensureAudio(); const c = this._audioCtx;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || "square"; o.frequency.value = freq; g.gain.value = vol == null ? 0.06 : vol;
      o.connect(g); g.connect(c.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur); o.stop(c.currentTime + dur);
    } catch (e) {}
  }
  _pick() { this._beep(740, 0.05, "square", 0.05); }
  _drop() { this._beep(988, 0.07, "square", 0.07); setTimeout(() => this._beep(1319, 0.11, "square", 0.07), 65); }
  _win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._beep(f, 0.12, "square", 0.06), i * 90)); }
  _buzz() { this._beep(120, 0.22, "sawtooth", 0.08); }
  _buildSequence() { const seq = []; MUSIC.prog.forEach((bar) => { const bass = bar[0], arp = bar[1]; arp.forEach((f, i) => seq.push({ lead: f, bass: i === 0 ? bass : null })); }); return seq; }
  _voice(freq, t, dur, type, vol) {
    const c = this._audioCtx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this._musicGain); o.start(t); o.stop(t + dur + 0.05);
  }
  _musicTick() {
    const b = 60 / MUSIC.bpm, c = this._audioCtx;
    while (this._music.nextTime < c.currentTime + 0.25) {
      const s = this._seq[this._music.step];
      this._voice(s.lead, this._music.nextTime, b * 0.85, "square", 0.07);
      if (s.bass) this._voice(s.bass, this._music.nextTime, b * 1.8, "triangle", 0.09);
      this._music.nextTime += b;
      this._music.step = (this._music.step + 1) % this._seq.length;
    }
    this._music.timer = setTimeout(() => this._musicTick(), 60);
  }
  _startMusic() {
    this._ensureAudio();
    if (this._audioCtx.state === "suspended") this._audioCtx.resume();
    if (!this._music.timer) { this._music.nextTime = this._audioCtx.currentTime + 0.12; this._musicTick(); }
  }
  _toggleMusic() {
    this._music.on = !this._music.on;
    if (this._musicGain) this._musicGain.gain.value = this._music.on ? this._cfg.music_volume : 0;
    if (this._music.on) this._startMusic();
    this._root.getElementById("musicToggle").classList.toggle("off", !this._music.on);
  }

  /* ---- drag + drop ---- */
  _overSlot(x, y) { const r = this._root.getElementById("slot").getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
  _canDrop() { return this._staged < this._cost(this._active) && this._available() >= 1; }
  _beginDrag(e, source) {
    if (this._busy) return;
    if (source === "rack" && this._available() <= 0) return;
    if (source === "slot" && this._staged <= 0) return;
    const g = document.createElement("div");
    g.style.cssText = GHOST_CSS + "left:" + e.clientX + "px;top:" + e.clientY + "px;";
    document.body.appendChild(g);
    this._drag = { source, ghost: g };
    window.addEventListener("pointermove", this._boundMove);
    window.addEventListener("pointerup", this._boundUp);
    e.preventDefault();
    this._pick();
  }
  _onMove(e) {
    if (!this._drag) return;
    this._drag.ghost.style.left = e.clientX + "px";
    this._drag.ghost.style.top = e.clientY + "px";
    this._root.getElementById("slot").classList.toggle("hot", this._drag.source === "rack" && this._overSlot(e.clientX, e.clientY) && this._canDrop());
  }
  _onUp(e) {
    window.removeEventListener("pointermove", this._boundMove);
    window.removeEventListener("pointerup", this._boundUp);
    const on = this._overSlot(e.clientX, e.clientY);
    if (this._drag.source === "rack") {
      if (on && this._canDrop()) { this._staged++; this._drop(); this._render(); if (this._staged === this._cost(this._active)) this._complete(); }
      else if (on) this._buzz();
    } else {
      if (!on) { this._staged--; this._drop(); this._render(); }
    }
    if (this._drag) this._drag.ghost.remove();
    this._drag = null;
    this._root.getElementById("slot").classList.remove("hot");
  }

  async _complete() {
    this._busy = true;
    const door = this._root.getElementById("slot");
    door.classList.add("complete"); this._win(); await wait(460);
    const show = this._cfg.shows[this._active];
    this._credits -= show.cost; this._staged = 0;
    door.classList.remove("complete"); this._render();
    if (this._hass) {
      try { await this._hass.callService("input_number", "set_value", { entity_id: this._cfg.coin_entity, value: this._credits }); }
      catch (err) { this._toast("could not update Home Assistant"); }
    }
    this._busy = false;
    this._showReady(show);
  }

  /* ---- ready overlay ---- */
  _showReady(show) {
    this._root.getElementById("readyTime").textContent = durLabel(show.cost, this._cfg.minutes_per_coin);
    const p = this._root.getElementById("readyPrimary");
    if (this._cfg.action_entity) { p.textContent = this._cfg.action_label; p.dataset.fire = "1"; }
    else { p.innerHTML = "&#9654;"; p.dataset.fire = "0"; }
    this._root.getElementById("ready").classList.add("show");
  }
  _closeReady() { this._root.getElementById("ready").classList.remove("show"); }
  async _fireAction() {
    if (!this._cfg.action_entity || !this._hass) return;
    const svc = this._cfg.action_service, i = svc.indexOf(".");
    try { await this._hass.callService(svc.slice(0, i), svc.slice(i + 1), { entity_id: this._cfg.action_entity }); }
    catch (e) { this._toast("could not reach " + this._cfg.action_entity); }
  }
  _toast(msg) {
    const t = this._root.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(this._toastTimer); this._toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ---- events ---- */
  _wire() {
    const app = this._root.getElementById("app");
    app.addEventListener("pointerdown", (e) => {
      const coin = e.target.closest(".coin");
      if (!coin || coin.classList.contains("empty") || this._busy) return;
      if (coin.closest("#rack")) this._beginDrag(e, "rack");
      else if (coin.closest("#slot")) this._beginDrag(e, "slot");
    });
    this._root.getElementById("picker").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip"); if (!chip) return;
      const i = +chip.dataset.idx;
      if (i !== this._active) { this._staged = 0; this._active = i; this._pick(); this._render(); }
    });
    this._root.getElementById("readyPrimary").addEventListener("click", async (e) => {
      if (e.currentTarget.dataset.fire === "1") await this._fireAction();
      this._closeReady();
    });
    this._root.getElementById("readyX").addEventListener("click", () => this._closeReady());
    this._root.getElementById("ready").addEventListener("click", (e) => { if (e.target.id === "ready") this._closeReady(); });
    this._root.getElementById("musicToggle").addEventListener("click", () => this._toggleMusic());
    const kick = () => {
      this._ensureAudio();
      if (this._audioCtx.state === "suspended") this._audioCtx.resume();
      if (this._music.on) this._startMusic();
      app.removeEventListener("pointerdown", kick);
    };
    app.addEventListener("pointerdown", kick);
  }
}

if (!customElements.get("tv-time-card")) customElements.define("tv-time-card", TvTimeCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "tv-time-card", name: "TV Time", description: "Retro arcade coin-drop TV-time meter for kids", preview: false });
console.info("%c TV-TIME-CARD %c loaded ", "background:#ffd23f;color:#1b0f31;font-weight:700", "background:#1b0f31;color:#ffd23f");
