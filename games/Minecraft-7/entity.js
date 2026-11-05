// ─────────────────────────── physics, entities, mobs ───────────────────────────
function boxHits(x0, y0, z0, x1, y1, z1) {
  for (let by = Math.floor(y0); by <= Math.floor(y1 - 1e-7); by++)
    for (let bz = Math.floor(z0); bz <= Math.floor(z1 - 1e-7); bz++)
      for (let bx = Math.floor(x0); bx <= Math.floor(x1 - 1e-7); bx++) if (solidAt(bx, by, bz)) return true;
  return false;
}
const hitsAt = (e, x, y, z) => boxHits(x - e.w, y, z - e.w, x + e.w, y + e.h, z + e.w);
// moves along one axis, returns true if blocked
function moveAxis(e, axis, d) {
  if (!d) return false;
  if (hitsAt(e, e.x, e.y, e.z)) { e[axis] += d; return false; } // stuck inside: let it escape
  const steps = Math.ceil(Math.abs(d) / 0.4), sd = d / steps;
  for (let i = 0; i < steps; i++) {
    const nx = axis === 'x' ? e.x + sd : e.x, ny = axis === 'y' ? e.y + sd : e.y, nz = axis === 'z' ? e.z + sd : e.z;
    if (!hitsAt(e, nx, ny, nz)) { e.x = nx; e.y = ny; e.z = nz; continue; }
    if (axis === 'x') e.x = sd > 0 ? Math.floor(nx + e.w) - e.w - 1e-4 : Math.floor(nx - e.w) + 1 + e.w + 1e-4;
    else if (axis === 'z') e.z = sd > 0 ? Math.floor(nz + e.w) - e.w - 1e-4 : Math.floor(nz - e.w) + 1 + e.w + 1e-4;
    else e.y = sd > 0 ? Math.floor(ny + e.h) - e.h - 1e-4 : Math.floor(ny) + 1 + 1e-4;
    if (hitsAt(e, e.x, e.y, e.z)) { e.x = axis === 'x' ? e.x - sd : e.x; e.y = axis === 'y' ? e.y - sd : e.y; e.z = axis === 'z' ? e.z - sd : e.z; }
    return true;
  }
  return false;
}
function entityInWater(e, dy = 0.4) { return isWater(getBlock(Math.floor(e.x), Math.floor(e.y + dy), Math.floor(e.z))); }
function lightAt(x, y, z) { const l = getLight(Math.floor(x), Math.floor(y), Math.floor(z)); return [(l >> 4) / 15, (l & 15) / 15]; }

// ── item drops ──
function spawnItem(id, count, x, y, z, dmg = 0, vel) {
  if (!id || count <= 0) return;
  const v = vel || [(Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3];
  W.items.push({ id, count, dmg, x, y, z, vx: v[0], vy: v[1], vz: v[2], w: 0.125, h: 0.25, age: 0, pick: 0.5 });
}
function dropBlockItems(x, y, z, id) {
  const b = BLOCK[id]; if (!b) return;
  const r = Math.random;
  let d = typeof b.drop === 'function' ? b.drop(r) : b.drop;
  const n = b.dropCount ? b.dropCount(r) : 1;
  if (d) spawnItem(d, n, x + 0.5, y + 0.4, z + 0.5);
  const te = W.te.get(pkey(x, y, z));
  if (te) for (const s of te.slots) if (s) spawnItem(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, s.dmg);
}
function updateItems(dt) {
  for (let i = W.items.length - 1; i >= 0; i--) {
    const e = W.items[i];
    e.age += dt; e.pick -= dt;
    if (e.age > 300 || e.y < YMIN-20) { W.items.splice(i, 1); continue; }
    const inW = entityInWater(e, 0.1);
    e.vy -= (inW ? 4 : 18) * dt; if (inW) e.vy = clamp(e.vy, -1.2, 1.5);
    const f = Math.pow(e.onGround ? 0.02 : 0.6, dt);
    e.vx *= f; e.vz *= f;
    moveAxis(e, 'x', e.vx * dt); moveAxis(e, 'z', e.vz * dt);
    e.onGround = false;
    if (moveAxis(e, 'y', e.vy * dt)) { if (e.vy < 0) e.onGround = true; e.vy = 0; }
    // pickup
    if (e.pick <= 0 && !P.dead) {
      const dx = P.x - e.x, dy = (P.y + 0.8) - e.y, dz = P.z - e.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 2.4) {
        const left = addToInventory(e.id, e.count, e.dmg);
        if (left < e.count) { sfx('pop'); invChanged(); }
        if (left <= 0) { W.items.splice(i, 1); continue; } else e.count = left;
      } else if (d2 < 6) { const k = 6 * dt / Math.sqrt(d2); e.x += dx * k; e.z += dz * k; }
    }
  }
}

// ── particles ──
function particles(x, y, z, tile, n, spread = 0.4, speed = 3, life = 0.8) {
  const pq = SAVE.settings.particles ?? 2; if (pq === 0) return; if (pq === 1) n = Math.ceil(n / 2);
  if (W.particles.length > (pq === 1 ? 300 : 600)) return;
  for (let i = 0; i < n; i++) W.particles.push({ x: x + (Math.random() - 0.5) * spread * 2, y: y + (Math.random() - 0.5) * spread * 2, z: z + (Math.random() - 0.5) * spread * 2, vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed, vz: (Math.random() - 0.5) * speed, life: life * (0.5 + Math.random() * 0.6), tile, su: Math.floor(Math.random() * 12) / 16, sv: Math.floor(Math.random() * 12) / 16, size: 0.06 + Math.random() * 0.06, grav: 14 });
}
function blockParticles(x, y, z, id, n = 18) { const t = FTILE[id]; if (t) particles(x + 0.5, y + 0.5, z + 0.5, t[4], n, 0.35, 3.2); }
// small chips that fly off the face being mined, like the original
function digParticles(t) {
  const tl = FTILE[t.id], pq = SAVE.settings.particles ?? 2; if (!tl || pq === 0 || W.particles.length > 500) return;
  const fi = t.face >= 0 ? t.face : 2, n = FACES[fi].n, h = (BLOCK[t.id] && BLOCK[t.id].height) || 1, r = Math.random;
  for (let k = 0; k < (pq === 1 ? 1 : 2); k++) {
    const x = t.x + (n[0] ? 0.5 + n[0] * 0.52 : 0.05 + r() * 0.9), y = t.y + (n[1] ? h / 2 + n[1] * (h / 2 + 0.02) : (0.05 + r() * 0.9) * h), z = t.z + (n[2] ? 0.5 + n[2] * 0.52 : 0.05 + r() * 0.9);
    W.particles.push({ x, y, z, vx: n[0] * 1.4 + (r() - 0.5) * 1.6, vy: n[1] * 1.4 + r() * 1.8, vz: n[2] * 1.4 + (r() - 0.5) * 1.6, life: 0.35 + r() * 0.45, tile: tl[fi], su: Math.floor(r() * 12) / 16, sv: Math.floor(r() * 12) / 16, size: 0.04 + r() * 0.04, grav: 14 });
  }
}
// ── arrows ──
function shootArrow(d) {
  let f = Math.min(1, d); f = (f * f + f * 2) / 3; if (f < 0.1) return;
  const dir = lookDir(), e = eyePos(), sp = f * 54;
  const base = Math.ceil(f * 6), crit = f >= 0.99;
  W.arrows.push({ x: e[0] + dir[0] * 0.4, y: e[1] - 0.1 + dir[1] * 0.4, z: e[2] + dir[2] * 0.4, vx: dir[0] * sp, vy: dir[1] * sp, vz: dir[2] * sp, yaw: P.yaw, pitch: P.pitch, age: 0, stuck: false, crit, dmg: base + (crit ? Math.floor(Math.random() * (base / 2 + 2)) : 0), pick: G.mode === 'survival' });
  if (G.mode === 'survival') {
    if (G.off && G.off.id === ARROW) { if (!--G.off.count) G.off = null; }
    else { const i = G.inv.findIndex(x => x && x.id === ARROW); if (i >= 0) { G.inv[i].count--; if (!G.inv[i].count) G.inv[i] = null; } }
    damageTool(1); invChanged();
  }
  sfx('bow');
}
function updateArrows(dt) {
  for (let i = W.arrows.length - 1; i >= 0; i--) {
    const a = W.arrows[i]; a.age += dt;
    if (a.age > 60 || a.y < YMIN-20) { W.arrows.splice(i, 1); continue; }
    if (a.stuck) {
      if (!solidAt(a.bx, a.by, a.bz)) { a.stuck = false; a.vx = a.vy = a.vz = 0; continue; }
      if (a.pick && !P.dead && Math.hypot(P.x - a.x, P.y + 0.9 - a.y, P.z - a.z) < 1.7 && !addToInventory(ARROW, 1)) { sfx('pop'); invChanged(); W.arrows.splice(i, 1); }
      continue;
    }
    if(!a.fireball)a.vy -= 20 * dt; const drag = Math.pow(entityInWater(a, 0) ? 0.6 : 0.99, dt * 20); a.vx *= drag; a.vy *= drag; a.vz *= drag;
    const len = Math.hypot(a.vx, a.vy, a.vz) * dt, steps = Math.max(1, Math.ceil(len / 0.2));
    let gone = false;
    for (let k = 0; k < steps && !gone; k++) {
      const nx = a.x + a.vx * dt / steps, ny = a.y + a.vy * dt / steps, nz = a.z + a.vz * dt / steps;
      if(a.fireball&&solidAt(Math.floor(nx),Math.floor(ny),Math.floor(nz))){explode(nx,ny,nz,2);W.arrows.splice(i,1);gone=true;break;}
      if(a.enemy&&!P.dead&&Math.abs(nx-P.x)<P.w+.1&&Math.abs(nz-P.z)<P.w+.1&&ny>P.y&&ny<P.y+P.h){damagePlayer(a.dmg,'arrow',a.owner);W.arrows.splice(i,1);gone=true;break;}
      for (const m of W.mobs) {
        if (m===a.owner||m.dead || nx < m.x - m.w - 0.1 || nx > m.x + m.w + 0.1 || nz < m.z - m.w - 0.1 || nz > m.z + m.w + 0.1 || ny < m.y || ny > m.y + m.h) continue;
        if (hurtMob(m, a.dmg, m.x - a.vx, m.z - a.vz)) { if (m.type === 'spider') m.angry = true; if (a.crit) particles(m.x, m.y + m.h * 0.7, m.z, T.white, 8, 0.3, 2, 0.4); sfx('arrowhit'); }
        else if (a.pick) spawnItem(ARROW, 1, nx, ny, nz);
        W.arrows.splice(i, 1); gone = true; break;
      }
      if (gone) break;
      if (solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) { a.stuck = true; a.bx = Math.floor(nx); a.by = Math.floor(ny); a.bz = Math.floor(nz); a.x += (nx - a.x) * 0.6; a.y += (ny - a.y) * 0.6; a.z += (nz - a.z) * 0.6; sfx('arrowhit', 0.5); break; }
      a.x = nx; a.y = ny; a.z = nz;
    }
    if (!gone && !a.stuck) { const h = Math.hypot(a.vx, a.vz); a.yaw = Math.atan2(a.vx, -a.vz); a.pitch = Math.atan2(a.vy, h); if (a.crit && Math.random() < 0.5) particles(a.x, a.y, a.z, T.white, 1, 0.02, 0.2, 0.3); }
  }
}
// ── beds ──
function trySleep(t) {
  if(W.dimension && W.dimension!=='overworld'){toast('이 차원에서는 잠을 잘 수 없어요.');return;}
  G.spawn = { x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5 };
  const tt = W.time % DAY_TICKS;
  if (tt < 12540 || tt > 23460) { toast('리스폰 지점을 정했어요. 잠은 밤에만 잘 수 있어요.'); return; }
  if (G.mode === 'survival' && W.difficulty > 0 && W.mobs.some(m => !m.dead && MOBDEF[m.type].hostile && Math.hypot(m.x - t.x - 0.5, m.z - t.z - 0.5) < 8 && Math.abs(m.y - t.y) < 5)) { toast('근처에 몬스터가 있어 잘 수 없어요!'); return; }
  input.mine = input.use = false; input.fwd = input.side = 0; resetTouchHolds();
  P.x = t.x + 0.5; P.z = t.z + 0.5; P.y = t.y + 1; P.vx = P.vy = P.vz = 0; P.flying = false;
  G.sleep = 0.001; toast('리스폰 지점을 정했어요. 잘 자요…');
}
function updateSleep(dt) {
  if (!G.sleep) return;
  if (G.sleep < 0) { G.sleep = Math.min(0, G.sleep + dt * 1.2); return; }
  G.sleep += dt; input.fwd = input.side = 0; input.jump = false;
  if (G.sleep > 2.4) { W.time = Math.ceil(W.time / DAY_TICKS) * DAY_TICKS + 300; updateSky(); G.sleep = -1; chat('좋은 아침이에요!', '#ff5'); saveSoon(); }
}
// ── armor ──
function armorPoints() { let d = 0, t = 0; for (const s of G.armor) { const a = s && armorOf(s.id); if (a) { d += a.def; t += a.tough; } } return [d, t]; }
function damageArmor(amount) {
  const n = Math.max(1, Math.floor(amount / 4));
  for (let i = 0; i < 4; i++) {
    const s = G.armor[i], a = s && armorOf(s.id); if (!a) continue;
    if(s.enchants?.unbreaking&&Math.random()<s.enchants.unbreaking/(s.enchants.unbreaking+1))continue;
  s.dmg = (s.dmg || 0) + n;
    if (s.dmg >= a.dur) { G.armor[i] = null; sfx('toolbreak'); toast(info(s.id).name + '이(가) 부서졌어요!'); }
  }
  invChanged();
}
const ARMOR_BYPASS = { starve: 1, drown: 1, void: 1, fall: 1, kill: 1 };
function updateParticles(dt) {
  for (let i = W.particles.length - 1; i >= 0; i--) {
    const p = W.particles[i]; p.life -= dt;
    if (p.life <= 0) { W.particles.splice(i, 1); continue; }
    p.vy -= p.grav * dt;
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
    if (solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) { p.vx *= 0.3; p.vz *= 0.3; p.vy = 0; } else { p.x = nx; p.y = ny; p.z = nz; }
  }
}

// ── TNT & explosions ──
function primeTNT(x, y, z, fuse = 4) { W.tnts.push({ x: x + 0.5, y, z: z + 0.5, vx: (Math.random() - 0.5), vy: 3, vz: (Math.random() - 0.5), w: 0.49, h: 0.98, fuse }); sfx('fuse'); }
function updateTNT(dt) {
  for (let i = W.tnts.length - 1; i >= 0; i--) {
    const t = W.tnts[i]; t.fuse -= dt;
    t.vy -= GRAVITY * 0.6 * dt; t.vx *= Math.pow(0.1, dt); t.vz *= Math.pow(0.1, dt);
    moveAxis(t, 'x', t.vx * dt); moveAxis(t, 'z', t.vz * dt); if (moveAxis(t, 'y', t.vy * dt)) t.vy = 0;
    if (Math.random() < 0.5) particles(t.x, t.y + 1.1, t.z, T.white, 1, 0.05, 0.6, 0.5);
    if (t.fuse <= 0) { W.tnts.splice(i, 1); explode(t.x, t.y + 0.5, t.z, 4); }
  }
}
function explode(x, y, z, power) {
  sfx('boom'); shake = Math.max(shake, 0.6);
  const r = power * 0.9;
  for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) {
    const d = Math.hypot(dx, dy, dz); if (d > r * (0.7 + Math.random() * 0.45)) continue;
    const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz), id = getBlock(bx, by, bz);
    if (!id || isWater(id) || id === BEDROCK || id === OBSIDIAN) continue;
    if (id === TNT) { setBlock(bx, by, bz, AIR); primeTNT(bx, by, bz, 0.5 + Math.random()); continue; }
    if (Math.random() < 0.25) dropBlockItems(bx, by, bz, id); else { const te = W.te.get(pkey(bx, by, bz)); if (te) for (const s of te.slots) if (s) spawnItem(s.id, s.count, bx + 0.5, by + 0.5, bz + 0.5, s.dmg); }
    setBlock(bx, by, bz, AIR);
  }
  for (let i = 0; i < 40; i++) W.particles.push({ x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 3, z: z + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 4, life: 0.6 + Math.random() * 0.8, tile: T.white, su: 0, sv: 0, size: 0.3 + Math.random() * 0.4, grav: -1 });
  const hurt = (e, isPlayer) => {
    const ex = e.x - x, ey = (e.y + e.h / 2) - y, ez = e.z - z, d = Math.hypot(ex, ey, ez);
    if (d > power * 2) return;
    const f = 1 - d / (power * 2), dmg = Math.floor(f * f * 26 + f * 6);
    const k = f * 14 / Math.max(0.5, d);
    e.vx += ex * k; e.vy += Math.max(3, ey * k + 5 * f); e.vz += ez * k;
    if (isPlayer) damagePlayer(dmg, 'explosion'); else hurtMob(e, dmg, x, z, true);
  };
  if (!P.dead) hurt(P, true);
  for (const m of W.mobs) hurt(m, false);
  for (const it of W.items) { const d = Math.hypot(it.x - x, it.y - y, it.z - z); if (d < power * 1.5) { it.vx += (it.x - x) * 3; it.vy += 4; it.vz += (it.z - z) * 3; } }
}
