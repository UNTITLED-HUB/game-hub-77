// ─────────────────────────── player, survival, interaction ───────────────────────────
let G = null, P = null, shake = 0;
const input = { fwd: 0, side: 0, jump: false, sneak: false, descend: false, sprintKey: false, mine: false, use: false, click: false };
// creative flight on/off; lifts you off the ground a little so you don't land straight away
function setFlying(on) {
  if (!G || G.mode !== 'creative') return;
  P.flying = on; P.vy = on && P.onGround ? 4 : 0;
  if (on && touchSneak) { touchSneak = false; input.sneak = touchDown; }
  buzz(10);
}
const keys = {};

function newPlayer(spawn) {
  return { x: spawn.x, y: spawn.y, z: spawn.z, vx: 0, vy: 0, vz: 0, w: 0.3, h: 1.8, yaw: 0.6, pitch: -0.15, onGround: false, inWater: false, eyeInWater: false,
    flying: false, sneaking: false, sprinting: false, fallStart: spawn.y, health: 20, hunger: 20, sat: 5, exhaustion: 0, airT: 15, hurt: 0, regenT: 0, starveT: 0, drownT: 0, cactusT: 0, voidT: 0,
    dead: false, swingT: -1, swingOffT: -1, draw: 0, noArrowT: 0, atkT: 1, heldId: -1, useHand: 0, usePrev: false, minePrev: false, mineLock: false, bodyYaw: 0, bob: 0, eating: 0, mining: null, mineCd: 0, useCd: 0, attackCd: 0, poison: 0, lastJump: 0, lastFwd: 0, jumpCd: 0, stepAcc: 0 };
}
const eyeHeight = () => P.sneaking && !P.flying ? 1.27 : 1.62;
const lookDir = () => [Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)];
// HSEL picks the hand that use/consume helpers act on: 0 = main hand (hotbar), 1 = off-hand
let HSEL = 0;
const held = () => HSEL ? G.off : G.inv[G.sel];
const setHeld = v => { if (HSEL) G.off = v; else G.inv[G.sel] = v; };
function withHand(h, fn) { const o = HSEL; HSEL = h; try { return fn(); } finally { HSEL = o; } }
function swapHands() { if (!G || P.dead) return; const a = G.inv[G.sel]; G.inv[G.sel] = G.off; G.off = a; P.atkT = 0; P.draw = 0; P.eating = 0; sfx('equip', 0.5); invChanged(); }

function addToInventory(id, count, dmg = 0) {
  const ms = maxStack(id), inv = G.inv;
  if (ms > 1) for (let i = 0; i < 36; i++) { const s = inv[i]; if (s && s.id === id && s.count < ms) { const k = Math.min(ms - s.count, count); s.count += k; count -= k; if (!count) return 0; } }
  for (let i = 0; i < 36; i++) if (!inv[i]) { const k = Math.min(ms, count); inv[i] = { id, count: k, dmg }; count -= k; if (!count) return 0; }
  return count;
}
function consumeHeld(n = 1) { if (G.mode === 'creative') return; const s = held(); if (!s) return; s.count -= n; if (s.count <= 0) setHeld(null); invChanged(); }
function damageTool(n) {
  if (G.mode === 'creative') return; const s = held(); const t = s && toolOf(s.id); if (!t) return;
  if(s.enchants?.unbreaking&&Math.random()<s.enchants.unbreaking/(s.enchants.unbreaking+1))return;
  s.dmg = (s.dmg || 0) + n;
  if (s.dmg >= t.dur) { setHeld(null); sfx('toolbreak'); toast(tr('{0}이(가) 부서졌어요!', info(s.id).name)); }
  invChanged();
}

// ── ray casting ──
// blocks that don't fill their cell get their real outline, so you can aim past them (e.g. hit a pig
// standing behind tall grass instead of breaking the grass)
function blockBox(id) { const b = BLOCK[id]; if (!b) return null; if (b.render === 'cross') return [0.12, 0, 0.12, 0.88, 0.8, 0.88]; if (b.render === 'torch') return [0.38, 0, 0.38, 0.62, 0.65, 0.62]; if (b.height) return [0, 0, 0, 1, b.height, 1]; return null; }
function rayBox(o, d, mn, mx) {
  let t0 = 0, t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) return -1; continue; }
    let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k]; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1;
  }
  return t0;
}
function raycast(o, d, maxD, fluids) {
  let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
  const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
  const tdx = sx ? Math.abs(1 / d[0]) : Infinity, tdy = sy ? Math.abs(1 / d[1]) : Infinity, tdz = sz ? Math.abs(1 / d[2]) : Infinity;
  let tmx = sx ? (sx > 0 ? (x + 1 - o[0]) : (o[0] - x)) * tdx : Infinity, tmy = sy ? (sy > 0 ? (y + 1 - o[1]) : (o[1] - y)) * tdy : Infinity, tmz = sz ? (sz > 0 ? (z + 1 - o[2]) : (o[2] - z)) * tdz : Infinity;
  let t = 0, face = -1, px = x, py = y, pz = z;
  while (t <= maxD) {
    const id = getBlock(x, y, z);
    if (id && (!isWater(id) || (fluids && id === WATER))) {
      const bb = blockBox(id), bt = bb ? rayBox(o, d, [x + bb[0], y + bb[1], z + bb[2]], [x + bb[3], y + bb[4], z + bb[5]]) : t;
      if (!(isWater(id) && !fluids) && bt >= 0 && bt <= maxD) return { x, y, z, id, face, px, py, pz, t: bt };
    }
    px = x; py = y; pz = z;
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; face = sx > 0 ? 1 : 0; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; face = sy > 0 ? 3 : 2; }
    else { z += sz; t = tmz; tmz += tdz; face = sz > 0 ? 5 : 4; }
    if (y < YMIN-1 || y > WH) break;
  }
  return null;
}
function rayMob(o, d, maxD) {
  let best = null, bt = maxD;
  for (const m of W.mobs) {
    if (m.dead) continue;
    const mn = [m.x - m.w, m.y, m.z - m.w], mx = [m.x + m.w, m.y + m.h, m.z + m.w];
    let t0 = 0, t1 = bt, ok = true;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) { ok = false; break; } continue; }
      let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 < bt) { bt = t0; best = m; }
  }
  return best;
}

// ── mining & placing ──
const isLeaves = id => id === LEAVES || id === SPRUCE_LEAVES || id === BIRCH_LEAVES;
const isWool = id => id === WOOL || (id >= COLOR_WOOL && id < COLOR_WOOL + 8);
function startSwing() { const k = HSEL ? 'swingOffT' : 'swingT'; if (P[k] < 0 || P[k] >= 0.5) P[k] = 0; }
function canHarvest(b, tool) { return !b.tier || (tool && tool.kind === 'pickaxe' && tool.level >= b.tier); }
function breakTime(id) {
  const b = BLOCK[id]; if (!b || b.hard < 0) return Infinity; if (b.hard === 0) return 0.05;
  const s = held(), tool = s && toolOf(s.id);
  let speed = 1;
  if (tool && tool.kind === b.tool) speed = tool.speed;
  if (tool && tool.kind === 'sword' && (id === LEAVES || id === SPRUCE_LEAVES || id === BIRCH_LEAVES || id === MELON || id === PUMPKIN)) speed = 1.5;
  if (tool && tool.kind === 'shears') speed = isLeaves(id) ? 15 : isWool(id) ? 5 : 1;
  if (P.eyeInWater) speed /= 5;
  if (!P.onGround && !P.flying && !P.inWater) speed /= 5;
  return b.hard * (canHarvest(b, tool) ? 1.5 : 5) / speed;
}
function material(id) {
  const b = BLOCK[id]; if (!b) return 'soft';
  if (id === GLASS || id === ICE || id === GLOWSTONE) return 'glass';
  if (b.tool === 'pickaxe') return 'stone'; if (b.tool === 'axe') return 'wood'; if (b.tool === 'shovel') return id === SAND || id === GRAVEL ? 'sand' : 'dirt';
  return b.render === 'cross' || b.render === 'cutout' ? 'grass' : 'soft';
}
function breakBlock(t) {
  const id = t.id, b = BLOCK[id];
  if (G.mode === 'survival') {
    const s = held(), tool = s && toolOf(s.id);
    if (tool && tool.kind === 'shears' && (isLeaves(id) || id === TALL_GRASS || id === DEAD_BUSH)) spawnItem(id, 1, t.x + 0.5, t.y + 0.4, t.z + 0.5);
    else if (canHarvest(b, tool)) dropBlockItems(t.x, t.y, t.z, id);
    else { const te = W.te.get(pkey(t.x, t.y, t.z)); if (te) for (const sl of te.slots) if (sl) spawnItem(sl.id, sl.count, t.x + 0.5, t.y + 0.5, t.z + 0.5, sl.dmg); }
    if (tool && b.hard > 0) damageTool(tool.kind === 'sword' ? 2 : 1);
    P.exhaustion += 0.005;
    G.stats.mined++;
  }
  const replace = (id === ICE && G.mode === 'survival' && getBlock(t.x, t.y - 1, t.z) !== AIR) ? WATER : AIR;
  setBlock(t.x, t.y, t.z, replace);
  blockParticles(t.x, t.y, t.z, id);
  sfx('break_' + material(id)); buzz(12);
  if (G.ui === 'container' && G.container && G.container.pos === pkey(t.x, t.y, t.z)) closeScreen();
}
// ── combat (follows the original 1.9+ rules) ──
// attack strength refills at the weapon's attack speed; damage = base × (0.2 + 0.8·strength²)
// critical: full strength while falling, not sprinting/flying/in water → ×1.5
// sprint hit: full strength while sprinting → extra knockback (and stops the sprint)
// sweep: full-strength sword hit on the ground → 1 damage to mobs right next to the target
const classicCombat = () => SAVE.settings.combat === 'classic';
const weaponOf = () => { const s = G.inv[G.sel], t = s && toolOf(s.id); return { dmg: t && t.dmg != null ? t.dmg : 1, spd: t && t.aspd ? t.aspd : 4, kind: t ? t.kind : null }; };
const attackStrength = () => classicCombat() ? 1 : clamp(P.atkT * weaponOf().spd, 0, 1);
function attack(m) {
  const s = G.inv[G.sel], tool = s && toolOf(s.id), w = weaponOf(), str = attackStrength(), full = str > 0.9, classic = classicCombat();
  let dmg = Math.max(0,w.dmg+(held()?.enchants?.sharpness||0)*.5+3*(effectLevel(P,'strength')+1)-4*(effectLevel(P,'weakness')+1)) * (0.2 + str * str * 0.8);
  const sprintHit = full && P.sprinting && !classic;
  const crit = full && P.vy < 0 && !P.onGround && !P.inWater && !P.flying && (classic || !P.sprinting);
  if (crit) dmg *= 1.5;
  const fall = P.fallStart - P.y;
  if (w.kind === 'mace' && fall > 1.5 && !P.onGround) { dmg += fall <= 3 ? 4 * fall : fall <= 8 ? 12 + 2 * (fall - 3) : 22 + (fall - 8); P.fallStart = P.y; P.vy = Math.max(P.vy, 4); shake = Math.max(shake, 0.4); sfx('boom', 0.35); }
  const sweep = !classic && full && !crit && !sprintHit && P.onGround && w.kind === 'sword' && Math.hypot(P.vx, P.vz) < 4.4;
  dmg = Math.round(dmg * 100) / 100;
  P.atkT = 0;
  if (hurtMob(m, dmg, P.x, P.z, false, (sprintHit ? 1.7 : 1) * (0.35 + 0.65 * str))) {
    if (m.type === 'spider') m.angry = true;
    dmgNumber(m, dmg, crit);
    if (crit) { critParticles(m); sfx('crit'); } else sfx(sprintHit ? 'knock' : full ? 'strong' : 'weak');
    if (sweep) {
      sweepParticle(m); sfx('sweep');
      for (const o of W.mobs) if (o !== m && !o.dead && Math.hypot(o.x - m.x, o.z - m.z) < 1.6 && Math.abs(o.y - m.y) < 1 && Math.hypot(o.x - P.x, o.z - P.z) < 4) { if (hurtMob(o, 1, P.x, P.z, false, 0.45)) dmgNumber(o, 1, false); }
    }
    if (sprintHit) { P.sprinting = false; P.vx *= 0.6; P.vz *= 0.6; }
    if (tool) damageTool(tool.kind === 'sword' ? 1 : 2);
    P.exhaustion += 0.1;
  } else sfx('weak', 0.5);
  startSwing();
}
function critParticles(m) {
  const pq = SAVE.settings.particles ?? 2; if (pq === 0) return;
  for (let i = 0; i < (pq === 1 ? 6 : 12); i++) { const a = Math.random() * 6.28, r = Math.random(); W.particles.push({ x: m.x + Math.cos(a) * m.w * 1.2, y: m.y + m.h * (0.4 + Math.random() * 0.6), z: m.z + Math.sin(a) * m.w * 1.2, vx: Math.cos(a) * (2 + r * 2), vy: 1 + Math.random() * 2.5, vz: Math.sin(a) * (2 + r * 2), life: 0.5 + Math.random() * 0.3, tile: T.crit, su: 0, sv: 0, full: true, size: 0.09, grav: 6 }); }
}
function sweepParticle(m) { const d = lookDir(); W.particles.push({ x: m.x - d[0] * 0.3, y: m.y + m.h * 0.55, z: m.z - d[2] * 0.3, vx: 0, vy: 0, vz: 0, life: 0.25, tile: T.sweep, su: 0, sv: 0, full: true, size: 0.75, grav: 0, glow: true }); }
function dmgNumber(m, v, crit) { if (!SAVE.settings.dmgNumbers) return; (W.dnums || (W.dnums = [])).push({ x: m.x + (Math.random() - 0.5) * 0.4, y: m.y + m.h + 0.2, z: m.z + (Math.random() - 0.5) * 0.4, v, crit, t: 0 }); }
function facingFor() { const d = lookDir(); return Math.abs(d[0]) > Math.abs(d[2]) ? (d[0] > 0 ? 1 : 0) : (d[2] > 0 ? 5 : 4); }
function tryPlace(t, id) {
  const tb = BLOCK[t.id];
  let x = t.px, y = t.py, z = t.pz;
  if (tb && tb.replaceable && !tb.fluid) { x = t.x; y = t.y; z = t.z; }
  if (y < YMIN || y >= WH) { toast(tr('여기에는 설치할 수 없어요.')); return false; }
  const cur = getBlock(x, y, z), cb = BLOCK[cur];
  if (cur !== AIR && !(cb && cb.replaceable)) return false;
  const b = BLOCK[id];
  if (b.solid) {
    const hit = e => x + 1 > e.x - e.w && x < e.x + e.w && y + 1 > e.y && y < e.y + e.h && z + 1 > e.z - e.w && z < e.z + e.w;
    if (hit(P) || W.mobs.some(m => !m.dead && hit(m))) return false;
  }
  const below = getBlock(x, y - 1, z);
  if (b.needsFarm && below !== FARMLAND) { toast(tr('경작지에만 심을 수 있어요.')); return false; }
  if (b.needsSoil && !(below === GRASS || below === DIRT || below === SNOW_GRASS)) { toast(tr('{0}은(는) 흙이나 잔디 위에만 심을 수 있어요.', b.name)); return false; }
  if (b.needsSand && !(below === SAND || below === DIRT || below === GRASS)) { toast(tr('모래 위에만 심을 수 있어요.')); return false; }
  if (b.needsFloor && !solidAt(x, y - 1, z)) { toast(tr('블록 윗면에만 설치할 수 있어요.')); return false; }
  if (id === CACTUS && !(below === SAND || below === CACTUS)) { toast(tr('선인장은 모래 위에만 자라요.')); return false; }
  if (b.facing || b.use === 'chest' || b.use === 'furnace') {
    const facing = facingFor();
    if (b.use === 'furnace') W.te.set(pkey(x, y, z), { type: 'furnace', facing, slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 });
    else if (b.use === 'chest') W.te.set(pkey(x, y, z), { type: 'chest', facing, slots: Array(27).fill(null) });
  }
  if (cur !== AIR && cb && cb.replaceable && !cb.fluid) dropBlockItems(x, y, z, cur);
  if(id===BED){if(getBlock(x,y,z+1)!==AIR || !solidAt(x,y-1,z+1) || Math.abs(P.z-z-1.5)<P.w && Math.abs(P.x-x-0.5)<P.w+0.5){toast(tr('침대는 앞뒤 두 칸의 빈 공간과 바닥이 필요해요.'));return false;}setBlock(x,y,z+1,BED_HEAD);}
  setBlock(x, y, z, id);
  if (b.facing && !b.use) W.te.set(pkey(x, y, z), { type: 'facing', facing: facingFor(), slots: [] });
  if (b.use === 'crop') W.te.set(pkey(x, y, z), { type: 'crop', t: W.time, slots: [] });
  if (b.use === 'chest' || b.use === 'furnace' || b.facing) { const ch = getChunk(x >> 4, z >> 4); if (ch) ch.needMesh = true; }
  sfx('place_' + material(id)); startSwing();
  G.stats.placed++;
  return true;
}
function useItem() {
  const t = raycast(eyePos(), lookDir(), REACH, false);
  const s = held(), id = s ? s.id : 0;
  if(id===SHIELD){P.blocking=.4;return;}
  if(ITEM[id]?.potion){const {effect,time}=ITEM[id].potion;if(effect==='instant_health')P.health=Math.min(20,P.health+8);else{P.effects??={};P.effects[effect]={time,amp:0};}consumeHeld(1);addToInventory(GLASS_BOTTLE,1);invChanged();sfx('burp');return;}
  if (ITEM[id]?.milk) { P.effects = {}; P.poison = 0; if (G.mode === 'survival') setHeld({ id: BUCKET, count: 1, dmg: 0 }); invChanged(); sfx('burp'); return; }
  if (ITEM[id]?.pearl) { throwPearl(); return; }
  if (ITEM[id]?.rocket) { useRocket(); return; }
  if (t && !P.sneaking) {
    const b = BLOCK[t.id];
    if(b && b.use==='endframe'&&id===ENDER_EYE){activateEndFrame(t);return;}
    const lighter = id===FLINT_STEEL || ITEM[id]?.lighter;
    if(t.id===OBSIDIAN&&lighter){if(ignitePortal(t)){if(id===FLINT_STEEL)damageTool(1);else consumeHeld(1);}else toast(tr('흑요석 틀의 안쪽 너비는 2~21칸, 높이는 3~21칸이어야 합니다.'));return;}
    if (b && b.use === 'note') { sfx('note', 1); noteParticle(t); return; }
    if (b && b.use === 'bell') { sfx('bell', 1); startSwing(); return; }
    if (useOnBlock(t, s, id)) return;
    
    if (b && b.use === 'table') { openScreen('table'); return; }
    if (b && (b.use === 'furnace' || b.use === 'chest')) {
      const k = pkey(t.x, t.y, t.z);
      if (!W.te.has(k)) W.te.set(k, b.use === 'furnace' ? { type: 'furnace', facing: 4, slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 } : { type: 'chest', facing: 4, slots: Array(27).fill(null) });
      G.container = { pos: k, te: W.te.get(k) }; openScreen(b.use); sfx('chest'); return;
    }
    if (b && b.use === 'tnt' && lighter) { setBlock(t.x, t.y, t.z, AIR); primeTNT(t.x, t.y, t.z); if (id === FLINT_STEEL) damageTool(1); else consumeHeld(1); startSwing(); return; }
    if (b && b.use === 'bed') { trySleep(t); return; }
  }
  // shear a sheep
  const tm = G.targetMob;
  if (id === SHEARS && tm && tm.type === 'sheep' && !tm.sheared && !tm.dead) {
    tm.sheared = 60 + Math.random() * 60; spawnItem(tm.color >= 8 ? COLOR_WOOL + 7 : WOOL, 1 + Math.floor(Math.random() * 3), tm.x, tm.y + 1, tm.z);
    sfx('shear'); damageTool(1); startSwing(); return;
  }
  // put on armor straight from the hand
  const arm = armorOf(id);
  if (arm) { const cur = G.armor[arm.slot]; G.armor[arm.slot] = s; setHeld(cur); sfx('equip'); startSwing(); hudDirty = true; invChanged(); return; }
  if(id===LAVA_BUCKET&&t){if(W.dimension==='end'||W.dimension==='nether'||W.dimension==='overworld'){if(setBlock(t.px,t.py,t.pz,LAVA)&&G.mode==='survival')setHeld({id:BUCKET,count:1,dmg:0});}return;}
  if (id === BUCKET) {
    const w = raycast(eyePos(), lookDir(), REACH, true);
    if(w&&w.id===LAVA){setBlock(w.x,w.y,w.z,AIR);if(G.mode==='survival')setHeld({id:LAVA_BUCKET,count:1,dmg:0});invChanged();return;}
    if (w && w.id === WATER) {
      setBlock(w.x, w.y, w.z, AIR); sfx('bucket');
      if (G.mode === 'survival') { if (s.count > 1) { s.count--; if (addToInventory(WATER_BUCKET, 1)) spawnItem(WATER_BUCKET, 1, P.x, P.y + 1, P.z); } else setHeld({ id: WATER_BUCKET, count: 1, dmg: 0 }); invChanged(); }
    }
    return;
  }
  if(ITEM[id]?.spawnMob&&t){const d=MOBDEF[ITEM[id].spawnMob];if(!solidAt(t.px,t.py,t.pz)){spawnMob(ITEM[id].spawnMob,t.px+0.5,t.py,t.pz+0.5);consumeHeld(1);}return;}
  if(G.targetMob?.type==='villager'&&id===EMERALD){consumeHeld(1);addToInventory(BREAD,3);invChanged();toast(tr('에메랄드 1개로 빵 3개를 샀습니다.'));return;}
  if (id === WATER_BUCKET && t) {
    if(W.dimension==='nether'){if(G.mode==='survival')setHeld({id:BUCKET,count:1,dmg:0});sfx('hiss');toast(tr('네더에서는 물이 증발합니다.'));return;}
    const tb = BLOCK[t.id]; let x = t.px, y = t.py, z = t.pz;
    if (tb && tb.replaceable) { x = t.x; y = t.y; z = t.z; }
    const cur = getBlock(x, y, z);
    if (cur === AIR || (BLOCK[cur] && BLOCK[cur].replaceable)) {
      if (cur !== AIR && !isWater(cur)) dropBlockItems(x, y, z, cur);
      setBlock(x, y, z, WATER); sfx('bucket');
      if (G.mode === 'survival') { setHeld({ id: BUCKET, count: 1, dmg: 0 }); invChanged(); }
    }
    return;
  }
  if (t && id && id < 256 && BLOCK[id]) { if (tryPlace(t, id)) consumeHeld(1); }
}
function eat(s) {
  const it = ITEM[s.id], f = it.food;
  P.hunger = Math.min(20, P.hunger + f[0]); P.sat = Math.min(P.hunger, P.sat + f[1]);
  if (it.poison && Math.random() < it.poison) { P.poison = 30; toast(tr('속이 좋지 않아요… 배고픔이 빨리 줄어요.')); }
  if (it.effects) { P.effects ??= {}; for (const [e, time, amp] of it.effects) P.effects[e] = { time, amp }; }
  consumeHeld(1); sfx('burp');
  if (it.bowl && G.mode === 'survival') { if (!held()) setHeld({ id: BOWL, count: 1, dmg: 0 }); else if (addToInventory(BOWL, 1)) spawnItem(BOWL, 1, P.x, P.y + 1, P.z); }
  if (it.bottle && G.mode === 'survival') { if (addToInventory(GLASS_BOTTLE, 1)) spawnItem(GLASS_BOTTLE, 1, P.x, P.y + 1, P.z); }
  if (it.teleport) randomTeleport(8);
  invChanged();
}
// ── new item interactions: hoes, shovels, axes, bone meal, seeds, rockets, pearls ──
function useOnBlock(t, s, id) {
  const tool = toolOf(id), above = getBlock(t.x, t.y + 1, t.z), top = t.py === t.y + 1;
  const done = (snd, dmg) => { if (snd) sfx(snd); if (dmg) damageTool(1); startSwing(); return true; };
  if (tool && tool.kind === 'hoe' && (t.id === GRASS || t.id === DIRT || t.id === DIRT_PATH) && (above === AIR || BLOCK[above]?.replaceable)) { if (above !== AIR) setBlock(t.x, t.y + 1, t.z, AIR); setBlock(t.x, t.y, t.z, FARMLAND); return done('place_dirt', true); }
  if (tool && tool.kind === 'shovel' && (t.id === GRASS || t.id === DIRT || t.id === SNOW_GRASS) && above === AIR) { setBlock(t.x, t.y, t.z, DIRT_PATH); return done('place_dirt', true); }
  if (tool && tool.kind === 'axe' && t.id === LOG) { setBlock(t.x, t.y, t.z, STRIPPED_LOG); return done('place_wood', true); }
  if (id === SHEARS && t.id === PUMPKIN) { setBlock(t.x, t.y, t.z, CARVED_PUMPKIN); W.te.set(pkey(t.x, t.y, t.z), { type: 'facing', facing: facingFor(), slots: [] }); spawnItem(PUMPKIN_SEEDS, 4, t.x + 0.5, t.y + 1, t.z + 0.5); return done('shear', true); }
  if (ITEM[id]?.bonemeal) {
    if (t.id === WHEAT_CROP) { setBlock(t.x, t.y, t.z, WHEAT_RIPE); boneParticles(t); consumeHeld(1); return done(); }
    if (t.id === SAPLING) { if (Math.random() < 0.45) growTree(t.x, t.y, t.z); boneParticles(t); consumeHeld(1); return done(); }
    if (t.id === GRASS && above === AIR) { for (let i = 0; i < 14; i++) { const x = t.x + Math.round((Math.random() - 0.5) * 6), z = t.z + Math.round((Math.random() - 0.5) * 6); for (let y = t.y + 2; y >= t.y - 2; y--) if (getBlock(x, y, z) === GRASS && getBlock(x, y + 1, z) === AIR) { const r = Math.random(); setBlock(x, y + 1, z, r < 0.75 ? TALL_GRASS : r < 0.85 ? FLOWER_YELLOW : r < 0.93 ? FLOWER_RED : CORNFLOWER); break; } } boneParticles(t); consumeHeld(1); return done(); }
  }
  const crop = ITEM[id]?.plant;
  if (crop && t.id === FARMLAND && top && above === AIR) { setBlock(t.x, t.y + 1, t.z, crop); if (BLOCK[crop].use === 'crop') W.te.set(pkey(t.x, t.y + 1, t.z), { type: 'crop', t: W.time, slots: [] }); consumeHeld(1); return done('place_grass'); }
  return false;
}
function boneParticles(t) { particles(t.x + 0.5, t.y + 0.7, t.z + 0.5, T.c_emerald_block, 8, 0.3, 1.5, 0.5); }
function noteParticle(t) { particles(t.x + 0.5, t.y + 1.2, t.z + 0.5, T.c_emerald_block, 3, 0.1, 1, 0.4); }
function useRocket() {
  if (P.gliding) { P.rocketT = 1.1 + Math.random() * 0.4; consumeHeld(1); sfx('rocket'); return; }
  const t = G.target; if (!t) return;
  particles(t.px + 0.5, t.py + 1.5, t.pz + 0.5, T.glowstone, 18, 0.6, 3, 0.8); sfx('rocket'); consumeHeld(1);
}
function throwPearl() {
  const d = lookDir(), t = raycast(eyePos(), d, 40, false);
  if (!t) { toast(tr('너무 멀어요.')); return; }
  const x = t.px + 0.5, z = t.pz + 0.5; let y = t.py;
  if (solidAt(t.px, y, t.pz) || solidAt(t.px, y + 1, t.pz)) return;
  consumeHeld(1); particles(P.x, P.y + 1, P.z, T.c_purpur, 12, 0.4, 2, 0.6);
  Object.assign(P, { x, y, z, vx: 0, vy: 0, vz: 0, fallStart: y }); sfx('pearl');
  if (G.mode === 'survival') damagePlayer(5, 'fall');
}
function randomTeleport(r) {
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(P.x + (Math.random() - 0.5) * r * 2), z = Math.floor(P.z + (Math.random() - 0.5) * r * 2);
    for (let y = Math.floor(P.y) + 8; y > Math.floor(P.y) - 8; y--) if (solidAt(x, y - 1, z) && !solidAt(x, y, z) && !solidAt(x, y + 1, z) && !isWater(getBlock(x, y, z))) { Object.assign(P, { x: x + 0.5, y, z: z + 0.5, vx: 0, vy: 0, vz: 0, fallStart: y }); sfx('pearl'); return; }
  }
}
const eyePos = () => [P.x, P.y + eyeHeight(), P.z];

// "use" goes to the main hand first and falls back to the off-hand when the main hand has nothing to
// do (e.g. sword in the main hand, torch in the off-hand), like the original
const hasArrow = () => (G.off && G.off.id === ARROW) || G.inv.some(x => x && x.id === ARROW);
function canUse(s) {
  if (!s) return false;
  const id = s.id, t = G.target;
  if (id < 256) return !!t;
  const it = ITEM[id];
  if (it.food) return G.mode === 'survival' && P.hunger < 20;
  if (it.armor || id === BUCKET || id === WATER_BUCKET || it.milk || it.pearl || it.rocket || id === SPYGLASS) return true;
  if ((it.tool && ['hoe', 'shovel', 'axe'].includes(it.tool.kind)) || it.bonemeal || it.plant || it.lighter) return !!t;
  if (id === BOW) return G.mode === 'creative' || hasArrow();
  if (id === FLINT_STEEL) return !!t;
  if (id === SHEARS) return !!(G.targetMob && G.targetMob.type === 'sheep' && !G.targetMob.sheared);
  return false;
}
function pickUseHand() {
  if (G.target && !P.sneaking) { const b = BLOCK[G.target.id]; if (b && b.use && b.use !== 'tnt') return 0; } // tables, chests, beds…
  if (canUse(G.inv[G.sel])) return 0;
  if (canUse(G.off)) return 1;
  return 0;
}
function updateInteraction(dt) {
  for (const k of ['swingT', 'swingOffT']) if (P[k] >= 0) { P[k] += dt / 0.3; if (P[k] >= 1) P[k] = -1; }
  P.noArrowT = Math.max(0, P.noArrowT - dt);
  P.mineCd = Math.max(0, P.mineCd - dt); P.useCd = Math.max(0, P.useCd - dt); P.attackCd = Math.max(0, P.attackCd - dt);
  P.atkT += dt;
  const s = G.inv[G.sel], sid = s ? s.id : 0;
  if (sid !== P.heldId) { P.heldId = sid; P.atkT = 0; } // switching items resets the attack meter
  const fluids = (s && s.id === BUCKET) || (G.off && G.off.id === BUCKET);
  const eye = eyePos(), dir = lookDir();
  G.target = raycast(eye, dir, REACH, fluids);
  const tTarget = G.target ? G.target.t : REACH;
  G.targetMob = rayMob(eye, dir, Math.min(G.mode === 'creative' ? 5 : 3.5, tTarget + 0.01));
  // a click shorter than one frame (slow phones) is latched in input.click so it still counts
  const edge = (input.mine && !P.minePrev) || input.click, pressing = input.mine || input.click; P.minePrev = input.mine; input.click = false;
  if (!pressing) P.mineLock = false;
  if (pressing && !P.dead) {
    if (G.targetMob) {
      // click = hit right away; holding = hit again whenever the attack meter is full
      P.mining = null; P.mineLock = true;
      if (edge || (classicCombat() ? P.attackCd <= 0 : attackStrength() >= 1 && P.attackCd <= 0)) { attack(G.targetMob); P.attackCd = classicCombat() ? 0.25 : 0.1; }
    } else if (P.mineLock) {
      // this press already hit a mob: don't start digging the grass under it when it moves away or dies
      P.mining = null;
    } else if (G.target && !isWater(G.target.id)) {
      const t = G.target;
      if (G.mode === 'creative') { if (P.mineCd <= 0) { if (!(s && toolOf(s.id) && toolOf(s.id).kind === 'sword')) breakBlock(t); P.mineCd = 0.22; startSwing(); } }
      else if (P.mineCd <= 0) {
        if (!P.mining || P.mining.x !== t.x || P.mining.y !== t.y || P.mining.z !== t.z || P.mining.id !== t.id) P.mining = { x: t.x, y: t.y, z: t.z, id: t.id, p: 0, snd: 0 };
        const bt = breakTime(t.id)/(1+(held()?.enchants?.efficiency||0)**2)/Math.max(.1,1+.2*(effectLevel(P,'haste')+1)-.2*(effectLevel(P,'mining_fatigue')+1));
        P.mining.p += dt / bt; P.mining.snd -= dt; if (P.swingT < 0) startSwing();
        if (P.mining.snd <= 0) { P.mining.snd = 0.24; sfx('dig_' + material(t.id), 0.5); digParticles(t); }
        if (P.mining.p >= 1) { breakBlock(t); P.mining = null; P.mineCd = 0.12; }
      }
    } else { P.mining = null; if (edge) { startSwing(); P.atkT = 0; } }
  } else P.mining = null;
  // pick the hand for this "use" press
  if (input.use && !P.usePrev) P.useHand = pickUseHand();
  P.usePrev = input.use;
  withHand(P.useHand || 0, () => {
    const h = held();
    // bow: hold "use" to draw, release to shoot
    const bow = h && h.id === BOW;
    if (bow && input.use && !P.dead) {
      if (P.draw > 0) P.draw = Math.min(1.5, P.draw + dt);
      else if (G.mode === 'creative' || hasArrow()) P.draw = 0.001;
      else if (!P.noArrowT) { toast(tr('화살이 없어요.')); P.noArrowT = 2; }
      return;
    }
    if (P.draw > 0) { if (bow && !P.dead) shootArrow(P.draw); P.draw = 0; }
    if (input.use && !P.dead) {
      const f = h && ITEM[h.id] && ITEM[h.id].food;
      const plants = h && ITEM[h.id] && ITEM[h.id].plant && G.target && G.target.id === FARMLAND;
      if (h && h.id === SPYGLASS) { P.zoom = true; }
      else if (f && !plants && P.hunger < 20 && G.mode === 'survival') {
        P.eating += dt; if (Math.random() < dt * 6) { sfx('eat', 0.4); particles(P.x + Math.sin(P.yaw) * 0.4, P.y + 1.4, P.z - Math.cos(P.yaw) * 0.4, T[ITEM[h.id].icon], 1, 0.1, 1.5, 0.4); }
        if (P.eating >= 1.6) { P.eating = 0; eat(h); }
      } else if (P.useCd <= 0) { useItem(); P.useCd = 0.24; }
    } else P.eating = 0;
    if (!input.use) P.zoom = false;
  });
}

// ── movement ──
function updatePlayer(dt) {
  if (P.dead) return;
  const creative = G.mode === 'creative';
  if (!creative) P.flying = false;
  P.sneaking = input.sneak && !P.flying;
  const fwd = input.fwd, side = input.side, moving = fwd || side;
  if (fwd <= 0 || P.sneaking || (P.hunger <= 6 && !creative) || P.eating > 0) P.sprinting = false;
  if ((input.sprintKey && fwd > 0) && !P.sneaking && (P.hunger > 6 || creative)) P.sprinting = true;
  P.inWater = entityInWater(P, 0.4); P.eyeInWater = isWater(getBlock(Math.floor(P.x), Math.floor(P.y + eyeHeight()), Math.floor(P.z)));
  let speed = (P.flying ? (P.sprinting ? 21.6 : 10.9) : P.sneaking ? 1.31 : P.sprinting ? 5.61 : 4.317)*Math.max(.1,1+.2*(effectLevel(P,'speed')+1)-.15*(effectLevel(P,'slowness')+1));
  if (P.inWater && !P.flying) speed *= 0.45;
  if (P.eating > 0 || P.draw > 0) speed *= 0.35;
  const web = BLOCK[getBlock(Math.floor(P.x), Math.floor(P.y + 0.2), Math.floor(P.z))]?.web || BLOCK[getBlock(Math.floor(P.x), Math.floor(P.y + 1.2), Math.floor(P.z))]?.web;
  if (web && !P.flying) speed *= 0.25;
  const n = Math.max(1, Math.hypot(fwd, side));
  const wx = (Math.sin(P.yaw) * fwd + Math.cos(P.yaw) * side) / n * speed, wz = (-Math.cos(P.yaw) * fwd + Math.sin(P.yaw) * side) / n * speed;
  const below = getBlock(Math.floor(P.x), Math.floor(P.y - 0.05), Math.floor(P.z));
  const icy = below === ICE;
  const acc = P.flying ? 6 : P.onGround ? (icy ? 1.6 : 16) : P.inWater ? 6 : 3.5;
  if (!P.gliding) { P.vx += (wx - P.vx) * Math.min(1, acc * dt); P.vz += (wz - P.vz) * Math.min(1, acc * dt); }
  if (P.gliding) glidePhysics(dt);
  else if (P.flying) {
    const ty = ((input.jump ? 1 : 0) - (input.descend ? 1 : 0)) * 8.5;
    P.vy += (ty - P.vy) * Math.min(1, 12 * dt);
  } else if (P.inWater) {
    if (input.jump) P.vy = Math.min(P.vy + 26 * dt, 3.4); else P.vy = Math.max(P.vy - 10 * dt, -2.6);
    P.fallStart = P.y;
  } else {
    if (input.jump && P.onGround && P.jumpCd <= 0) {
      P.vy = 8.95+3*(effectLevel(P,'jump_boost')+1); P.jumpCd = 0.08; P.exhaustion += P.sprinting ? 0.2 : 0.05;
      if (P.sprinting) { P.vx += Math.sin(P.yaw) * 2.2; P.vz -= Math.cos(P.yaw) * 2.2; }
    }
    P.vy -= GRAVITY * dt;P.vy=Math.max(P.vy,effectLevel(P,'slow_falling')>=0?-.5:-78);if(effectLevel(P,'slow_falling')>=0)P.fallStart=P.y;
    if (web) { P.vy = Math.max(P.vy, -1.2); P.fallStart = P.y; }
  }
  if(effectLevel(P,'levitation')>=0)P.vy=2*(effectLevel(P,'levitation')+1);
  if (P.gliding && (P.onGround || P.inWater || P.flying || !elytraUsable())) stopGlide();
  P.jumpCd = Math.max(0, (P.jumpCd || 0) - dt);
  const ox = P.x, oz = P.z;
  // sneaking keeps you on edges
  const edgeSafe = (nx, nz) => !P.sneaking || !P.onGround || boxHits(nx - P.w, P.y - 0.6, nz - P.w, nx + P.w, P.y - 0.01, nz + P.w);
  const dx = P.vx * dt, dz = P.vz * dt; P.vxPre = P.vx; P.vzPre = P.vz;
  let bx = false, bz = false;
  if (edgeSafe(P.x + dx, P.z)) bx = moveAxis(P, 'x', dx); else P.vx = 0;
  if (edgeSafe(P.x, P.z + dz)) bz = moveAxis(P, 'z', dz); else P.vz = 0;
  if (P.gliding && (bx || bz)) { const before = Math.hypot(P.vxPre || 0, P.vzPre || 0) / 20, after = Math.hypot(P.vx, P.vz) / 20, hit = (before - after) * 10 - 3; if (hit > 0 && G.mode === 'survival') damagePlayer(hit, 'fall'); }
  if (P.inWater && input.jump && (bx || bz)) P.vy = Math.max(P.vy, 5.2);
  if ((bx || bz) && P.sprinting && !P.flying) P.sprinting = false;
  // auto-jump (touch)
  if ((bx || bz) && G.settings.autoJump && P.onGround && moving && !P.sneaking && !P.flying) {
    const fx = Math.floor(P.x + Math.sin(P.yaw) * 0.6), fz = Math.floor(P.z - Math.cos(P.yaw) * 0.6), fy = Math.floor(P.y);
    if (solidAt(fx, fy, fz) && !solidAt(fx, fy + 1, fz) && !solidAt(fx, fy + 2, fz)) { P.vy = 8.4; }
  }
  const wasGround = P.onGround; P.onGround = false;
  if (moveAxis(P, 'y', P.vy * dt)) {
    const land = getBlock(Math.floor(P.x), Math.floor(P.y - 0.05), Math.floor(P.z));
    if (P.vy < -2 && BLOCK[land]?.bouncy && !P.sneaking) { P.vy = -P.vy * 0.82; P.fallStart = P.y; sfx('slime'); }
    else if (P.vy < 0) {
      P.onGround = true;
      if (P.flying && creative) P.flying = false;
      if (!wasGround) { const fall = (P.fallStart - P.y) * (land === HAY_BALE ? 0.2 : 1); if (fall > 3.4 && !P.inWater && !creative && !BLOCK[land]?.bouncy) damagePlayer(Math.ceil(fall - 3), 'fall'); if (fall > 1.2) sfx('step_' + material(getBlock(Math.floor(P.x), Math.floor(P.y - 0.1), Math.floor(P.z))), 0.6); }
    }
    if (!(BLOCK[land]?.bouncy && P.vy > 0)) P.vy = 0;
  }
  if (P.onGround || P.flying || P.inWater) P.fallStart = P.y; else P.fallStart = Math.max(P.fallStart, P.y);
  // footsteps, bobbing, exhaustion
  const moved = Math.hypot(P.x - ox, P.z - oz);
  if (P.onGround && moved > 0) {
    P.bob += moved; P.stepAcc = (P.stepAcc || 0) + moved; G.stats.walk = (G.stats.walk || 0) + moved;
    if (P.stepAcc > (P.sprinting ? 2.2 : 1.8)) { P.stepAcc = 0; sfx('step_' + material(below), 0.35); }
    if (P.sprinting) P.exhaustion += moved * 0.1;
  }
  if (P.inWater && moved > 0) P.exhaustion += moved * 0.01;
  if (P.y < YMIN-64) { P.y = YMIN-64; P.vy = 0; }
}

// ── elytra: press jump again while airborne to deploy, then fly with the original game's glide physics ──
const elytraUsable = () => G.armor[1]?.id === ELYTRA && (G.armor[1].dmg || 0) < 431;
function tryStartGlide() {
  if (!G || !P || P.dead || P.gliding || P.onGround || P.inWater || P.flying || !elytraUsable() || effectLevel(P, 'levitation') >= 0) return false;
  P.gliding = true; P.glideAcc = 0; P.glideWear = 0; P.fallStart = P.y; sfx('equip', 0.6); return true;
}
function stopGlide() { P.gliding = false; P.rocketT = 0; }
function glidePhysics(dt) {
  P.glideAcc = (P.glideAcc || 0) + dt;
  while (P.glideAcc >= TICK) {
    P.glideAcc -= TICK;
    let vx = P.vx * TICK, vy = P.vy * TICK, vz = P.vz * TICK;
    const look = lookDir(), lx = look[0], ly = look[1], lz = look[2], pitch = -P.pitch;
    const hl = Math.hypot(lx, lz), hs = Math.hypot(vx, vz);
    let c = Math.cos(pitch); c = c * c * Math.min(1, Math.hypot(lx, ly, lz) / 0.4);
    vy += -0.08 + c * 0.06;
    if (vy < 0 && hl > 0) { const d = vy * -0.1 * c; vy += d; vx += lx * d / hl; vz += lz * d / hl; }
    if (pitch < 0 && hl > 0) { const d = hs * -Math.sin(pitch) * 0.04; vy += d * 3.2; vx -= lx * d / hl; vz -= lz * d / hl; }
    if (hl > 0) { vx += (lx / hl * hs - vx) * 0.1; vz += (lz / hl * hs - vz) * 0.1; }
    if (P.rocketT > 0) { vx += lx * 0.1 + (lx * 1.5 - vx) * 0.5; vy += ly * 0.1 + (ly * 1.5 - vy) * 0.5; vz += lz * 0.1 + (lz * 1.5 - vz) * 0.5; P.rocketT -= TICK; if (Math.random() < 0.6) particles(P.x, P.y + 0.4, P.z, T.glowstone, 1, 0.05, 0.2, 0.4); }
    vx *= 0.99; vy *= 0.98; vz *= 0.99;
    P.vx = vx / TICK; P.vy = vy / TICK; P.vz = vz / TICK;
  }
  P.fallStart = P.y;
  P.glideWear = (P.glideWear || 0) + dt;
  if (P.glideWear >= 1 && G.mode === 'survival') { P.glideWear = 0; G.armor[1].dmg = (G.armor[1].dmg || 0) + 1; if (G.armor[1].dmg >= 431) { toast(tr('겉날개가 거의 부서졌어요. 팬텀 막으로 수리하세요.')); stopGlide(); } invChanged(); }
}
function damagePlayer(amount, cause, src) {
  if(src&&(held()?.id===SHIELD||G.off?.id===SHIELD)&&(P.blocking>0||input.use)){const dir=lookDir(),dx=src.x-P.x,dz=src.z-P.z;if(dir[0]*dx+dir[2]*dz>0){amount*=.15;sfx('equip');}}
  if(['lava','magma','fire'].includes(cause)&&effectLevel(P,'fire_resistance')>=0)return;
  amount*=Math.max(0,1-.2*(effectLevel(P,'resistance')+1));
  amount*=1-Math.min(.8,(G.armor||[]).reduce((v,s)=>v+(s?.enchants?.protection||0)*.04,0));
  if (G.mode === 'creative' || P.dead || amount <= 0) return;
  const bypass = cause === 'starve' || cause === 'drown' || cause === 'void' || cause === 'explosion';
  if (P.hurt > 0 && !bypass) return;
  if (src && W.difficulty === 1) amount = Math.max(1, Math.round(amount / 2 + 0.5)); else if (src && W.difficulty === 3) amount = Math.round(amount * 1.5);
  if (!ARMOR_BYPASS[cause]) { const [def, tough] = armorPoints(); if (def > 0) { const eff = clamp(def - amount / (2 + tough / 4), def * 0.2, 20); damageArmor(amount); amount *= 1 - eff / 25; } }
  if (G.sleep > 0) G.sleep = 0;
  P.health = Math.max(0, Math.round((P.health - amount) * 10) / 10); P.hurt = 0.5; G.hurtFlash = 1;
  P.exhaustion += 0.1;
  if (src) { const resist=1-.1*(G.armor||[]).filter(s=>armorOf(s?.id)?.mat===4).length;const dx = P.x - src.x, dz = P.z - src.z, d = Math.hypot(dx, dz) || 1; P.vx += dx / d * 6*resist; P.vz += dz / d * 6*resist; P.vy = Math.max(P.vy, 5); }
  sfx('hurt'); buzz(40); shake = Math.max(shake, 0.25);
  if(P.health<=0){const hand=G.off?.id===TOTEM?'off':G.inv[G.sel]?.id===TOTEM?'main':null;if(hand){if(hand==='off')G.off=null;else G.inv[G.sel]=null;P.health=1;P.effects={regeneration:{time:45,amp:1},fire_resistance:{time:40,amp:0},resistance:{time:5,amp:1}};hint(tr('불사의 토템이 당신을 구했습니다.'));sfx('equip');invChanged();}else die(cause);}
  hudDirty = true;
}
const DEATH_MSG = { fall: '높은 곳에서 떨어졌습니다', zombie: '좀비에게 당했습니다', spider: '거미에게 당했습니다', drown: '익사했습니다', starve: '굶어 죽었습니다', explosion: '폭발에 휘말렸습니다', cactus: '선인장에 찔렸습니다', void: '세상 밖으로 떨어졌습니다', kill: '스스로 목숨을 끊었습니다' };
function die(cause) {
  P.dead = true; P.health = 0; input.mine = input.use = false; P.gliding = false;
  G.lastDeath = { x: P.x, y: P.y, z: P.z, dim: W.dimension || 'overworld' };
  if (G.mode === 'survival'&&!G.world.rules?.keepInventory) {
    for (let i = 0; i < 36; i++) { const s = G.inv[i]; if (s) { spawnItem(s.id, s.count, P.x, P.y + 1, P.z, s.dmg, [(Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6]); G.inv[i] = null; } }
    if (G.off) { spawnItem(G.off.id, G.off.count, P.x, P.y + 1, P.z, G.off.dmg, [(Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6]); G.off = null; }
    for (let i = 0; i < 4; i++) { const s = G.armor[i]; if (s) { spawnItem(s.id, 1, P.x, P.y + 1, P.z, s.dmg, [(Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6]); G.armor[i] = null; } }
    invChanged();
  }
  G.stats.deaths++;
  showDeath(tr(DEATH_MSG[cause] || '사망했습니다'));
  saveSoon();
}
function respawn() {
  const sp = G.spawn;
  Object.assign(P, newPlayer(sp), { yaw: P.yaw });
  P.y = surfaceY(sp.x, sp.z, sp.y);
  hideScreens(); hudDirty = true; capture();
}
function surfaceY(x, z, fallback) {
  const bx = Math.floor(x), bz = Math.floor(z);
  if (!getChunk(bx >> 4, bz >> 4)) return fallback;
  for (let y = WH - 2; y > YMIN; y--) if (solidAt(bx, y, bz)) { return y + 1; }
  return fallback;
}

function updateSurvival(dt) {
  if (P.dead) return;
  P.hurt = Math.max(0, P.hurt - dt);P.blocking=Math.max(0,(P.blocking||0)-dt);
  if (G.mode === 'creative') { P.health = 20; P.hunger = 20; P.airT = 15; return; }
  if (W.difficulty === 0) { P.regenT += dt; if (P.regenT > 1) { P.regenT = 0; if (P.health < 20) P.health++; if (P.hunger < 20) P.hunger++; hudDirty = true; } }
  if (P.poison > 0) { P.poison -= dt; P.exhaustion += dt * 0.5; }
  while (P.exhaustion >= 4) { P.exhaustion -= 4; if (P.sat > 0) P.sat = Math.max(0, P.sat - 1); else { P.hunger = Math.max(0, P.hunger - 1); hudDirty = true; } }
  if (P.health < 20 && P.hunger >= 18) {
    P.regenT += dt;
    const fast = P.hunger >= 20 && P.sat > 0;
    if (P.regenT >= (fast ? 0.5 : 4)) { P.regenT = 0; P.health = Math.min(20, P.health + 1); P.exhaustion += fast ? Math.min(P.sat, 6) / 6 * 1.5 + 0.5 : 3; hudDirty = true; }
  } else if (P.hunger <= 0) {
    P.starveT += dt; if (P.starveT >= 4) { P.starveT = 0; if (P.health > [20, 10, 1, 0][W.difficulty]) damagePlayer(1, 'starve'); }
  } else P.regenT = 0;
  if (P.eyeInWater&&effectLevel(P,'water_breathing')<0) {
    P.airT -= dt;
    if (P.airT <= 0) { P.airT = 0; P.drownT += dt; if (P.drownT >= 1) { P.drownT = 0; damagePlayer(2, 'drown'); } }
  } else P.airT = Math.min(15, P.airT + dt * 6);
  // cactus contact
  P.cactusT = Math.max(0, P.cactusT - dt);
  if (P.cactusT <= 0) {
    for (let bx = Math.floor(P.x - P.w - 0.05); bx <= Math.floor(P.x + P.w + 0.05); bx++) for (let bz = Math.floor(P.z - P.w - 0.05); bz <= Math.floor(P.z + P.w + 0.05); bz++) for (let by = Math.floor(P.y - 0.05); by <= Math.floor(P.y + 1.7); by++) {
      if (getBlock(bx, by, bz) === CACTUS && P.cactusT <= 0) { P.cactusT = 0.5; damagePlayer(1, 'cactus'); }
    }
  }
  if (P.y < YMIN-8) { P.voidT += dt; if (P.voidT > 0.5) { P.voidT = 0; damagePlayer(4, 'void'); } }
}
