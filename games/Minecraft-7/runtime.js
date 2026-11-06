// ─────────────────────────── audio (synthesised) ───────────────────────────
let audio = null, master = null, noiseBuf = null, muted = true;
const lastSfx = {};
function wake() {
  if (muted) return;
  try {
    if (!audio) { audio = new (window.AudioContext || window.webkitAudioContext)(); master = audio.createGain(); master.gain.value = 0.55 * volOf('volMaster'); master.connect(audio.destination); const n = audio.sampleRate; noiseBuf = audio.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    if (audio.state === 'suspended') audio.resume().catch(() => { });
  } catch { }
}
const volOf = k => SAVE && SAVE.settings ? clamp((SAVE.settings[k] ?? 100) / 100, 0, 1) : 1;
function updateVolume() { if (master) master.gain.value = 0.55 * volOf('volMaster'); }
const SFX_CAT = n => /^(break|dig|place|step)_/.test(n) || n === 'boom' || n === 'fuse' || n === 'bucket' || n === 'chest' ? 'volBlocks' : /^(pig|cow|sheep|zhurt|groan|hiss|shurt|mhurt)$/.test(n) ? 'volMobs' : n === 'click' ? 'volMaster' : 'volPlayer';
function sfx(name, vol = 1) {
  if (muted || !audio || audio.state !== 'running') return;
  if (name !== 'click') vol *= volOf(SFX_CAT(name)); if (vol <= 0.001) return;
  const now = audio.currentTime; if (lastSfx[name] && now - lastSfx[name] < 0.03) return; lastSfx[name] = now;
  const t = now;
  const tone = (type, f0, f1, dur, v, delay = 0) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t + delay); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + delay + dur); g.gain.setValueAtTime(0.0001, t + delay); g.gain.exponentialRampToValueAtTime(v * vol, t + delay + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); o.connect(g).connect(master); o.start(t + delay); o.stop(t + delay + dur + 0.02); };
  const noise = (dur, freq, q, v, type = 'bandpass', delay = 0) => { const s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(v * vol, t + delay); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); s.connect(f).connect(g).connect(master); s.start(t + delay, Math.random() * 0.5); s.stop(t + delay + dur + 0.02); };
  const mat = name.split('_')[1];
  const matF = { stone: 1100, wood: 520, dirt: 380, sand: 1600, grass: 2400, glass: 3800, soft: 700 }[mat] || 800;
  if (name.startsWith('break_')) { noise(0.2, matF, 0.9, 0.55); if (mat === 'glass') tone('sine', 2200, 1300, 0.25, 0.08); if (mat === 'wood') tone('triangle', 180, 110, 0.09, 0.12); }
  else if (name.startsWith('dig_')) noise(0.08, matF, 1, 0.3);
  else if (name.startsWith('place_')) { noise(0.09, matF * 0.8, 1, 0.5); tone('triangle', 160, 120, 0.05, 0.08); }
  else if (name.startsWith('step_')) noise(0.05, matF * 0.7, 1.2, 0.18);
  else switch (name) {
    case 'pop': tone('sine', 700, 1300, 0.07, 0.12); break;
    case 'hurt': tone('square', 240, 120, 0.16, 0.07); noise(0.1, 600, 1, 0.2); break;
    case 'mhurt': case 'pig': tone('sawtooth', 320, 220, 0.18, 0.05); tone('sawtooth', 300, 200, 0.12, 0.04, 0.12); break;
    case 'cow': tone('sawtooth', 130, 95, 0.6, 0.05); break;
    case 'sheep': tone('sawtooth', 380, 360, 0.25, 0.035); tone('sawtooth', 360, 330, 0.25, 0.03, 0.1); break;
    case 'zhurt': case 'groan': { const o = audio.createOscillator(), g = audio.createGain(), l = audio.createOscillator(), lg = audio.createGain(); o.type = 'sawtooth'; o.frequency.value = name === 'zhurt' ? 150 : 95; l.frequency.value = 7; lg.gain.value = 12; l.connect(lg).connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * vol, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(g).connect(master); o.start(t); l.start(t); o.stop(t + 0.75); l.stop(t + 0.75); break; }
    case 'hiss': case 'shurt': noise(0.35, 5000, 0.7, 0.18); break;
    case 'boom': noise(1.4, 300, 0.5, 1, 'lowpass'); tone('sine', 70, 28, 0.9, 0.5); break;
    case 'fuse': noise(0.5, 4500, 0.5, 0.2); break;
    case 'eat': noise(0.07, 1400, 1.5, 0.35); break;
    case 'burp': tone('sawtooth', 180, 90, 0.22, 0.06); break;
    case 'craft': tone('triangle', 520, 780, 0.07, 0.08); break;
    case 'toolbreak': noise(0.25, 3000, 1, 0.4); tone('square', 900, 300, 0.2, 0.05); break;
    case 'bucket': noise(0.3, 700, 0.8, 0.4, 'lowpass'); break;
    case 'chest': tone('triangle', 170, 120, 0.16, 0.12); break;
    case 'click': tone('square', 1250, 700, 0.035, 0.035); noise(0.03, 2600, 1.2, 0.12); break;
    case 'equip': noise(0.12, 900, 0.8, 0.35); tone('triangle', 330, 260, 0.08, 0.06); break;
    case 'bow': noise(0.18, 1800, 0.6, 0.3); tone('triangle', 420, 160, 0.14, 0.07); break;
    case 'arrowhit': noise(0.08, 1200, 1.4, 0.4); tone('triangle', 260, 140, 0.06, 0.06); break;
    case 'shear': noise(0.06, 4200, 2, 0.3); noise(0.06, 3800, 2, 0.3, 'bandpass', 0.09); break;
    case 'strong': noise(0.1, 900, 1, 0.5); tone('triangle', 200, 110, 0.08, 0.1); break;
    case 'weak': noise(0.07, 1400, 1.2, 0.25); break;
    case 'knock': noise(0.14, 600, 0.8, 0.6); tone('triangle', 150, 80, 0.12, 0.12); break;
    case 'crit': noise(0.12, 2600, 1.5, 0.5); tone('square', 1300, 700, 0.1, 0.05); break;
    case 'sweep': noise(0.22, 2000, 0.5, 0.35, 'bandpass'); break;
    case 'note': tone('triangle', 440 * Math.pow(2, Math.floor(Math.random() * 12) / 12), 430, 0.5, 0.1); break;
    case 'bell': tone('sine', 1320, 1300, 1.6, 0.12); tone('sine', 660, 655, 1.8, 0.08); tone('sine', 1980, 1960, 0.9, 0.04); break;
    // instruments (extras.js): each plays a short phrase from a pentatonic scale
    case 'x_flute': case 'x_ocarina': case 'x_harp': case 'x_chime': case 'x_horn': {
      const steps = [0, 2, 4, 7, 9, 12], base = { x_flute: 660, x_ocarina: 520, x_harp: 392, x_chime: 1046, x_horn: 196 }[name];
      const wave = { x_flute: 'sine', x_ocarina: 'sine', x_harp: 'triangle', x_chime: 'sine', x_horn: 'sawtooth' }[name], len = name === 'x_chime' ? 1.2 : name === 'x_harp' ? 0.7 : 0.32;
      for (let i = 0; i < 3; i++) { const f = base * Math.pow(2, steps[Math.floor(Math.random() * steps.length)] / 12); tone(wave, f, f * (name === 'x_horn' ? 0.98 : 1), len, name === 'x_horn' ? 0.035 : 0.07, i * 0.18); }
      break;
    }
    case 'x_drum': tone('sine', 140, 50, 0.3, 0.3); noise(0.12, 300, 0.8, 0.3, 'lowpass'); tone('sine', 120, 45, 0.25, 0.22, 0.2); break;
    case 'rocket': noise(0.6, 2400, 0.4, 0.4); tone('sawtooth', 200, 900, 0.5, 0.03); break;
    case 'pearl': tone('sine', 900, 300, 0.25, 0.08); noise(0.2, 3000, 1, 0.2); break;
    case 'slime': tone('sine', 220, 360, 0.18, 0.12); noise(0.1, 500, 1, 0.3); break;
  }
}
let musicT = 40;
function music(dt) {
  if (muted || !audio || audio.state !== 'running') return;
  musicT -= dt; if (musicT > 0) return; musicT = 70 + Math.random() * 90;
  const mv = volOf('volMusic'); if (mv <= 0.001) return;
  const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3], t = audio.currentTime;
  let deg = Math.floor(Math.random() * 4) + 2;
  for (let i = 0; i < 9; i++) {
    deg = clamp(deg + Math.floor(Math.random() * 5) - 2, 0, scale.length - 1);
    const at = t + i * (0.9 + Math.random() * 0.6), o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = scale[deg] * (Math.random() < 0.3 ? 0.5 : 1);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.04 * mv, at + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, at + 2.6);
    o.connect(g).connect(master); o.start(at); o.stop(at + 2.7);
  }
}

// ─────────────────────────── saving ───────────────────────────
let SAVE = null, saveTimer = 0, settingsTimer = 0;
function loadSave() {
  const touch = isTouch();
  SAVE = { v: 1, settings: { renderDist: touch ? 3 : 5, cameraDistance:5.5, fov: 75, sens: 8, bob: true, autoJump: touch, invertY: false, hudScale: 100, touchOpacity: 85, joySize: 100,
    guiScale: 0, brightness: 0, renderScale: 100, maxFps: 0, clouds: true, particles: 2, fovEffect: true, hurtShake: true,
    volMaster: 100, volMusic: 70, volBlocks: 100, volMobs: 100, volPlayer: 100, uiSound: true,
    sneakToggle: false, sprintToggle: false, keys: { ...DEFAULT_KEYS },
    touchMode: 'auto', moveStyle: 'joystick', joyFloat: false, touchSens: 8, btnSize: 100, tapPlace: true, holdDelay: 280, vibrate: true, leftHanded: false, layout: {},
    crosshair: true, itemNames: true, showCoords: false, showFps: false, chatShow: true, chatOpacity: 100, menuBlur: 0, panoSpeed: 100, recipeBook: null,
    combat: 'modern', attackIndicator: true, dmgNumbers: false, char: null,
    lang: /^ko/i.test(navigator.language || 'ko') ? 'ko' : 'en', fog: true, showHand: true, scrollInvert: false, chatScale: 100, systemMsgs: false, autoPause: true,
    highContrast: false, reduceMotion: false, autosave: 45, invHelpers: false, hideMobileExtras: true }, worlds: [], storage: typeof ctx.save === 'function' };
  let raw = null;
  try {
    raw = ctx.savedData;
    if (raw) { const o = JSON.parse(raw); if (o && Array.isArray(o.worlds)) { SAVE.worlds = o.worlds.filter(w => w && w.id && w.name); Object.assign(SAVE.settings, o.settings || {}); } }
  } catch { raw = 'bad'; }
  const st = SAVE.settings;
  // F now swaps hands (like the original); older saves had flight on F, move it to G
  if (st.keys && typeof st.keys === 'object' && st.keys.fly === 'KeyF' && !st.keys.swap) st.keys.fly = 'KeyG';
  st.keys = Object.assign({ ...DEFAULT_KEYS }, st.keys && typeof st.keys === 'object' ? st.keys : {});
  if (!st.layout || typeof st.layout !== 'object') st.layout = {};
  // older saves stored one joystick size for everyone; carry it into the new per-button layout
  if (+st.joySize && st.joySize !== 100 && !(st.layout.move && st.layout.move.s)) { (st.layout.move || (st.layout.move = {})).s = st.joySize / 100; st.joySize = 100; }
  st.renderDist = clamp(+st.renderDist || 4, 2, 10); st.fov = clamp(+st.fov || 75, 30, 110);
  if (st.lang !== 'ko' && st.lang !== 'en') st.lang = 'ko';
  applyLanguage();
  return raw === 'bad';
}
function applyVisualSettings() {
  if (!SAVE || !root) return;
  const st = SAVE.settings, mc = $('mc');
  applyGui();
  mc.style.setProperty('--hs', clamp((+st.hudScale || 100) / 100, .5, 1.5));
  mc.style.setProperty('--to', clamp((+st.touchOpacity || 85) / 100, .2, 1));
  mc.style.setProperty('--chat', (clamp((+st.chatOpacity || 100) / 100, .1, 1) * .5).toFixed(3));
  mc.style.setProperty('--chato', clamp((+st.chatOpacity || 100) / 100, .1, 1));
  mc.style.setProperty('--blur', (+st.menuBlur || 0) + 'px');
  mc.style.setProperty('--pano-dur', (st.panoSpeed > 0 ? 12000 / st.panoSpeed : 120) + 's');
  mc.classList.toggle('nopano', !(st.panoSpeed > 0));
  mc.classList.toggle('nocross', st.crosshair === false);
  mc.classList.toggle('noname', st.itemNames === false);
  mc.classList.toggle('nochat', st.chatShow === false);
  mc.classList.toggle('hc', !!st.highContrast); mc.classList.toggle('rm', !!st.reduceMotion);
  mc.style.setProperty('--chatfs', clamp((+st.chatScale || 100) / 100, .5, 1.5));
  mc.lang = st.lang === 'en' ? 'en' : 'ko';
  positionTouch(); updateVolume();
}
function serializeWorld() {
  return {
    player: { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch, health: P.health, hunger: P.hunger, sat: P.sat, airT: P.airT, flying: P.flying, dead: P.dead,effects:P.effects,xp:P.xp,tags:P.tags,mark:P.mark },
    inv: G.inv.map(s => s ? [s.id, s.count, s.dmg || 0,s.enchants||null] : 0), armor: G.armor.map(s => s ? [s.id, 1, s.dmg || 0,s.enchants||null] : 0), off: G.off ? [G.off.id, G.off.count, G.off.dmg || 0] : 0, sel: G.sel, weather:W.weather,weatherTime:W.weatherTime,time: W.time, spawn: G.spawn, stats: G.stats,
    terrainVersion:2, dimension:W.dimension, dimensions:W.dimensions, mods: encodeMods(), te: Object.fromEntries(W.te),
    mobs: W.mobs.filter(m => !m.dead && Math.hypot(m.x - P.x, m.z - P.z) < 80).map(m => [m.type, +m.x.toFixed(2), +m.y.toFixed(2), +m.z.toFixed(2), m.hp, m.color, Math.round(m.sheared || 0)]),
  };
}
function persist() {
  if (!SAVE || !SAVE.storage) return;
  if (G && W && !G.loading) { G.world.data = serializeWorld(); G.world.played = Date.now(); G.world.mode = G.mode; G.world.difficulty = W.difficulty; }
  const str = JSON.stringify({ v: 1, settings: SAVE.settings, worlds: SAVE.worlds });
  try { Promise.resolve(ctx.save(str)).then(r => { if (r && r.ok === false) toast(r.error || tr('저장 공간이 부족해 월드를 저장하지 못했어요.')); }).catch(() => { }); } catch { }
}
function saveSoon() { saveTimer = 2; }
function saveSettingsSoon() { settingsTimer = 1; }

// ─────────────────────────── session lifecycle ───────────────────────────
let lastPc = null, wantList = [];
function startWorld(w) {
  wake();
  const d = w.data;
  W = { dimension:d?.dimension||'overworld',dimensions:d?.dimensions||{}, gen: w.gen || 1, seed: w.seed >>> 0, noise: makeNoise(w.seed >>> 0), noise2: makeNoise((w.seed ^ 0x9e3779b9) >>> 0), chunks: new Map(), mods: decodeMods(d && d.mods), te: new Map(Object.entries((d && d.te) || {})),
    weather:d?.weather||'clear',weatherTime:d?.weatherTime||0, structures: w.structures !== false, pendingSpawns: [], fluidQ: new Set(), gravQ: new Set(), mobs: [], items: [], particles: [], tnts: [], arrows: [], time: d ? d.time : 1000, difficulty: w.difficulty ?? 2, daylight: 1, skyLevel: 15 };
  lastChunk = null; lastPc = null;
  G = { world: w, mode: w.mode, inv: Array(36).fill(null), sel: (d && d.sel) || 0, ui: 'loading', settings: SAVE.settings, spawn: (d && d.spawn) || findSpawn(), stats: Object.assign({ mined: 0, placed: 0, crafted: 0, deaths: 0, time: 0, walk: 0 }, (d && d.stats) || {}),
    target: null, targetMob: null, hurtFlash: 0, loading: true, fresh: !d, craft: null, craftW: 2 };
  P = newPlayer(G.spawn); P.portalCooldown=3;P.portalExit=false;
  if (d && d.player) { Object.assign(P, d.player); P.fallStart = P.y; if (P.dead) { P.dead = false; P.health = 20; P.hunger = 20; Object.assign(P, { x: G.spawn.x, y: G.spawn.y, z: G.spawn.z }); } }
  if(d&&!d.terrainVersion&&W.dimension!=='overworld')Object.assign(P,{x:.5,y:W.dimension==='end'?65:49,z:.5,vx:0,vy:0,vz:0,fallStart:W.dimension==='end'?65:49});
  if (d && d.inv) G.inv = d.inv.map(s => s && info(s[0]) ? { id: s[0], count: s[1], dmg: s[2] || 0,enchants:s[3]||undefined } : null);
  G.off = d && d.off && info(d.off[0]) ? { id: d.off[0], count: d.off[1], dmg: d.off[2] || 0 } : null;
  G.armor = [0, 1, 2, 3].map(i => { const s = d && d.armor && d.armor[i]; return s && armorOf(s[0]) && armorOf(s[0]).slot === i ? { id: s[0], count: 1, dmg: s[2] || 0,enchants:s[3]||undefined } : null; });
  G.sleep = 0;
  if (d && d.mobs) for (const [type, x, y, z, hp, color, sheared] of d.mobs) if (MOBDEF[type]) { const m = spawnMob(type, x, y, z); m.hp = hp; m.color = color || 0; m.sheared = +sheared || 0; }
  invDirty = hudDirty = true;
  w.played = Date.now();
  showLoading(0);
}
function finishLoading() {
  G.loading = false; G.ui = null; hideScreens();
  if (G.fresh) {
    // pick an open spot (not on a tree or in water) near the generated spawn
    const sx = Math.floor(P.x), sz = Math.floor(P.z); let best = null;
    for (let r = 0; r < 14 && !best; r++) for (let dx = -r; dx <= r && !best; dx++) for (let dz = -r; dz <= r && !best; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = sx + dx, z = sz + dz; let y = WH - 2; while (y > YMIN && !solidAt(x, y, z)) y--;
      const top = getBlock(x, y, z);
      if ((top === GRASS || top === SAND || top === SNOW_GRASS || top === DIRT) && !isWater(getBlock(x, y + 1, z)) && !solidAt(x, y + 1, z) && !solidAt(x, y + 2, z)) best = [x + 0.5, y + 1, z + 0.5];
    }
    if (best) [P.x, P.y, P.z] = best; else P.y = surfaceY(P.x, P.z, P.y);
    G.spawn = { x: P.x, y: P.y, z: P.z }; P.fallStart = P.y;
  }
  else if (hitsAt(P, P.x, P.y, P.z)) P.y = surfaceY(P.x, P.z, P.y);
  $('chatlog').innerHTML = '';
  if (G.fresh && G.mode === 'survival' && G.world.bonus) { for (const [id, n] of [[LOG, 12], [APPLE, 6], [PICK0, 1], [AXE0, 1], [TORCH, 8], [BREAD, 3]]) addToInventory(id, n); invChanged(); }
  persist();
  capture();
}
function quitToTitle() {
  persist();
  if (W) for (const ch of W.chunks.values()) freeChunkGL(ch);
  G = null; W = null; P = null; lastChunk = null; cursorStack = null;
  releasePointer(); ctx.setPaused(false);
  showLanding();
}

// ─────────────────────────── chunk streaming ───────────────────────────
function neighborsGenerated(ch) { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if ((dx || dz) && !getChunk(ch.cx + dx, ch.cz + dz)) return false; return true; }
function updateChunks(budget) {
  const pcx = Math.floor(P.x) >> 4, pcz = Math.floor(P.z) >> 4, R = SAVE.settings.renderDist;
  const sig = pcx + ',' + pcz + ',' + R;
  if (sig !== lastPc) {
    lastPc = sig; wantList = [];
    // generate one ring further than we mesh: a chunk is meshed only once all 8 neighbours exist, and a
    // meshed chunk (d ≤ R+0.5) can have neighbours out to R+0.5+√2 — with R+1.5 those edge chunks never meshed
    for (let dx = -R - 2; dx <= R + 2; dx++) for (let dz = -R - 2; dz <= R + 2; dz++) { const d = Math.hypot(dx, dz); if (d <= R + 2) wantList.push([dx, dz, d]); }
    wantList.sort((a, b) => a[2] - b[2]);
    for (const [k, ch] of W.chunks) if (Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz)) > R + 3) { freeChunkGL(ch); W.chunks.delete(k); if (lastChunk === ch) lastChunk = null; }
  }
  // Spread edits across frames so several adjacent relights do not block a frame together.
  const t0 = performance.now();
  for (const ch of W.chunks.values()) if (ch.urgent) {
    if (ch.needLight) lightChunk(ch);
    if (ch.needMesh && neighborsGenerated(ch)) uploadMesh(ch, meshChunk(ch));
    if (performance.now() - t0 >= budget) return;
  }
  for (const [dx, dz, d] of wantList) {
    if (performance.now() - t0 > budget) break;
    const cx = pcx + dx, cz = pcz + dz;
    let ch = getChunk(cx, cz);
    if (!ch) { ch = generateChunk(cx, cz); W.chunks.set(ckey(cx, cz), ch); wakeChunkLava(ch); continue; }
    if (d > R + 0.5) continue;
    if ((ch.needLight || ch.needMesh) && neighborsGenerated(ch)) { if (ch.needLight) lightChunk(ch); uploadMesh(ch, meshChunk(ch)); }
  }
}
function loadProgress() {
  const pcx = Math.floor(P.x) >> 4, pcz = Math.floor(P.z) >> 4; let ok = 0, total = 0;
  // only count chunks that updateChunks will actually mesh (with view distance 2 the corners never are)
  const R = SAVE.settings.renderDist;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { if (Math.hypot(dx, dz) > R + 0.5) continue; total++; const c = getChunk(pcx + dx, pcz + dz); if (c && c.mesh) ok++; }
  return ok / total;
}

// ─────────────────────────── simulation ───────────────────────────
let tickAcc = 0, tickN = 0;
function updateSky() {
  const tt = (W.time % DAY_TICKS) / DAY_TICKS, ang = tt * Math.PI * 2, sunY = Math.sin(ang);
  W.sunAng = ang; W.sunY = sunY;
  W.daylight = clamp(0.5 + sunY * 2.2, 0.2, 1);
  if(W.dimension==='nether'||W.dimension==='end')W.daylight=0.8;
  W.skyLevel = Math.round(clamp((W.daylight - 0.16) / 0.84, 0, 1) * 11 + 4);
}
// Furnace rules follow the original game (one call = one game tick, times in seconds = ticks / 20):
// an item takes 10 s; fuel is only lit when there is something it can cook, and once lit it burns down
// even if the input is taken out; progress resets when the input changes or cooking stops while lit, and
// unwinds 2× when unlit. Smokers (food only) and blast furnaces (ores only) cook twice as fast and burn
// fuel twice as fast, so one coal still cooks 8 items everywhere. A lava bucket leaves its empty bucket.
const BLAST_INPUTS = () => new Set([IRON_ORE, GOLD_ORE, COPPER_ORE, DIAMOND_ORE, DEEP_IRON, DEEP_GOLD, DEEP_DIAMOND, ANCIENT_DEBRIS, RAW_IRON, RAW_GOLD, RAW_COPPER, XID.raw_blackiron]);
let blastInputs = null;
function furnaceSpeed(blockId) { return blockId === SMOKER || blockId === BLAST_FURNACE ? 2 : 1; }
function furnaceAccepts(blockId, id) {
  const res = SMELT[id]; if (res == null) return false;
  if (blockId === SMOKER) return !!(ITEM[res] && ITEM[res].food);
  if (blockId === BLAST_FURNACE) return (blastInputs ??= BLAST_INPUTS()).has(id);
  return true;
}
const isFurnaceFuel = id => !!FUEL[id] || id === BUCKET;
// block id of the furnace whose window is open
function furnaceBlock() { const te = G.container && G.container.te; if (te && te.block != null) return te.block; const [x, y, z] = G.container.pos.split(',').map(Number); return getBlock(x, y, z); }
function furnaceTick(k, te) {
  if (te.block == null) { const [x, y, z] = k.split(',').map(Number); te.block = getBlock(x, y, z); }
  const spd = furnaceSpeed(te.block), total = SMELT_TIME / spd;
  const [inp, fuel, out] = te.slots, res = inp && furnaceAccepts(te.block, inp.id) ? SMELT[inp.id] : null;
  const canBurn = res != null && (!out || (out.id === res && out.count < maxStack(res)));
  const wasLit = te.burn > 0;
  if (te.burn > 0) te.burn = Math.max(0, te.burn - TICK);
  if (inp && te.cookId !== inp.id) { te.cookId = inp.id; te.cook = 0; }
  if (te.burn > 0 || (fuel && FUEL[fuel.id] && inp)) {
    if (te.burn <= 0 && canBurn && fuel && FUEL[fuel.id]) {
      te.burnMax = te.burn = FUEL[fuel.id] / spd;
      fuel.count--; if (!fuel.count) te.slots[1] = fuel.id === LAVA_BUCKET ? { id: BUCKET, count: 1, dmg: 0 } : null;
    }
    if (te.burn > 0 && canBurn) {
      te.cook += TICK;
      if (te.cook >= total - 1e-6) { te.cook = 0; inp.count--; if (!inp.count) te.slots[0] = null; if (out) out.count++; else te.slots[2] = { id: res, count: 1, dmg: 0 }; }
    } else te.cook = 0;
  } else if (te.cook > 0) te.cook = Math.max(0, te.cook - TICK * 2);
  if (wasLit !== te.burn > 0) { const [x, , z] = k.split(',').map(Number); const ch = getChunk(x >> 4, z >> 4); if (ch) { ch.needMesh = true; ch.urgent = true; } }
}
// crops planted on farmland ripen after a couple of in-game minutes when they have light
function growCrops() {
  for (const [k, te] of W.te) {
    if (te.type !== 'crop') continue;
    const [x, y, z] = k.split(',').map(Number); if (!getChunk(x >> 4, z >> 4)) continue;
    if (getBlock(x, y, z) !== WHEAT_CROP) { W.te.delete(k); continue; }
    const l = getLight(x, y, z), lit = Math.max(l >> 4, l & 15) >= 9;
    if (lit && W.time - te.t > 2400 + hash3(x, y, z, 5) * 2400) setBlock(x, y, z, WHEAT_RIPE, { noUpdate: true });
  }
}
function gameTick() {
  tickN++;
  if (W.gravQ.size) { const q = [...W.gravQ]; W.gravQ.clear(); for (let i = 0; i < Math.min(q.length, 3000); i++) { const [x, y, z] = q[i].split(',').map(Number); gravityUpdate(x, y, z); } }
  if (tickN % 5 === 0 && W.fluidQ.size) { const q = [...W.fluidQ]; W.fluidQ.clear(); for (let i = 0; i < q.length; i++) { if (i > 4000) { W.fluidQ.add(q[i]); continue; } const [x, y, z] = q[i].split(',').map(Number); fluidUpdate(x, y, z); } }
  randomTicks(P.x, P.z);
  for (const [k, te] of W.te) if (te.type === 'furnace' && (te.burn > 0 || te.slots[0])) furnaceTick(k, te);
  if (tickN % 40 === 0) growCrops();
  if (G.uiKind === 'furnace' && tickN % 4 === 0) renderSlots();
}
function step(dt) {
  updatePortal(dt);if(G.loading)return;updateEffects(dt);updateLava(dt);
  if(G.world.rules?.doDaylightCycle!==false)W.time += dt * DAY_TICKS / DAY_SECONDS;
  updateSky();
  updatePlayer(dt); updateInteraction(dt); updateSurvival(dt); updateExtras(dt);
  tickAcc += dt; while (tickAcc >= TICK) { tickAcc -= TICK; gameTick(); }
  processPendingSpawns(); updateSpawners(dt);
  updateMobs(dt); updateItems(dt); updateArrows(dt); updateParticles(dt); updateTNT(dt); spawnLogic(dt); updateSleep(dt);
  if(getBlock(Math.floor(P.x),Math.floor(P.y-0.1),Math.floor(P.z))===MAGMA&&!P.sneaking&&G.mode==='survival'){P.dimensionBurn=(P.dimensionBurn||0)+dt;if(P.dimensionBurn>=1){P.dimensionBurn=0;damagePlayer(1,'magma');}}
  G.stats.time = (G.stats.time || 0) + dt;
  shake = Math.max(0, shake - dt * 2);
  if(W.weather&&W.weather!=='clear'){if(G.world.rules?.doWeatherCycle!==false)W.weatherTime-=dt;if(W.weatherTime<=0)W.weather='clear';if(Math.random()<dt*25&&getLight(Math.floor(P.x),Math.floor(P.y+3),Math.floor(P.z))>>4>=14)particles(P.x+(Math.random()-.5)*14,P.y+8,P.z+(Math.random()-.5)*14,T.water,3,.1,1,.8);}
  music(dt);
}

// ─────────────────────────── frame rendering ───────────────────────────
const CLOUDS = new DynBuilder(), LINES = new Float32Array(24 * 9);
let fov = 75;
function render(dt) {
  const w = canvas.width, h = canvas.height; gl.viewport(0, 0, w, h);
  const R = SAVE.settings.renderDist, far = (R + 1) * CS;
  const sunY = W.sunY, dl = W.daylight;
  const day = [0.53, 0.74, 0.98], night = [0.015, 0.02, 0.06], dusk = [0.95, 0.52, 0.28];
  let sky = mix(night, day, clamp((dl - 0.16) / 0.84, 0, 1));
  const duskK = clamp(1 - Math.abs(sunY) * 4, 0, 1) * 0.6; sky = mix(sky, dusk, duskK * clamp(dl, 0.3, 1));
  if(W.dimension==='nether')sky=[0.24,0.055,0.035];else if(W.dimension==='end')sky=[0.055,0.025,0.09];
  if(W.weather&&W.weather!=='clear'&&W.dimension==='overworld')sky=mix(sky,[.3,.33,.38],.6);
  let fogC = sky, fogR = SAVE.settings.fog === false ? [far * 0.92, far * 1.02] : [far * 0.55, far];
  if (P.eyeInWater) { fogC = mul([0.05, 0.12, 0.36], Math.max(0.3, dl)); fogR = [0, 22]; }
  gl.clearColor(fogC[0], fogC[1], fogC[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // camera
  const sp = Math.hypot(P.vx, P.vz);
  const bobA = SAVE.settings.bob && P.onGround && !P.flying ? Math.min(1, sp / 4) : 0;
  const bx = Math.cos(P.bob * 1.6) * 0.05 * bobA, by = Math.abs(Math.sin(P.bob * 1.6)) * 0.07 * bobA;
  const sh = shake > 0 && SAVE.settings.hurtShake !== false ? [(Math.random() - 0.5) * shake * 0.3, (Math.random() - 0.5) * shake * 0.3] : [0, 0];
  let eye = [P.x + Math.cos(P.yaw) * bx + sh[0], P.y + eyeHeight() + by + sh[1], P.z + Math.sin(P.yaw) * bx], vyaw = P.yaw, vpitch = P.pitch;
  if (camView && !P.dead) {
    // third person: pull the camera back (or out in front) until it would hit a block
    const d = lookDir(), sgn = camView === 1 ? -1 : 1; let dist = +SAVE.settings.cameraDistance||5.5;
    for (let k = 0.3; k <= (+SAVE.settings.cameraDistance||5.5); k += 0.1) if (solidAt(Math.floor(eye[0] + d[0] * sgn * k), Math.floor(eye[1] + d[1] * sgn * k), Math.floor(eye[2] + d[2] * sgn * k))) { dist = Math.max(0.3, k - 0.3); break; }
    eye = [eye[0] + d[0] * sgn * dist, eye[1] + d[1] * sgn * dist, eye[2] + d[2] * sgn * dist];
    if (camView === 2) { vyaw = P.yaw + Math.PI; vpitch = -P.pitch; }
  }
  const fe = SAVE.settings.fovEffect !== false, targetFov = SAVE.settings.fov * (P.zoom ? 0.12 : 1) * (fe && P.gliding ? 1.08 : 1) * (fe && P.sprinting ? 1.12 : 1) * (fe && P.flying && P.sprinting ? 1.05 : 1) * (fe && P.draw > 0 ? 1 - 0.15 * Math.min(1, P.draw) : 1);
  fov += (targetFov - fov) * Math.min(1, dt * 8);
  const proj = perspective(fov * Math.PI / 180, w / Math.max(1, h), 0.05, far + 60);
  const view = viewMatrix(eye, vyaw, vpitch), vp = mat4mul(proj, view), planes = frustumPlanes(vp);
  gl.useProgram(prog); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.uniformMatrix4fv(U.uVP, false, vp); gl.uniform3fv(U.uEye, eye);
  const tint = mix([0.55, 0.62, 1.0], [1, 1, 1], clamp((dl - 0.16) / 0.5, 0, 1));
  gl.uniform3fv(U.uSkyTint, tint); gl.uniform1f(U.uGamma, clamp((+SAVE.settings.brightness || 0) / 100, 0, 1) * 0.85); gl.uniform1f(U.uTime, performance.now() / 1000); gl.uniform1f(U.uMin,effectLevel(P,'night_vision')>=0?.8:W.dimension==='nether'?.38:W.dimension==='end'?.22:.045); gl.uniform1f(U.uAlpha, 1); gl.uniform1f(U.uWater, 0);
  // sky objects
  gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.disable(gl.CULL_FACE);
  gl.uniform1f(U.uBlend, 1); gl.uniform1f(U.uSky, 1); gl.uniform3fv(U.uFog, fogC); gl.uniform2f(U.uFogR, 1e5, 1e5 + 1);
  gl.uniform3f(U.uOffset, eye[0], eye[1], eye[2]); gl.uniform1f(U.uScale, 1);
  if (!P.eyeInWater) {
    SKY.reset();
    const ca = Math.cos(W.sunAng), sa = Math.sin(W.sunAng);
    const disc = (dir, size, tile, b) => { const c = [dir[0] * 100, dir[1] * 100, dir[2] * 100]; const u = [-dir[1], dir[0], 0], v = [0, 0, 1]; const p = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, bb]) => [c[0] + (u[0] * a + v[0] * bb) * size, c[1] + (u[1] * a + v[1] * bb) * size, c[2] + (u[2] * a + v[2] * bb) * size]); SKY.quad(p, [uvOf(tile, 0, 1), uvOf(tile, 1, 1), uvOf(tile, 1, 0), uvOf(tile, 0, 0)], 1, 1, b); };
    const nightK = clamp(1 - (dl - 0.16) / 0.5, 0, 1);
    if (nightK > 0.05) { const r = mulberry32(5); for (let i = 0; i < 160; i++) { let x = r() * 2 - 1, y = r() * 2 - 1, z = r() * 2 - 1; const L = Math.hypot(x, y, z); x /= L; y /= L; z /= L; const rx = x * ca - y * sa, ry = x * sa + y * ca; if (ry < -0.05) continue; disc([rx, ry, z], 0.25 + r() * 0.25, T.white, nightK * 0.9); } }
    disc([ca, sa, 0], 9, T.sun, 1); disc([-ca, -sa, 0], 7, T.moon, 0.95);
    SKY.draw();
  }
  // opaque terrain
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
  gl.uniform1f(U.uBlend, 0); gl.uniform1f(U.uSky, dl); gl.uniform2f(U.uFogR, fogR[0], fogR[1]); gl.uniform1f(U.uScale, 1 / 64);
  const visible = [];
  for (const ch of W.chunks.values()) {
    if (!ch.mesh) continue;
    const x0 = ch.cx * CS, z0 = ch.cz * CS;
    if (!boxVisible(planes, x0, YMIN, z0, x0 + CS, WH, z0 + CS)) continue;
    visible.push(ch);
    if (ch.oq) { gl.uniform3f(U.uOffset, x0, 0, z0); drawChunkBuffer(ch.vbo, ch.oq); }
  }
  // entities
  gl.disable(gl.CULL_FACE); gl.uniform1f(U.uScale, 1);
  const o = [Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2])]; gl.uniform3f(U.uOffset, o[0], o[1], o[2]);
  DYN.reset();
  const right = [Math.cos(vyaw), 0, Math.sin(vyaw)], fwd = [Math.sin(vyaw) * Math.cos(vpitch), Math.sin(vpitch), -Math.cos(vyaw) * Math.cos(vpitch)];
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  drawMobs(DYN, o[0], o[1], o[2]); drawItems(DYN, o[0], o[1], o[2]); if (camView) drawPlayerModel(DYN, o[0], o[1], o[2], dt); drawParticles(DYN, o[0], o[1], o[2], right, [-up[0], -up[1], -up[2]]);
  DYN.draw();
  // block outline
  const t = G.target;
  if (t && !G.ui && !G.targetMob) {
    const lo = -0.002, hi = 1.002, x = t.x - o[0], y = t.y - o[1], z = t.z - o[2];
    const b = BLOCK[t.id]; let y1 = hi; if (b && b.render === 'torch') y1 = 0.65; if (b && b.render === 'water') y1 = 0.9; if (b && b.height) y1 = b.height + 0.002;
    const c = [[lo, lo, lo], [hi, lo, lo], [hi, y1, lo], [lo, y1, lo], [lo, lo, hi], [hi, lo, hi], [hi, y1, hi], [lo, y1, hi]];
    const uv = uvOf(T.black, 0.5, 0.5); let n = 0;
    for (const [a, bb] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) for (const k of [a, bb]) { LINES.set([x + c[k][0], y + c[k][1], z + c[k][2], uv[0], uv[1], 1, 1, 0.35, 0], n); n += 9; }
    gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo); gl.bufferData(gl.ARRAY_BUFFER, LINES, gl.STREAM_DRAW); bindDynAttribs(0); gl.drawArrays(gl.LINES, 0, 24);
  }
  // translucent: water/ice, cracks, clouds
  gl.enable(gl.BLEND); gl.depthMask(false); gl.uniform1f(U.uBlend, 1);
  visible.sort((a, b) => Math.hypot(b.cx * CS + 8 - eye[0], b.cz * CS + 8 - eye[2]) - Math.hypot(a.cx * CS + 8 - eye[0], a.cz * CS + 8 - eye[2]));
  gl.uniform1f(U.uScale, 1 / 64); gl.uniform1f(U.uWater, 1);
  for (const ch of visible) if (ch.wq) { gl.uniform3f(U.uOffset, ch.cx * CS, 0, ch.cz * CS); drawChunkBuffer(ch.wvbo, ch.wq); }
  gl.uniform1f(U.uWater, 0); gl.uniform1f(U.uScale, 1); gl.uniform3f(U.uOffset, o[0], o[1], o[2]);
  if (P.mining && P.mining.p > 0) {
    DYNB.reset();
    const m = P.mining, stage = clamp(Math.floor(m.p * 10), 0, 9), tile = T['crack_' + stage];
    const [s, bl] = lightAt(m.x, m.y + 1, m.z), e = 0.004;
    box(DYNB, [-e, -e, -e], [1 + e, 1 + e, 1 + e], [tile, tile, tile, tile, tile, tile], p => [m.x - o[0] + p[0], m.y - o[1] + p[1], m.z - o[2] + p[2]], Math.max(s, 0.6), bl);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1); DYNB.draw(); gl.disable(gl.POLYGON_OFFSET_FILL);
  }
  if (!P.eyeInWater && SAVE.settings.clouds !== false) {
    CLOUDS.reset();
    const cy = WH + 30, cs = 12, drift = (W.time / 20) * 0.6, span = Math.ceil(far * 1.4 / cs);
    const bx0 = Math.floor((eye[0] - drift) / cs), bz0 = Math.floor(eye[2] / cs), uv = uvOf(T.white, 0.5, 0.5), U4 = [uv, uv, uv, uv];
    for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
      const gx = bx0 + i, gz = bz0 + j; if (W.noise.n2(gx * 0.21 + 100.5, gz * 0.21) < 0.12) continue;
      const x0 = gx * cs + drift - o[0], z0 = gz * cs - o[2], y = cy - o[1];
      CLOUDS.quad([[x0, y, z0 + cs], [x0 + cs, y, z0 + cs], [x0 + cs, y, z0], [x0, y, z0]], U4, 1, 0, 1);
    }
    gl.uniform2f(U.uFogR, far * 0.8, far * 1.8); gl.uniform1f(U.uAlpha, 0.78); CLOUDS.draw(); gl.uniform1f(U.uAlpha, 1);
  }
  gl.depthMask(true); gl.disable(gl.BLEND);
  // first-person hand
  updateDamageNumbers(vp, dt);
  if ((!G.ui || G.ui === 'chat' || G.ui === 'inventory' || G.ui === 'creative' || G.ui === 'table' || G.ui === 'container') && !hudHidden && !camView && SAVE.settings.showHand !== false && !P.zoom) drawHand(w, h, dt);
}
// ── first-person hand ──
// Small 3×4 affine "pose stack" so the held item and arm follow the original game's transforms
// (equip, swing arc, bow draw, eating) instead of a hand-tuned approximation.
const DEG = Math.PI / 180;
function mMul(a, b) { const o = new Array(12); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + (c === 3 ? a[r * 4 + 3] : 0); return o; }
class Pose {
  constructor() { this.m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]; }
  t(x, y, z) { this.m = mMul(this.m, [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z]); return this; }
  rx(d) { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); this.m = mMul(this.m, [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]); return this; }
  ry(d) { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); this.m = mMul(this.m, [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]); return this; }
  rz(d) { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); this.m = mMul(this.m, [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]); return this; }
  s(x, y = x, z = x) { this.m = mMul(this.m, [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0]); return this; }
  fn() { const m = this.m.slice(); return p => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]]; }
}
// Items are drawn as 1-pixel-thick extruded sprites (like the original): a front and back face plus a
// side wall for every opaque pixel edge. Built once per tile from the atlas alpha channel.
let atlasAlpha = null;
const ITEM_MESH = new Map();
function itemMesh(tile) {
  let m = ITEM_MESH.get(tile); if (m) return m;
  if (!atlasAlpha) atlasAlpha = atlasCanvas.getContext('2d').getImageData(0, 0, ATLAS, ATLAS).data;
  const ox = (tile % TPR) * TS, oy = Math.floor(tile / TPR) * TS;
  const A = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && atlasAlpha[((oy + y) * ATLAS + ox + x) * 4 + 3] >= 128;
  const z0 = 7.5 / 16, z1 = 8.5 / 16, uv = (u, v) => uvOf(tile, u, v);
  m = [{ p: [[0, 0, z1], [1, 0, z1], [1, 1, z1], [0, 1, z1]], uv: [uv(0, 1), uv(1, 1), uv(1, 0), uv(0, 0)], sh: 1 },
    { p: [[1, 0, z0], [0, 0, z0], [0, 1, z0], [1, 1, z0]], uv: [uv(1, 1), uv(0, 1), uv(0, 0), uv(1, 0)], sh: 0.78 }];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!A(x, y)) continue;
    const X0 = x / 16, X1 = (x + 1) / 16, Y0 = 1 - (y + 1) / 16, Y1 = 1 - y / 16, c = uv((x + 0.5) / 16, (y + 0.5) / 16), C = [c, c, c, c];
    if (!A(x - 1, y)) m.push({ p: [[X0, Y0, z0], [X0, Y0, z1], [X0, Y1, z1], [X0, Y1, z0]], uv: C, sh: 0.7 });
    if (!A(x + 1, y)) m.push({ p: [[X1, Y0, z1], [X1, Y0, z0], [X1, Y1, z0], [X1, Y1, z1]], uv: C, sh: 0.7 });
    if (!A(x, y - 1)) m.push({ p: [[X0, Y1, z1], [X1, Y1, z1], [X1, Y1, z0], [X0, Y1, z0]], uv: C, sh: 0.92 });
    if (!A(x, y + 1)) m.push({ p: [[X0, Y0, z0], [X1, Y0, z0], [X1, Y0, z1], [X0, Y0, z1]], uv: C, sh: 0.55 });
  }
  ITEM_MESH.set(tile, m); return m;
}
function drawItemMesh(B, tile, xf, sky, blk, shadeMul = 1) { for (const q of itemMesh(tile)) B.quad(q.p.map(xf), q.uv, sky, blk, q.sh * shadeMul); }
const isCubeItem = id => { const b = id && id < 256 ? BLOCK[id] : null; return !!(b && (b.render === 'cube' || b.render === 'cutout' || b.render === 'translucent' || b.render === 'bed')); };
function itemTileIdle(id) { const b = id < 256 ? BLOCK[id] : null; return b ? T[typeof b.tex === 'string' ? b.tex : b.tex.side] : T[ITEM[id].icon]; }
function itemTile(id) {
  if (id === BOW && P && P.draw > 0) return T['bow_' + (P.draw < 0.35 ? 1 : P.draw < 0.8 ? 2 : 3)];
  const b = id < 256 ? BLOCK[id] : null; return b ? T[typeof b.tex === 'string' ? b.tex : b.tex.side] : T[ITEM[id].icon];
}
const handLower = [0, 0], lastHeld = [-1, -1];
function drawHand(w, h, dt) {
  if (P.dead) return;
  gl.clear(gl.DEPTH_BUFFER_BIT);
  const proj = perspective(70 * Math.PI / 180, w / Math.max(1, h), 0.01, 10);
  gl.uniformMatrix4fv(U.uVP, false, proj); gl.uniform3f(U.uEye, 0, 0, 0); gl.uniform3f(U.uOffset, 0, 0, 0); gl.uniform2f(U.uFogR, 1e5, 1e5 + 1); gl.uniform1f(U.uBlend, 0);
  HAND.reset();
  const [sky, blk] = lightAt(P.x, P.y + eyeHeight(), P.z);
  const ids = [G.inv[G.sel] ? G.inv[G.sel].id : 0, G.off ? G.off.id : 0];
  for (const hi of [0, 1]) { if (ids[hi] !== lastHeld[hi]) { handLower[hi] = 1; lastHeld[hi] = ids[hi]; } handLower[hi] = Math.max(0, handLower[hi] - Math.min(dt, 0.1) * 4.8); }
  renderHandItem(0, ids[0], sky, blk);
  if (ids[1]) renderHandItem(1, ids[1], sky, blk); // the off-hand is drawn mirrored on the left, like the original
  gl.disable(gl.CULL_FACE); HAND.draw();
}
function renderHandItem(hi, id, sky, blk) {
  const swr = hi ? P.swingOffT : P.swingT, sw = swr >= 0 ? swr : 0, sq = Math.sqrt(sw), equip = handLower[hi], using = (P.useHand || 0) === hi;
  const sp = Math.hypot(P.vx, P.vz), bobA = SAVE.settings.bob && P.onGround && !P.flying ? Math.min(1, sp / 4) : 0;
  const ps = new Pose(); if (hi) ps.s(-1, 1, 1);
  ps.t(Math.sin(P.bob * 1.6) * 0.025 * bobA, -Math.abs(Math.cos(P.bob * 1.6)) * 0.03 * bobA, 0);
  if (!id) {
    // empty hand: the player's arm, posed exactly like the original renderPlayerArm
    ps.t(0.64 - 0.3 * Math.sin(sq * Math.PI), 0.4 * Math.sin(sq * 2 * Math.PI) - 0.6 - equip * 0.6, -0.4 * Math.sin(sw * Math.PI) - 0.72)
      .ry(45).ry(Math.sin(sq * Math.PI) * 70).rz(Math.sin(sw * sw * Math.PI) * -20)
      .t(-1, 3.6, 3.5).rz(120).rx(200).ry(-135).t(5.6, 0, 0);
    const xf = ps.fn(), slim = charOf().slim, x0 = (slim ? -7 : -8) / 16, fp = T.pl_arm_fp;
    box(HAND, [x0, 0, -2 / 16], [-4 / 16, 12 / 16, 2 / 16], [fp, fp, T.pl_arm_u, T.pl_arm_t, fp, fp], xf, sky, blk);
    const ch = G.armor[1], am = ch && armorOf(ch.id);
    if (am&&ch.id!==ELYTRA) { const st = [T['equip_' + ARMOR_MATS[am.mat].key+'_chest'],.25,.2,.75,.7], e = 0.6 / 16; box(HAND, [x0 - e, -e, -2 / 16 - e], [-4 / 16 + e, 5 / 16, 2 / 16 + e], [st, st, st, st, st, st], xf, sky, blk); }
    return;
  }
  const eatK = using && P.eating > 0 ? P.eating / 1.6 : 0;
  if (using && P.draw > 0 && id === BOW) {
    ps.t(0.56, -0.52 - equip * 0.6, -0.72).t(-0.2785682, 0.18344387, 0.15731531).rx(-13.935).ry(35.3).rz(-9.785);
    const f = Math.min(1, (P.draw * P.draw + P.draw * 2) / 3);
    if (f > 0.1) ps.t(0, Math.sin((P.draw * 20 - 2) * 1.3) * (f - 0.1) * 0.004, 0);
    ps.t(0, 0, f * 0.04).s(1, 1, 1 + f * 0.2).ry(-45);
  } else if (eatK > 0) {
    const left = (1 - eatK) * 32, f1 = 1 - eatK;
    if (f1 < 0.8) ps.t(0, Math.abs(Math.cos(left / 4 * Math.PI) * 0.1), 0);
    const f3 = 1 - Math.pow(f1, 27);
    ps.t(f3 * 0.6, f3 * -0.5, 0).ry(f3 * 90).rx(f3 * 10).rz(f3 * 30).t(0.56, -0.52 - equip * 0.6, -0.72);
  } else {
    ps.t(-0.4 * Math.sin(sq * Math.PI), 0.2 * Math.sin(sq * 2 * Math.PI), -0.2 * Math.sin(sw * Math.PI))
      .t(0.56, -0.52 - equip * 0.6, -0.72)
      .ry(45 + Math.sin(sw * sw * Math.PI) * -20).rz(Math.sin(sq * Math.PI) * -20).rx(Math.sin(sq * Math.PI) * -80).ry(-45);
  }
  if (isCubeItem(id)) { ps.ry(45).s(0.4).t(-0.5, -0.5, -0.5); box(HAND, [0, 0, 0], [1, BLOCK[id].height || 1, 1], blockTiles(id), ps.fn(), sky, blk); }
  else { ps.t(1.13 / 16, 3.2 / 16, 1.13 / 16).ry(-90).rz(25).s(0.68).t(-0.5, -0.5, -0.5); drawItemMesh(HAND, hi === (P.useHand || 0) ? itemTile(id) : itemTileIdle(id), ps.fn(), sky, blk); }
}
// floating damage numbers (optional, Settings → 전투)
function updateDamageNumbers(vp, dt) {
  const box = $('dnums'), list = W.dnums || []; if (!box) return;
  for (let i = list.length - 1; i >= 0; i--) { const n = list[i]; n.t += dt; n.y += dt * 0.7; if (n.t > 1) list.splice(i, 1); }
  while (box.children.length < list.length) box.append(document.createElement('b'));
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  [...box.children].forEach((el, i) => {
    const n = list[i]; if (!n) { el.style.display = 'none'; return; }
    const x = vp[0] * n.x + vp[4] * n.y + vp[8] * n.z + vp[12], y = vp[1] * n.x + vp[5] * n.y + vp[9] * n.z + vp[13], w = vp[3] * n.x + vp[7] * n.y + vp[11] * n.z + vp[15];
    if (w <= 0.05) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.className = n.crit ? 'crit' : '';
    el.textContent = (Math.round(n.v * 10) / 10).toString();
    el.style.left = ((x / w * 0.5 + 0.5) * cw).toFixed(1) + 'px'; el.style.top = ((0.5 - y / w * 0.5) * ch).toFixed(1) + 'px'; el.style.opacity = Math.min(1, (1 - n.t) * 3).toFixed(2);
  });
}

// ─────────────────────────── player character ───────────────────────────
// Two body models like the original — classic (4-pixel arms) and slim (3-pixel arms) — with original
// pixel-art looks that you can recolour. Skin tiles are painted into the atlas at runtime.
const CHAR_SKIN = [[243, 210, 181], [230, 185, 143], [201, 144, 100], [154, 100, 64], [107, 67, 42]];
const CHAR_HAIR = [[36, 28, 28], [74, 48, 32], [138, 74, 34], [224, 192, 104], [184, 184, 192], [44, 58, 120], [122, 34, 56]];
const CHAR_SHIRT = [[184, 51, 43], [216, 120, 44], [216, 192, 74], [76, 138, 58], [46, 128, 134], [53, 87, 168], [122, 74, 168], [230, 230, 230], [42, 42, 46]];
const CHAR_PANTS = [[58, 58, 64], [168, 147, 94], [106, 74, 48], [32, 32, 36], [63, 95, 143], [90, 106, 52]];
const CHAR_PRESETS = [
  { name: '바위', model: 'classic', skin: 1, hair: 0, style: 0, shirt: 0, pants: 0 },
  { name: '노을', model: 'slim', skin: 0, hair: 6, style: 1, shirt: 6, pants: 1 },
  { name: '숲지기', model: 'classic', skin: 3, hair: 1, style: 0, shirt: 3, pants: 2 },
  { name: '새벽', model: 'slim', skin: 2, hair: 3, style: 1, shirt: 5, pants: 3 }];
function charOf() { const c = Object.assign({}, CHAR_PRESETS[0], (SAVE && SAVE.settings.char) || {}); c.slim = c.model === 'slim'; return c; }
// pixel art per face; one character per pixel, stretched to fill a 16×16 tile
const CHAR_ART = {
  headF: [['HHHHHHHH', 'HHHHHHHH', 'H......H', '.bb..bb.', '..e..e..', '...nn...', '...mm...', '........'],
    ['HHHHHHHH', 'HHHHHHHH', 'HHH..HHH', 'Hbb..bbH', 'H.e..e.H', 'H..nn..H', 'H..mm..H', 'H......H']],
  headR: [['HHHHHHHH', 'HHHHHHHH', 'HHHH....', 'HHH.....', 'HH..k...', 'HH......', 'H.......', '........'],
    ['HHHHHHHH', 'HHHHHHHH', 'HHHHH...', 'HHHHH...', 'HHHHHk..', 'HHHH....', 'HHHH....', 'HHH.....']],
  headB: [['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', '........'], ['HHHHHHHH']],
  bodyF: ['sss..sss', 'ssss.sss', 'ssssssss', 'ssssLsss', 'ssssssss', 'ssssssss', 'ssssLsss', 'ssssssss', 'ssssssss', 'ssssLsss', 'ssssssss', 'dddddddd'],
  bodyB: ['ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dddddddd'],
  arm: ['ssss', 'ssss', 'ssss', 'dddd', '....', '....', '....', '....', '....', '....', '....', 'kkkk'],
  leg: ['PPPP', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'oooo', 'oooo', 'oooo'],
};
const CHAR_TILES = ['pl_head_f', 'pl_head_r', 'pl_head_l', 'pl_head_b', 'pl_head_t', 'pl_head_u', 'pl_body_f', 'pl_body_b', 'pl_body_s', 'pl_body_t', 'pl_body_u', 'pl_arm_s', 'pl_arm_fp', 'pl_arm_t', 'pl_arm_u', 'pl_leg_s', 'pl_leg_t', 'pl_leg_u'];
function charPalette(c) {
  const sk = CHAR_SKIN[c.skin] || CHAR_SKIN[0], h = CHAR_HAIR[c.hair] || CHAR_HAIR[0], sh = CHAR_SHIRT[c.shirt] || CHAR_SHIRT[0], pa = CHAR_PANTS[c.pants] || CHAR_PANTS[0];
  return { '.': sk, k: mul(sk, 0.86), n: mul(sk, 0.88), m: mul(sk, 0.68), e: [34, 26, 30], H: h, b: mul(h, 0.7), s: sh, d: mul(sh, 0.74), L: mul(sh, 1.22), p: pa, P: mul(pa, 0.75), o: [56, 46, 40] };
}
function paintCharacter() {
  if (!atlasCanvas) return;
  const c = charOf(), pal = charPalette(c), g = atlasCanvas.getContext('2d'), img = g.createImageData(16, 16), D = img.data, A = CHAR_ART;
  const put = (name, rows, flipY = false, mirror = false) => {
    const i = T[name], w = rows[0].length, h = rows.length;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const ay = Math.floor((flipY ? 15 - y : y) * h / 16), ax = Math.floor((mirror ? 15 - x : x) * w / 16), col = pal[rows[ay][ax]] || pal['.'];
      const v = 0.95 + hash2(ax * 7 + i, ay * 13, 99) * 0.1, k = (y * 16 + x) * 4;
      D[k] = clamp(col[0] * v, 0, 255); D[k + 1] = clamp(col[1] * v, 0, 255); D[k + 2] = clamp(col[2] * v, 0, 255); D[k + 3] = 255;
    }
    g.putImageData(img, (i % TPR) * TS, Math.floor(i / TPR) * TS);
  };
  const st = c.style ? 1 : 0;
  put('pl_head_f', A.headF[st]); put('pl_head_r', A.headR[st]); put('pl_head_l', A.headR[st], false, true); put('pl_head_b', A.headB[st]);
  put('pl_head_t', ['H']); put('pl_head_u', ['.']);
  put('pl_body_f', A.bodyF); put('pl_body_b', A.bodyB); put('pl_body_s', A.bodyB); put('pl_body_t', ['s']); put('pl_body_u', ['p']);
  put('pl_arm_s', A.arm); put('pl_arm_fp', A.arm, true); put('pl_arm_t', ['s']); put('pl_arm_u', ['k']);
  put('pl_leg_s', A.leg); put('pl_leg_t', ['p']); put('pl_leg_u', ['o']);
  if (gl && atlasTex) { gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas); }
}
// flat front view (16×32 px) for the inventory and the character screen, with worn armor on top
function drawPortrait(cv, armor) {
  if (!cv) return;
  const c = charOf(), pal = charPalette(c), g = cv.getContext('2d'), A = CHAR_ART, aw = c.slim ? 3 : 4;
  g.clearRect(0, 0, 16, 32);
  const blit = (rows, x0, y0, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const r = rows[Math.floor(y * rows.length / h)], col = pal[r[Math.floor(x * r.length / w)]] || pal['.']; g.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; g.fillRect(x0 + x, y0 + y, 1, 1); } };
  blit(A.headF[c.style ? 1 : 0], 4, 0, 8, 8); blit(A.bodyF, 4, 8, 8, 12);
  blit(A.arm, 4 - aw, 8, aw, 12); blit(A.arm, 12, 8, aw, 12); blit(A.leg, 4, 20, 4, 12); blit(A.leg, 8, 20, 4, 12);
  const over = (slot, rects) => { const s = armor && armor[slot], a = s && armorOf(s.id); if (!a||s.id===ELYTRA) return; const col = ARMOR_MATS[a.mat].col; for (const [x, y, w, h, f] of rects) { g.fillStyle = `rgb(${col.map(v => clamp(v * (f || 1), 0, 255) | 0).join(',')})`; g.fillRect(x, y, w, h);const part=['helmet','chest','legs','boots'][slot],ti=T['equip_'+ARMOR_MATS[a.mat].key+'_'+part];if(ti!==undefined){g.imageSmoothingEnabled=false;g.drawImage(atlasCanvas,(ti%TPR)*TS,Math.floor(ti/TPR)*TS,TS,TS,x,y,w,h);} } };
  over(0, [[4, 0, 8, 2, 1.1], [3, 2, 1, 3, 0.8], [12, 2, 1, 3, 0.8]]);
  over(1, [[4, 8, 8, 9, 1], [4 - aw, 8, aw, 4, 0.85], [12, 8, aw, 4, 0.85], [7, 9, 2, 6, 1.15]]);
  over(2, [[4, 17, 8, 3, 0.95], [4, 20, 4, 7, 0.9], [8, 20, 4, 7, 0.9]]);
  over(3, [[4, 28, 4, 4, 0.8], [8, 28, 4, 4, 0.8]]);
}
// ── third-person model ──
let camView = 0; // 0 first person, 1 behind, 2 in front
function cycleView() {
  camView = (camView + 1) % 3; $('mc').classList.toggle('cam2', camView === 2);
}
function drawPlayerModel(B, ox, oy, oz, dt) {
  if (P.dead||effectLevel(P,'invisibility')>=0) return;
  const c = charOf(), aw = c.slim ? 3 : 4;
  const [sky, blk] = lightAt(P.x, P.y + 1.2, P.z), flash = P.hurt > 0.25 ? 1 : 0;
  // the body follows where you walk; the head leads it, like the original
  const sp = Math.hypot(P.vx, P.vz), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  let dy = wrap(P.yaw - P.bodyYaw);
  if (sp > 0.5) P.bodyYaw += dy * Math.min(1, dt * 10); else if (Math.abs(dy) > 0.85) P.bodyYaw += dy - Math.sign(dy) * 0.85;
  dy = wrap(P.yaw - P.bodyYaw);
  const amt = P.flying ? 0.15 : Math.min(1, sp / 4.3), ph = P.bob * 2.3, legA = Math.cos(ph) * 50 * amt, armA = -Math.cos(ph) * 40 * amt;
  const root = new Pose().t(P.x - ox, P.y - oy - (P.sneaking ? 0.12 : 0), P.z - oz).ry(-P.bodyYaw / DEG).s(0.9375 / 16);
  const sub = (x, y, z) => { const p = new Pose(); p.m = root.m.slice(); return p.t(x, y, z); };
  const bx = (pose, mn, mx, tiles, inf = 0) => box(B, [mn[0] - inf, mn[1] - inf, mn[2] - inf], [mx[0] + inf, mx[1] + inf, mx[2] + inf], tiles, pose.fn(), sky, blk, flash);
  const t6 = n => { const t = T[n]; return [t, t, t, t, t, t]; };
  const armorPart=(slot,part)=>{const a=G.armor?.[slot]&&armorOf(G.armor[slot].id);const p=part==='armor_limb'?(slot===3?'boots':slot===2?'legs':slot===0?'helmet':'chest'):part.replace('armor_','');const tile=T['equip_'+ARMOR_MATS[a?.mat||0].key+'_'+p];return p==='helmet'?[tile,.35,.08,.65,.25]:p==='legs'||p==='boots'?[tile,.16,.3,.4,.85]:[tile,.28,.25,.72,.72];};
  const arm = G.armor || [], amat = i => { const s = arm[i], a = s && armorOf(s.id); return a&&s.id!==ELYTRA ? 'armor_skin_' + ARMOR_MATS[a.mat].key : null; };
  const TL = [T.pl_leg_s, T.pl_leg_s, T.pl_leg_t, T.pl_leg_u, T.pl_leg_s, T.pl_leg_s], TA = [T.pl_arm_s, T.pl_arm_s, T.pl_arm_t, T.pl_arm_u, T.pl_arm_s, T.pl_arm_s];
  // legs
  for (const side of [1, -1]) {
    const p = sub(side * 2, 12, 0).rx(side * legA);
    bx(p, [-2, -12, -2], [2, 0, 2], TL);
    if (amat(2)) bx(p, [-2, -8, -2], [2, 0, 2], [armorPart(2,'armor_limb'),armorPart(2,'armor_limb'),armorPart(2,'armor_limb'),armorPart(2,'armor_limb'),armorPart(2,'armor_limb'),armorPart(2,'armor_limb')], 0.4);
    if (amat(3)) bx(p, [-2, -12, -2], [2, -8.5, 2], [armorPart(3,'armor_limb'),armorPart(3,'armor_limb'),armorPart(3,'armor_limb'),armorPart(3,'armor_limb'),armorPart(3,'armor_limb'),armorPart(3,'armor_limb')], 0.8);
  }
  // body
  const body = sub(0, 12, 0);
  bx(body, [-4, 0, -2], [4, 12, 2], [T.pl_body_s, T.pl_body_s, T.pl_body_t, T.pl_body_u, T.pl_body_b, T.pl_body_f]);
  if (amat(1)) bx(body, [-4, 1, -2], [4, 12, 2], [armorPart(1,'armor_limb'),armorPart(1,'armor_limb'),armorPart(1,'armor_limb'),armorPart(1,'armor_limb'),armorPart(1,'armor_chest'),armorPart(1,'armor_chest')], 0.8);
  if (amat(2)) bx(body, [-4, 0, -2], [4, 2.5, 2], [armorPart(2,'armor_limb'),armorPart(2,'armor_limb'),armorPart(2,'armor_limb'),armorPart(2,'armor_limb'),armorPart(2,'armor_limb'),armorPart(2,'armor_limb')], 0.5);
  if(G.armor[1]?.id===ELYTRA){const tile=T.elytra_item;for(const side of [-1,1]){const wing=sub(side*3,22,3).rz(side*(P.gliding?45:12));bx(wing,[-2,-13,0],[2,0,1],Array(6).fill([tile,.18,.18,.8,.85]));}}
  // arms: walking swing, attack swing, bow pose
  const pitch = P.pitch / DEG, bowing = P.draw > 0;
  for (const side of [1, -1]) {
    const hand = side > 0 ? 0 : 1, sw = hand ? P.swingOffT : P.swingT, s = sw >= 0 ? Math.sin(Math.sqrt(sw) * Math.PI) : 0;
    let rx = side * armA, ry = 0, rz = side * 3;
    if (s) { rx = 30 + s * 70 + pitch * 0.5; ry = side * s * 20; }
    if (bowing) { rx = 90 + pitch; ry = side * (hand === P.useHand ? -6 : 22); rz = 0; }
    if (P.eating > 0 && hand === P.useHand) { rx = 70 + Math.sin(P.eating * 20) * 8; ry = -side * 30; }
    const p = sub(side * (4 + aw / 2), 22, 0).ry(ry).rx(rx).rz(rz);
    bx(p, [-aw / 2, -10, -2], [aw / 2, 2, 2], TA);
    if (amat(1)) bx(p, [-aw / 2, -3, -2], [aw / 2, 2, 2], [armorPart(1,'armor_limb'),armorPart(1,'armor_limb'),armorPart(1,'armor_limb'),armorPart(1,'armor_limb'),armorPart(1,'armor_chest'),armorPart(1,'armor_chest')], 0.7);
    // held item
    const st = hand ? G.off : G.inv[G.sel], id = st ? st.id : 0;
    if (id) {
      const ip = new Pose(); ip.m = p.m.slice(); ip.t(0, -10, -0.5);
      if (isCubeItem(id)) { ip.s(5).t(-0.5, -0.8, -0.8); box(B, [0, 0, 0], [1, BLOCK[id].height || 1, 1], blockTiles(id), ip.fn(), sky, blk, flash); }
      else { ip.ry(90 * side).s(9).t(-0.2, -0.2, -0.5); drawItemMesh(B, itemTile(id), ip.fn(), sky, blk); }
    }
  }
  // head
  const head = sub(0, 24, 0).ry(-dy / DEG).rx(pitch);
  bx(head, [-4, 0, -4], [4, 8, 4], [T.pl_head_r, T.pl_head_l, T.pl_head_t, T.pl_head_u, T.pl_head_b, T.pl_head_f]);
  if(amat(0)){
    const ht=Array(6).fill(armorPart(0,'armor_helmet'));
    // Crown, rear and cheek guards are separate pieces; the face stays open.
    bx(head,[-4.5,6.5,-4.5],[4.5,8.5,4.5],ht,.08);
    bx(head,[-4.5,1.5,3.6],[4.5,6.5,4.5],ht,.08);
    bx(head,[-4.5,2,-4.5],[-3.6,6.5,3.6],ht,.08);
    bx(head,[3.6,2,-4.5],[4.5,6.5,3.6],ht,.08);
  }
}

// ─────────────────────────── input ───────────────────────────
let expectUnlock = false, lastUnlock = 0, sprintTap = false, showDebug = false, hudHidden = false, sneakLatch = false, sprintLatch = false;
function capture() {
  if (!canvas || touchUI() || !G || G.ui) return;
  try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch { }
  canvas.focus();
}
function releasePointer() { if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); } }
const keyAct = c => { const K = SAVE.settings.keys; for (const a in K) if (K[a] === c) return a; return null; };
function refreshMove() {
  const st = SAVE.settings, K = st.keys, k = a => !!keys[K[a]];
  input.fwd = (k('forward') || keys.ArrowUp ? 1 : 0) - (k('back') || keys.ArrowDown ? 1 : 0);
  input.side = (k('right') || keys.ArrowRight ? 1 : 0) - (k('left') || keys.ArrowLeft ? 1 : 0);
  input.jump = k('jump') || touchJump;
  input.sneak = (st.sneakToggle ? sneakLatch : k('sneak') || !!keys.ShiftRight) || touchSneak || touchDown;
  input.descend = k('sneak') || !!keys.ShiftRight || (st.sneakToggle && sneakLatch) || touchDown;
  input.sprintKey = (st.sprintToggle ? sprintLatch : k('sprint') || !!keys.ControlRight) || sprintTap || touchSprint;
}
function dropItem(all) {
  const s = held(); if (!s) return;
  const n = all ? s.count : 1, d = lookDir();
  spawnItem(s.id, n, P.x + d[0] * 0.5, P.y + eyeHeight() - 0.3, P.z + d[2] * 0.5, s.dmg, [d[0] * 5, d[1] * 5 + 2, d[2] * 5]);
  W.items[W.items.length - 1].pick = 1.5;
  if (G.mode === 'survival') { s.count -= n; if (s.count <= 0) G.inv[G.sel] = null; }
  invChanged();
}
function pickBlock() {
  const t = G.target; if (!t) return;
  let id = t.id; if (isWater(id)) return; if (id === GRASS || id === SNOW_GRASS) id = id;
  const i = G.inv.findIndex(s => s && s.id === id);
  if (i >= 0 && i < 9) G.sel = i;
  else if (G.mode === 'creative') G.inv[G.sel] = { id, count: 64, dmg: 0 };
  else if (i >= 9) { const tmp = G.inv[G.sel]; G.inv[G.sel] = G.inv[i]; G.inv[i] = tmp; }
  invChanged();
}
// jump press: a second press while airborne deploys the elytra; two quick presses toggle creative flight
function jumpPressed(now, gap) {
  if (!G || !P) return;
  const glide = tryStartGlide();
  if (G.mode === 'creative') { if (now - P.lastJump < gap) { setFlying(!P.flying); if (P.flying) stopGlide(); P.lastJump = 0; } else P.lastJump = glide ? 0 : now; }
}
function setHudHidden(v) { hudHidden = v; $('mc').classList.toggle('nohud', v); }
function bindInput() {
  // key rebinding grabs the next key press before anything else sees it
  ctx.on(window, 'keydown', e => {
    if (!bindingKey) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code !== 'Escape') SAVE.settings.keys[bindingKey] = e.code;
    bindingKey = null; saveSettingsSoon(); showKeys();
  }, true);
  ctx.on(window, 'keydown', e => {
    const tg = e.target, typing = tg && (tg.tagName === 'TEXTAREA' || (tg.tagName === 'INPUT' && tg.type !== 'range'));
    const c = e.code;
    if (!G) { if (c === 'Escape') { if (typing) tg.blur(); menuEscape(); } return; }
    if (G.loading) return;
    if (G.ui === 'chat') return;
    if (typing && c !== 'Escape') return;
    const act = keyAct(c);
    if (act || /^(Digit\d|Arrow\w+|Tab|F1|F3)$/.test(c)) e.preventDefault();
    if (c === 'Escape') {
      if (performance.now() - lastUnlock < 350) return;
      if (typing) tg.blur();
      if (G.ui === 'pause') menuAction('resume');
      else if (G.ui === 'settings') settingsBack();
      else if (G.ui === 'help' || G.ui === 'stats') showPause();
      else if (G.ui === 'layout') closeLayoutEditor(false);
      else if (G.ui === 'death' || G.ui === 'title') { }
      else if (G.ui) closeScreen();
      else showPause();
      return;
    }
    if (act === 'inventory' && !e.repeat) { if (['inventory', 'creative', 'table', 'container'].includes(G.ui)) closeScreen(); else if (!G.ui) openScreen(G.mode === 'creative' ? 'creative' : 'inventory'); return; }
    if (G.ui) return;
    const st = SAVE.settings;
    if (act === 'forward' && !e.repeat) { const n = performance.now(); if (n - P.lastFwd < 280) sprintTap = true; P.lastFwd = n; }
    if (act === 'jump' && !e.repeat) jumpPressed(performance.now(), 300);
    if (act === 'sneak' && !e.repeat && st.sneakToggle) sneakLatch = !sneakLatch;
    if (act === 'sprint' && !e.repeat && st.sprintToggle) sprintLatch = !sprintLatch;
    keys[c] = true; refreshMove();
    if (/^Digit[1-9]$/.test(c)) { G.sel = +c.slice(5) - 1; invChanged(); }
    if (e.repeat) return;
    if (act === 'drop') dropItem(e.ctrlKey || e.metaKey);
    if (act === 'chat' || c === 'Enter') { keys[c] = false; openChat(''); }
    if (act === 'command') { keys[c] = false; openChat('/'); }
    if (act === 'debug') { showDebug = !showDebug; $('debug').style.display = showDebug ? 'flex' : 'none'; infoT = 0; }
    if (act === 'hideHud') setHudHidden(!hudHidden);
    if (act === 'fly' && G.mode === 'creative') setFlying(!P.flying);
    if (act === 'swap') swapHands();
    if (act === 'view') cycleView();
  });
  ctx.on(window, 'keyup', e => { delete keys[e.code]; if (e.code === SAVE.settings.keys.forward || e.code === 'ArrowUp') sprintTap = false; if (G) refreshMove(); });
  ctx.on(window, 'blur', () => { for (const k in keys) delete keys[k]; sprintTap = false; if (G) refreshMove(); input.mine = input.use = false; });
  ctx.on(canvas, 'contextmenu', e => e.preventDefault());
  ctx.on(canvas, 'mousedown', e => {
    if (!G || G.ui || G.loading) return;
    wake();
    if (document.pointerLockElement !== canvas) { capture(); if (isTouch()) return; }
    e.preventDefault();
    if (e.button === 0) { input.mine = true; input.click = true; P.attackCd = 0; P.mineCd = 0; }
    else if (e.button === 2) { input.use = true; P.useCd = 0; }
    else if (e.button === 1) pickBlock();
  });
  ctx.on(document, 'mouseup', e => { if (e.button === 0) input.mine = false; if (e.button === 2) input.use = false; });
  ctx.on(document, 'mousemove', e => {
    if (!G || G.ui || !P) return;
    const k = 0.0022 * SAVE.settings.sens / 8 * (P.zoom ? 0.15 : 1);
    if (document.pointerLockElement === canvas) { P.yaw += e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k * (SAVE.settings.invertY ? -1 : 1), -1.55, 1.55); }
    else if (e.buttons && !isTouch() && e.target === canvas) { P.yaw += e.movementX * k * 1.6; P.pitch = clamp(P.pitch - e.movementY * k * (SAVE.settings.invertY ? -1 : 1) * 1.6, -1.55, 1.55); }
  });
  ctx.on(canvas, 'wheel', e => { e.preventDefault(); if (!G || G.ui) return; const down = (e.deltaY > 0) !== !!SAVE.settings.scrollInvert; G.sel = (G.sel + (down ? 1 : 8)) % 9; invChanged(); }, { passive: false });
  ctx.on(document, 'pointerlockchange', () => {
    if (document.pointerLockElement === canvas) return;
    lastUnlock = performance.now();
    input.mine = input.use = false;
    if (expectUnlock) { expectUnlock = false; return; }
    if (G && !G.ui && !G.loading) showPause();
  });
  ctx.on(document, 'visibilitychange', () => { if (document.hidden) { if (G && !G.ui && !G.loading && SAVE.settings.autoPause !== false) showPause(); persist(); } });
  ctx.on(canvas, 'webglcontextlost', e => { e.preventDefault(); ctx.reportError(Error('3D 그래픽 연결이 끊겼습니다. 다시 시작해 주세요.')); });
}

// ─────────────────────────── main loop ───────────────────────────
let raf = 0, last = 0, disposed = false, fpsAcc = 0, fpsN = 0, fpsShow = 0, autosave = 45;
const PAUSED_UI = ['pause', 'settings', 'help', 'stats', 'layout'];
function frame(now) {
  if (disposed) return;
  raf = requestAnimationFrame(frame);
  const cap = +SAVE.settings.maxFps || 0;
  if (cap && now - last < 1000 / cap - 2) return;
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (settingsTimer > 0) { settingsTimer -= dt; if (settingsTimer <= 0) persist(); }
  if (!G || !W) { gl.clearColor(0.08, 0.06, 0.04, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
  if (G.loading) {
    updateSky(); updateChunks(28);
    const p = loadProgress(); showLoading(p);
    if (p >= 1) finishLoading();
    else { gl.clearColor(0.08, 0.06, 0.04, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
  }
  const paused = PAUSED_UI.includes(G.ui);
  if (!paused) { let left = dt; while (left > 1e-4) { const s = Math.min(left, 0.05); step(s); left -= s; } }
  if (saveTimer > 0) { saveTimer -= dt; if (saveTimer <= 0) persist(); }
  if (!paused) { autosave -= dt; if (autosave <= 0) { autosave = +SAVE.settings.autosave || 45; persist(); } }
  updateChunks(paused ? 2 : 3);
  render(dt);
  updateHUD(dt);
  if (showDebug) {
    const bx = Math.floor(P.x), bz = Math.floor(P.z), ch = getChunk(bx >> 4, bz >> 4), l = getLight(bx, Math.floor(P.y + 1), bz);
    const biome = ch ? tr(BIOME_NAME[ch.biomes[(bz & 15) * CS + (bx & 15)]]) : '?';
    const tday = Math.floor(W.time % DAY_TICKS);
    const facing = ['북쪽 (-Z)', '동쪽 (+X)', '남쪽 (+Z)', '서쪽 (-X)'][((Math.round(P.yaw / (Math.PI / 2)) % 4) + 4) % 4];
    const tg = G.target;
    $('debug').innerHTML = [`Minecraft Mini  ${fpsShow} fps`, `XYZ: ${P.x.toFixed(3)} / ${P.y.toFixed(3)} / ${P.z.toFixed(3)}`, `블록: ${bx} ${Math.floor(P.y)} ${bz}  청크: ${bx >> 4} ${bz >> 4} (로드 ${W.chunks.size})`, `방향: ${facing}`,
      `바이옴: ${biome}  빛: 하늘 ${l >> 4} 블록 ${l & 15}`, `시간: ${tday} (${dayCount()}일째)  난이도: ${DIFF_NAME[W.difficulty]}`, `몹 ${W.mobs.length}  아이템 ${W.items.length}  파티클 ${W.particles.length}`, `시드: ${G.world.seedText}`,
      tg ? `대상 블록: ${tg.x} ${tg.y} ${tg.z} ${info(tg.id) ? info(tg.id).name : ''}` : ''].filter(Boolean).map(t => `<div>${esc(t)}</div>`).join('');
  }
}
function resize() {
  const r = canvas.getBoundingClientRect();
  const d = Math.min(window.devicePixelRatio || 1, isTouch() ? 1.25 : 1.5) * clamp((SAVE && +SAVE.settings.renderScale || 100) / 100, 0.5, 1);
  canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d));
}

window.GameHub.registerGame({
  id: 7,
  async mount(container, context) {
    root = container; ctx = context; muted = ctx.muted;
    buildDOM();
    buildAtlas(); await applyWorldSheets(); prepareBlockTables(); buildIcons(); await applyGeneratedItemIcons();
    paintCharacter(); initGL(canvas);
    makeUITextures();
    const badSave = loadSave(); paintCharacter();
    applyVisualSettings(); renderTouch();
    screenEvents(); touchEvents(); bindInput();
    const ro = new ResizeObserver(() => { resize(); applyVisualSettings(); if (ED) renderEdBar(); }); ro.observe(canvas); ctx.onCleanup(() => ro.disconnect()); resize();
    showLanding();
    if (badSave) toast(tr('저장된 데이터를 읽지 못해 새로 시작해요.'));
    last = performance.now(); raf = requestAnimationFrame(frame);
  },
  pause() { if (G && !G.loading && (!G.ui || G.ui === 'chat' || ['inventory', 'creative', 'table', 'container'].includes(G.ui))) { if (G.ui && G.ui !== 'chat') closeScreen(); else if (G.ui === 'chat') closeChat(); showPause(); } if (audio) audio.suspend().catch(() => { }); persist(); },
  resume() { if (audio && !muted) audio.resume().catch(() => { }); if (G && G.ui === 'pause') { hideScreens(); G.ui = null; hint(tr('화면을 클릭하면 다시 조작할 수 있어요.')); } },
  setMuted(v) { muted = v; if (!v) wake(); else if (audio) audio.suspend().catch(() => { }); },
  unmount() {
    try { persist(); } catch { }
    disposed = true; cancelAnimationFrame(raf);
    if (document.pointerLockElement) document.exitPointerLock();
    try { audio && audio.close(); } catch { }
    try { if (W) for (const ch of W.chunks.values()) freeChunkGL(ch); const ext = gl && gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); } catch { }
    root.replaceChildren();
  },
});

