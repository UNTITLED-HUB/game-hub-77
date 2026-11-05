// ── touch controls ──
// Each control can be moved, resized and hidden in the layout editor. Saved positions are the
// control's centre as a fraction of the screen; unsaved controls use edge-anchored defaults.
const TCTL = [
  { id: 'move', label: '이동 패드', base: 124 }, { id: 'jump', label: '점프', base: 62 }, { id: 'mine', label: '캐기', base: 56 }, { id: 'use', label: '사용 / 설치', base: 56 },
  { id: 'sneak', label: '웅크리기', base: 50 }, { id: 'sprint', label: '달리기', base: 46 }, { id: 'fly', label: '비행', base: 50 }, { id: 'down', label: '내려가기', base: 50 },
  { id: 'drop', label: '버리기', base: 44 }, { id: 'chat', label: '채팅', base: 38 }, { id: 'pause', label: '일시정지', base: 38 },
  { id: 'view', label: '시점', base: 38 }, { id: 'swap', label: '양손 바꾸기', base: 40 }];
const TDEF = { move: ['l', 100, 'b', 104], jump: ['r', 62, 'b', 88], mine: ['r', 146, 'b', 120], use: ['r', 66, 'b', 172], sneak: ['r', 150, 'b', 196], sprint: ['l', 182, 'b', 204],
  fly: ['r', 68, 'b', 246], down: ['r', 228, 'b', 260], drop: ['l', 46, 'b', 214], chat: ['r', 118, 't', 26], pause: ['r', 72, 't', 26], view: ['r', 164, 't', 26], swap: ['l', 46, 'b', 268] };
let touchSneak = false, touchSprint = false, touchJump = false, touchDown = false;
const TEL = {}, tptr = new Map();
const J = { pid: null, cx: 0, cy: 0, r: 46, float: false };
const DP = { pid: null, f: 0, lastFwd: 0, center: false, sprint: false };
const tk = (W, H) => clamp(Math.min(W, H) / 390, 0.85, 1.6);
const layoutOf = id => { const L = SAVE.settings.layout || (SAVE.settings.layout = {}); return L[id] || (L[id] = {}); };
function tpos(id, W, H) {
  const L = (SAVE.settings.layout || {})[id] || {}, d = TDEF[id], k = tk(W, H), port = H > W * 1.05;
  const c = TCTL.find(t => t.id === id);
  const size = c.base * k * (L.s || 1) * (SAVE.settings.btnSize || 100) / 100;
  let x, y;
  if (L.x != null) { x = L.x * W; y = L.y * H; }
  else { x = d[0] === 'l' ? d[1] * k : W - d[1] * k; y = d[2] === 't' ? d[3] * k : H - (d[3] + (port ? 70 : 0)) * k; }
  if (SAVE.settings.leftHanded) x = W - x;
  x = clamp(x, size / 2 + 2, W - size / 2 - 2); y = clamp(y, size / 2 + 2, H - size / 2 - 2);
  return { x, y, size, hide: L.hide ?? (SAVE.settings.hideMobileExtras !== false ? ['mine', 'use', 'sprint', 'drop', 'swap', 'fly'] : ['sprint', 'drop', 'swap', 'fly']).includes(id) };
}
function renderTouch() {
  const t = $('touch'); if (!t || !SAVE) return;
  t.innerHTML = TCTL.map(c => {
    if (c.id === 'move') return SAVE.settings.moveStyle === 'dpad'
      ? `<div class="tc dpad" data-ctl="move" data-label="${tr(c.label)}">${['ul', 'u', 'ur', 'l', 'c', 'r', 'dl', 'd', 'dr'].map(d => `<b data-d="${d}" class="${d.length === 2 ? 'x' : d === 'c' ? 'c' : ''}"></b>`).join('')}</div>`
      : `<div class="tc joy" data-ctl="move" data-label="${tr(c.label)}"><i></i></div>`;
    return `<button class="tc tb" data-ctl="${c.id}" data-label="${tr(c.label)}" aria-label="${tr(c.label)}" style="background-image:url(${TICON[c.id]})"></button>`;
  }).join('');
  for (const k in TEL) delete TEL[k];
  t.querySelectorAll('[data-ctl]').forEach(el => { TEL[el.dataset.ctl] = el; });
  positionTouch();
}
function positionTouch() {
  if (!root || !SAVE || !TEL.move) return;
  const mc = $('mc'), W = mc.clientWidth, H = mc.clientHeight; if (!W || !H) return;
  for (const c of TCTL) {
    const el = TEL[c.id]; if (!el) continue;
    if (c.id === 'move' && J.float && J.pid != null) continue;
    const p = tpos(c.id, W, H);
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.style.width = el.style.height = p.size + 'px';
    el.classList.toggle('off', p.hide); el.classList.toggle('sel', !!ED && ED.sel === c.id);
  }
}
function resetTouchHolds() {
  touchJump = touchDown = false; input.jump = false; input.sneak = touchSneak; input.descend = false;
  J.pid = null; DP.pid = null; DP.f = 0; DP.sprint = false; input.sprintKey = touchSprint;
  for (const p of tptr.values()) clearTimeout(p.timer); tptr.clear();
  if (root) root.querySelectorAll('#touch .down').forEach(e => e.classList.remove('down'));
  const k = TEL.move && TEL.move.querySelector('i'); if (k) k.style.transform = '';
  if (J.float) { J.float = false; positionTouch(); }
}
function joyStart(e, cx, cy) { J.pid = e.pointerId; J.cx = cx; J.cy = cy; J.r = Math.max(20, TEL.move.getBoundingClientRect().width * 0.36); joyMove(e); }
function joyMove(e) {
  const dx = e.clientX - J.cx, dy = e.clientY - J.cy, r = J.r, d = Math.hypot(dx, dy), k = d > r ? r / d : 1;
  const knob = TEL.move && TEL.move.querySelector('i'); if (knob) knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
  const nx = dx * k / r, ny = dy * k / r;
  input.fwd = Math.abs(ny) > 0.2 ? -ny : 0; input.side = Math.abs(nx) > 0.2 ? nx : 0; input.sprintKey = touchSprint || ny < -0.95;
}
function joyEnd() { J.pid = null; const knob = TEL.move && TEL.move.querySelector('i'); if (knob) knob.style.transform = ''; input.fwd = input.side = 0; input.sprintKey = touchSprint; if (J.float) { J.float = false; positionTouch(); } }
const DIRN = { '1,0': 'u', '1,-1': 'ul', '1,1': 'ur', '0,-1': 'l', '0,1': 'r', '-1,0': 'd', '-1,-1': 'dl', '-1,1': 'dr' };
function dpadMove(e, first) {
  const el = TEL.move, r = el.getBoundingClientRect(), cell = r.width / 3, dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const inC = Math.abs(dx) < cell / 2 && Math.abs(dy) < cell / 2;
  if (first && inC) { DP.center = true; touchSneak = !touchSneak; input.sneak = touchSneak; return; }
  if (DP.center && inC) return;
  DP.center = false;
  const f = dy < -cell / 2 ? 1 : dy > cell / 2 ? -1 : 0, s = dx > cell / 2 ? 1 : dx < -cell / 2 ? -1 : 0;
  if (f === 1 && DP.f !== 1) { const n = performance.now(); if (n - DP.lastFwd < 300) DP.sprint = true; DP.lastFwd = n; }
  if (f !== 1) DP.sprint = false;
  DP.f = f; input.fwd = f; input.side = s; input.sprintKey = touchSprint || DP.sprint;
  const dn = DIRN[f + ',' + s]; el.querySelectorAll('b').forEach(b => b.classList.toggle('down', b.dataset.d === dn));
}
function dpadEnd() { DP.pid = null; DP.f = 0; DP.sprint = false; DP.center = false; input.fwd = input.side = 0; input.sprintKey = touchSprint; if (TEL.move) TEL.move.querySelectorAll('b.down').forEach(b => b.classList.remove('down')); }
function ctlDown(id, e, el) {
  el.classList.add('down');
  switch (id) {
    case 'move': if (SAVE.settings.moveStyle === 'dpad') { DP.pid = e.pointerId; dpadMove(e, true); } else { const r = el.getBoundingClientRect(); joyStart(e, r.left + r.width / 2, r.top + r.height / 2); } break;
    case 'jump': {
      touchJump = true; input.jump = true;
      // tap again in the air to open the elytra · double-tap toggles flight in creative
      jumpPressed(e.timeStamp, 380);
      break;
    }
    case 'mine': input.mine = true; P.attackCd = 0; P.mineCd = 0; break;
    case 'use': input.use = true; P.useCd = 0; break;
    case 'sneak': { const p = tptr.get(e.pointerId); if (P.flying) { p.flyHold = true; touchDown = true; input.descend = true; } else { touchSneak = !touchSneak; input.sneak = touchSneak; } break; }
    case 'sprint': touchSprint = !touchSprint; input.sprintKey = touchSprint; break;
    case 'fly': if (G.mode === 'creative') setFlying(!P.flying); break;
    case 'view': cycleView(); break;
    case 'swap': swapHands(); break;
    case 'down': touchDown = true; input.sneak = true; input.descend = true; break;
    case 'drop': { const p = tptr.get(e.pointerId); p.timer = ctx.timeout(() => { if (tptr.get(e.pointerId) === p) { p.fired = true; dropItem(true); buzz(25); } }, 450); break; }
  }
}
function ctlUp(id, e, el, p) {
  el.classList.remove('down');
  const ok = e.type !== 'pointercancel';
  switch (id) {
    case 'move': if (SAVE.settings.moveStyle === 'dpad') dpadEnd(); else joyEnd(); break;
    case 'jump': touchJump = false; input.jump = false; break;
    case 'mine': input.mine = false; break;
    case 'use': input.use = false; break;
    case 'down': touchDown = false; input.sneak = touchSneak; input.descend = false; break;
    case 'sneak': if (p && p.flyHold) { touchDown = false; input.descend = false; input.sneak = touchSneak; } break;
    case 'drop': clearTimeout(p.timer); if (!p.fired && ok && G && !G.ui) dropItem(false); break;
    case 'chat': if (ok && G && !G.ui) openChat(''); break;
    case 'pause': if (ok && G && !G.ui) showPause(); break;
  }
}
function touchEvents() {
  const touch = $('touch');
  ctx.on(touch, 'pointerdown', e => {
    const el = e.target.closest('[data-ctl]'); if (!el) return;
    e.preventDefault();
    if (ED) { edStart(e, el); return; }
    if (!G || G.ui || G.loading || P.dead) return;
    try { el.setPointerCapture(e.pointerId); } catch { }
    const p = { id: el.dataset.ctl, el }; tptr.set(e.pointerId, p);
    ctlDown(p.id, e, el);
  });
  ctx.on(touch, 'pointermove', e => {
    if (ED) { edMove(e); return; }
    const p = tptr.get(e.pointerId); if (!p || p.id !== 'move') return;
    if (SAVE.settings.moveStyle === 'dpad') { if (DP.pid === e.pointerId) dpadMove(e, false); } else if (J.pid === e.pointerId) joyMove(e);
  });
  const up = e => { if (ED) { edEnd(e); return; } const p = tptr.get(e.pointerId); if (!p) return; tptr.delete(e.pointerId); ctlUp(p.id, e, p.el, p); };
  ctx.on(touch, 'pointerup', up); ctx.on(touch, 'pointercancel', up);
  ctx.on(touch, 'contextmenu', e => e.preventDefault());
  // look + tap/hold on the canvas (and the floating joystick on the left side)
  const looks = new Map();
  ctx.on(canvas, 'pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    if (!G || G.ui) return;
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch { }
    const st = SAVE.settings, mc = $('mc').getBoundingClientRect(), lx = e.clientX - mc.left, ly = e.clientY - mc.top;
    const floatSide = st.leftHanded ? lx > mc.width * 0.55 : lx < mc.width * 0.45;
    if (touchUI() && st.joyFloat && st.moveStyle !== 'dpad' && J.pid == null && TEL.move && !TEL.move.classList.contains('off') && floatSide && ly > mc.height * 0.3) {
      J.float = true; TEL.move.style.left = lx + 'px'; TEL.move.style.top = ly + 'px'; TEL.move.classList.add('down');
      joyStart(e, e.clientX, e.clientY); return;
    }
    const L = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, mining: false };
    L.timer = ctx.timeout(() => { if (looks.get(e.pointerId) === L && L.moved < 12) { L.mining = true; input.mine = true; P.attackCd = 0; P.mineCd = 0; } }, st.holdDelay || 280);
    looks.set(e.pointerId, L);
  });
  ctx.on(canvas, 'pointermove', e => {
    if (J.float && J.pid === e.pointerId) { joyMove(e); return; }
    const L = looks.get(e.pointerId); if (!L) return;
    const dx = e.clientX - L.x, dy = e.clientY - L.y; L.x = e.clientX; L.y = e.clientY; L.moved += Math.abs(dx) + Math.abs(dy);
    const k = 0.0055 * (SAVE.settings.touchSens || 8) / 8 * (P.zoom ? 0.15 : 1);
    P.yaw += dx * k; P.pitch = clamp(P.pitch - dy * k * (SAVE.settings.invertY ? -1 : 1), -1.55, 1.55);
  });
  const endLook = e => {
    if (J.float && J.pid === e.pointerId) { if (TEL.move) TEL.move.classList.remove('down'); joyEnd(); return; }
    const L = looks.get(e.pointerId); if (!L) return; looks.delete(e.pointerId);
    clearTimeout(L.timer);
    if (L.mining) input.mine = false;
    else if (e.type !== 'pointercancel' && L.moved < 12 && performance.now() - L.t < (SAVE.settings.holdDelay || 280) && G && !G.ui) {
      // a quick tap on a mob hits it (shears on a sheep still shear); otherwise it places / uses
      const m = G.targetMob, s = G.inv[G.sel];
      if (m && !(s && s.id === SHEARS && m.type === 'sheep' && !m.sheared)) { input.mine = true; P.minePrev = false; updateInteraction(0); input.mine = false; }
      else if (SAVE.settings.tapPlace !== false) { input.use = true; P.useCd = 0; updateInteraction(0); input.use = false; }
    }
  };
  ctx.on(canvas, 'pointerup', endLook); ctx.on(canvas, 'pointercancel', endLook);
  // hotbar taps
  ctx.on($('hotbar'), 'pointerdown', e => { const h = e.target.closest('[data-hot]'); if (!h || !G || ED) return; e.preventDefault(); G.sel = +h.dataset.hot; invChanged(); });
  ctx.on($('hotInv'), 'click', () => { if (G && !G.ui) openScreen(G.mode === 'creative' ? 'creative' : 'inventory'); });
  // layout editor toolbar
  const ed = $('editor');
  ctx.on(ed, 'click', e => { const b = e.target.closest('[data-ed]'); if (b) { uiClick(); edAction(b.dataset.ed); } });
  ctx.on(ed, 'input', e => { if (e.target.id === 'edSize' && ED) { layoutOf(ED.sel).s = +e.target.value / 100; $('edSizeL').textContent = tr('크기: {0}%', e.target.value); positionTouch(); } });
  let bar = null;
  ctx.on(ed, 'pointerdown', e => { const h = e.target.closest('.edhead'); if (!h || e.target.closest('button')) return; const b = $('edbar'), r = b.getBoundingClientRect(), m = $('mc').getBoundingClientRect(); bar = { pid: e.pointerId, ox: r.left - m.left - e.clientX, oy: r.top - m.top - e.clientY }; try { h.setPointerCapture(e.pointerId); } catch { } });
  ctx.on(ed, 'pointermove', e => { if (!bar || bar.pid !== e.pointerId) return; const b = $('edbar'), m = $('mc'); b.classList.add('moved'); b.style.left = clamp(e.clientX + bar.ox, 0, m.clientWidth - b.offsetWidth) + 'px'; b.style.top = clamp(e.clientY + bar.oy, 0, m.clientHeight - b.offsetHeight) + 'px'; });
  ctx.on(ed, 'pointerup', () => { bar = null; }); ctx.on(ed, 'pointercancel', () => { bar = null; });
}

// ── touch layout editor ──
let ED = null;
const snapSize = (W, H) => Math.round(8 * tk(W, H));
function openLayoutEditor(from) {
  ED = { sel: 'jump', orig: JSON.parse(JSON.stringify(SAVE.settings.layout || {})), snap: true, from, drag: null, min: false };
  if (G) { G.ui = 'layout'; releasePointer(); resetTouchHolds(); }
  menuScreen = 'layout';
  screenHTML('', G ? 'none' : 'pano');
  $('mc').classList.add('editing');
  renderTouch();
  const ed = $('editor'); ed.hidden = false; renderEdBar();
}
function closeLayoutEditor(save) {
  if (!ED) return;
  if (save) { saveSettingsSoon(); toast(tr('버튼 배치를 저장했어요.')); } else SAVE.settings.layout = ED.orig;
  const from = ED.from; ED = null;
  $('mc').classList.remove('editing'); $('editor').hidden = true; $('editor').innerHTML = '';
  positionTouch();
  if (from === 'settings') showSettings('touch');
  else if (G) showPause();
  else showLanding();
}
function renderEdBar() {
  const ed = $('editor'), c = TCTL.find(t => t.id === ED.sel), L = (SAVE.settings.layout || {})[ED.sel] || {}, mc = $('mc');
  ed.classList.toggle('grid', ED.snap); ed.style.setProperty('--snap', snapSize(mc.clientWidth, mc.clientHeight) + 'px');
  const old = $('edbar'), pos = old && old.classList.contains('moved') ? `left:${old.style.left};top:${old.style.top}` : '';
  ed.innerHTML = `<div class="edbar ${ED.min ? 'min' : ''} ${pos ? 'moved' : ''}" id="edbar" style="${pos}">
  <div class="edhead"><span>${tr('버튼 배치 편집')}</span><button class="btn sm" data-ed="min">${tr(ED.min ? '펼치기' : '접기')}</button>${ED.min ? `<button class="btn sm" data-ed="save">${tr('저장')}</button>` : ''}</div>
  <div class="edhint">${tr('버튼을 끌어서 옮기고, 눌러서 선택하세요')}</div>
  <div class="edsel"><button class="btn sq" data-ed="prev" aria-label="&lt;">◀</button><b>${tr(c.label)}</b><button class="btn sq" data-ed="next" aria-label="&gt;">▶</button></div>
  <label class="slider"><input type="range" id="edSize" min="50" max="200" step="5" value="${Math.round((L.s || 1) * 100)}" aria-label="${tr('버튼 크기')}"><span class="lab" id="edSizeL">${tr('크기: {0}%', Math.round((L.s || 1) * 100))}</span></label>
  <div class="row"><button class="btn" data-ed="vis">${tr('표시: {0}', tr(tpos(ED.sel, mc.clientWidth, mc.clientHeight).hide ? '끔' : '켬'))}</button><button class="btn" data-ed="resetOne">${tr('이 버튼 초기화')}</button></div>
  <div class="row"><button class="btn" data-ed="snap">${tr('격자 맞춤: {0}', tr(ED.snap ? '켬' : '끔'))}</button><button class="btn" data-ed="resetAll">${tr('모두 초기화')}</button></div>
  <div class="row"><button class="btn" data-ed="cancel">${tr('취소')}</button><button class="btn" data-ed="save">${tr('저장')}</button></div></div>`;
}
function edAction(a) {
  if (!ED) return;
  const L = SAVE.settings.layout || (SAVE.settings.layout = {}), i = TCTL.findIndex(t => t.id === ED.sel);
  switch (a) {
    case 'prev': ED.sel = TCTL[(i + TCTL.length - 1) % TCTL.length].id; break;
    case 'next': ED.sel = TCTL[(i + 1) % TCTL.length].id; break;
    case 'vis': { const mc = $('mc'); layoutOf(ED.sel).hide = !tpos(ED.sel, mc.clientWidth, mc.clientHeight).hide; break; }
    case 'resetOne': delete L[ED.sel]; break;
    case 'resetAll': SAVE.settings.layout = {}; break;
    case 'snap': ED.snap = !ED.snap; break;
    case 'min': ED.min = !ED.min; break;
    case 'cancel': closeLayoutEditor(false); return;
    case 'save': closeLayoutEditor(true); return;
  }
  positionTouch(); renderEdBar();
}
function edStart(e, el) {
  const id = el.dataset.ctl;
  ED.sel = id; ED.drag = { pid: e.pointerId, id, sx: e.clientX, sy: e.clientY, ox: parseFloat(el.style.left) || 0, oy: parseFloat(el.style.top) || 0 };
  try { el.setPointerCapture(e.pointerId); } catch { }
  positionTouch(); renderEdBar();
}
function edMove(e) {
  const d = ED && ED.drag; if (!d || d.pid !== e.pointerId) return;
  const mc = $('mc'), W = mc.clientWidth, H = mc.clientHeight;
  let x = d.ox + e.clientX - d.sx, y = d.oy + e.clientY - d.sy;
  if (ED.snap) { const s = snapSize(W, H); x = Math.round(x / s) * s; y = Math.round(y / s) * s; }
  const L = layoutOf(d.id); L.x = clamp((SAVE.settings.leftHanded ? W - x : x) / W, 0, 1); L.y = clamp(y / H, 0, 1);
  positionTouch();
}
function edEnd(e) { if (ED && ED.drag && ED.drag.pid === e.pointerId) ED.drag = null; }
