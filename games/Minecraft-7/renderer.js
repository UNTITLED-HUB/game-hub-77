// ─────────────────────────── chunk mesher ───────────────────────────
// vertex: int16 x,y,z,pad (×64) | uint16 u,v (normalized) | uint8 sky, block, shade, flash  = 16 bytes
// Every attribute starts on a 4-byte boundary (0 / 8 / 12). Mobile GPUs (iOS Safari ANGLE-Metal, some Android
// drivers) misread unaligned offsets such as 6 or 10, leaving the terrain black or distorted.
const PW = CS + 2, PVOL = PW * PW * HEIGHT;
const PB = new Uint8Array(PVOL), PL = new Uint8Array(PVOL);
const pidx = (x, y, z) => ((y - YMIN) * PW + z) * PW + x;
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.72, side: true },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.72, side: true },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 1.0, top: true },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.5, bottom: true },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.86, side: true },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.86, side: true },
];
const OPP = [1, 0, 3, 2, 5, 4];
// per face, per vertex: padded-index deltas of [side1, side2, corner] relative to the adjacent cell
for (const f of FACES) {
  f.nd = (f.n[1] * PW + f.n[2]) * PW + f.n[0];
  f.ao = f.v.map(c => {
    const t = [0, 1, 2].filter(k => f.n[k] === 0);
    const s = t.map(k => { const o = [0, 0, 0]; o[k] = c[k] ? 1 : -1; return o; });
    const d = o => (o[1] * PW + o[2]) * PW + o[0];
    return [d(s[0]), d(s[1]), d([s[0][0] + s[1][0], s[0][1] + s[1][1], s[0][2] + s[1][2]])];
  });
}

class MeshBuilder {
  constructor(q = 4096) { this.alloc(q); }
  alloc(q) { this.cap = q; this.buf = new ArrayBuffer(q * 64); this.i16 = new Int16Array(this.buf); this.u16 = new Uint16Array(this.buf); this.u8 = new Uint8Array(this.buf); this.quads = 0; }
  reset() { this.quads = 0; }
  grow() { const old = this.u8, n = this.quads; this.alloc(this.cap * 2); this.u8.set(old.subarray(0, n * 64)); this.quads = n; }
  // p: 4 corners [x,y,z] in block units (chunk-local), uv: 4 [u,v] in atlas units, l: 4 [sky,block,shade] 0..255
  quad(p, uv, l, flash = 0) {
    if (this.quads >= this.cap) this.grow();
    const base = this.quads * 4;
    for (let k = 0; k < 4; k++) {
      const v = base + k, w = v * 8;
      this.i16[w] = Math.round(p[k][0] * 64); this.i16[w + 1] = Math.round(p[k][1] * 64); this.i16[w + 2] = Math.round(p[k][2] * 64); this.i16[w + 3] = 0;
      this.u16[w + 4] = Math.round(uv[k][0] * 65535); this.u16[w + 5] = Math.round(uv[k][1] * 65535);
      const b = v * 16 + 12; this.u8[b] = l[k][0]; this.u8[b + 1] = l[k][1]; this.u8[b + 2] = l[k][2]; this.u8[b + 3] = flash;
    }
    this.quads++;
  }
  bytes() { return this.u8.subarray(0, this.quads * 64); }
}
const MB = new MeshBuilder(8192), MW = new MeshBuilder(2048);

function fillPadded(ch) {
  const near = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) near.push(getChunk(ch.cx + dx, ch.cz + dz));
  for (let z = -1; z <= CS; z++) for (let x = -1; x <= CS; x++) {
    const cxo = x < 0 ? 0 : x >= CS ? 2 : 1, czo = z < 0 ? 0 : z >= CS ? 2 : 1, c = near[czo * 3 + cxo];
    const lx = (x + CS) & 15, lz = (z + CS) & 15;
    for (let y = YMIN; y < WH; y++) {
      const p = pidx(x + 1, y, z + 1);
      if (c) { const i = bidx(lx, y, lz); PB[p] = c.blocks[i]; PL[p] = c.lit ? c.light[i] : (y > c.heights[lz * CS + lx] && !isOpaqueId(c.blocks[i]) ? 0xF0 : 0); } else { PB[p] = STONE; PL[p] = 0; }
    }
  }
}

const OPAQUE = new Uint8Array(256), RTYPE = new Uint8Array(256); // 1 cube 2 cutout 3 translucent 4 water 5 cross 6 torch 7 bed (low cube)
const FTILE = []; // [blockId][face] = tile index ; front stored separately
function prepareBlockTables() {
  const rmap = { cube: 1, cutout: 2, translucent: 3, water: 4, cross: 5, torch: 6, bed: 7 };
  for (let id = 0; id < 256; id++) {
    const b = BLOCK[id]; if (!b) continue;
    OPAQUE[id] = b.opaque ? 1 : 0; RTYPE[id] = rmap[b.render];
    const tx = typeof b.tex === 'string' ? { top: b.tex, bottom: b.tex, side: b.tex } : b.tex;
    FTILE[id] = FACES.map(f => T[f.top ? tx.top : f.bottom ? (tx.bottom || tx.top) : tx.side]);
    b.frontTile = tx.front ? T[tx.front] : null;
    b.tiles = tx;
  }
}
const TU = 1 / TPR, EPS = 1 / 4096;
function uvOf(tile, u, v, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
  const tx = (tile % TPR) * TU, ty = Math.floor(tile / TPR) * TU;
  return [tx + (u0 + (u1 - u0) * u) * TU * (1 - 2 * EPS * TPR) + EPS, ty + (v0 + (v1 - v0) * v) * TU * (1 - 2 * EPS * TPR) + EPS];
}

const AO_CURVE = [0.5, 0.68, 0.84, 1.0];
function meshChunk(ch) {
  fillPadded(ch);
  MB.reset(); MW.reset();
  const ox = ch.cx * CS, oz = ch.cz * CS;
  const corners = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], uvs = [[0, 0], [0, 0], [0, 0], [0, 0]], ls = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let y = YMIN; y < WH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const p = pidx(x + 1, y, z + 1), id = PB[p];
    if (!id) continue;
    const rt = RTYPE[id];
    if(id===NETHER_PORTAL){const te=W.te.get(pkey(ox+x,y,oz+z)),axis=te?.frame?.dx??1;const tile=T.nether_portal;const uv=[[0,0],[0,1],[1,1],[1,0]].map(v=>uvOf(tile,...v));const vs=axis?[[x,y,z+0.5],[x,y+1,z+0.5],[x+1,y+1,z+0.5],[x+1,y,z+0.5]]:[[x+0.5,y,z],[x+0.5,y+1,z],[x+0.5,y+1,z+1],[x+0.5,y,z+1]];MW.quad(vs,uv,[[255,220,255],[255,220,255],[255,220,255],[255,220,255]]);continue;}
    if (rt === 5 || rt === 6) { meshSprite(id, rt, x, y, z, PL[p]); continue; }
    const b = BLOCK[id];
    let front = -1;
    if (b.facing) { const te = W.te.get(pkey(ox + x, y, oz + z)); front = te ? te.facing : 4; }
    let wh = 1;
    if (rt === 4) { const lv = waterLevel(id); wh = isWater(PB[p + PW * PW]) ? 1 : lv === 0 ? 0.875 : (8 - lv) / 9; }
    else if (rt === 7) wh = b.height;
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi], q = p + f.nd;
      if (f.n[1] === -1 && y === YMIN) continue;
      const nid = y + f.n[1] >= WH ? 0 : PB[q];
      if(isLava(id)&&isLava(nid))continue;
      if (rt === 4) {
        if (isWater(nid)) continue;
        if (OPAQUE[nid] && !(f.top && wh < 1)) continue;
        if (f.bottom && nid === ICE) continue;
      } else if (OPAQUE[nid] && !(rt === 7 && f.top)) continue;
      else if (rt === 3 && nid === id) continue;
      else if (rt === 2 && nid === id && id === GLASS) continue;
      let tile = FTILE[id][fi];
      if(id===END_FRAME&&f.top&&W.te.get(pkey(ox+x,y,oz+z))?.eye)tile=T.end_portal;
      if (front >= 0 && fi === front && b.frontTile != null) {
        tile = b.frontTile;
        if (id === FURNACE) { const te = W.te.get(pkey(ox + x, y, oz + z)); if (te && te.burn > 0) tile = T.furnace_front_lit; }
      }
      const target = (rt === 4 || rt === 3) ? MW : MB;
      const qq = (y + f.n[1] >= WH) ? -1 : q;
      for (let k = 0; k < 4; k++) {
        const c = f.v[k];
        let cy = c[1];
        if ((rt === 4 || rt === 7) && cy === 1) cy = wh;
        if (rt === 2 && id === CACTUS && f.side) { corners[k][0] = x + (f.n[0] ? (c[0] ? 15 / 16 : 1 / 16) : c[0]); corners[k][2] = z + (f.n[2] ? (c[2] ? 15 / 16 : 1 / 16) : c[2]); }
        else { corners[k][0] = x + c[0]; corners[k][2] = z + c[2]; }
        corners[k][1] = y + cy;
        const t = uvOf(tile, f.uv[k][0], rt === 7 && f.side && c[1] ? 1 - wh : f.uv[k][1]); uvs[k][0] = t[0]; uvs[k][1] = t[1];
        // smooth light + AO
        if (qq < 0) { ls[k][0] = 255; ls[k][1] = 0; ls[k][2] = Math.round(f.shade * 255); continue; }
        const a = f.ao[k], s1 = qq + a[0], s2 = qq + a[1], cr = qq + a[2];
        const o1 = OPAQUE[PB[s1]] && s1 >= 0 && s1 < PVOL, o2 = OPAQUE[PB[s2]] && s2 >= 0 && s2 < PVOL, oc = OPAQUE[PB[cr]] && cr >= 0 && cr < PVOL;
        const ao = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
        let sky = PL[qq] >> 4, blk = PL[qq] & 15, n = 1;
        if (!o1 && s1 >= 0 && s1 < PVOL) { sky += PL[s1] >> 4; blk += PL[s1] & 15; n++; }
        if (!o2 && s2 >= 0 && s2 < PVOL) { sky += PL[s2] >> 4; blk += PL[s2] & 15; n++; }
        if (!oc && !(o1 && o2) && cr >= 0 && cr < PVOL) { sky += PL[cr] >> 4; blk += PL[cr] & 15; n++; }
        ls[k][0] = Math.round(sky / n * 17); ls[k][1] = Math.round(blk / n * 17);
        ls[k][2] = Math.round(f.shade * (rt === 4 ? 1 : AO_CURVE[ao]) * 255);
      }
      // flip quad diagonal for nicer AO interpolation
      if (ls[0][2] + ls[2][2] < ls[1][2] + ls[3][2]) {
        target.quad([corners[1], corners[2], corners[3], corners[0]], [uvs[1], uvs[2], uvs[3], uvs[0]], [ls[1], ls[2], ls[3], ls[0]]);
      } else target.quad(corners, uvs, ls);
      if (rt === 4 && f.top) { // underside of the surface, visible from below the water
        target.quad([corners[3], corners[2], corners[1], corners[0]], [uvs[3], uvs[2], uvs[1], uvs[0]], [ls[3], ls[2], ls[1], ls[0]]);
      }
    }
  }
  ch.needMesh = false; ch.urgent = false;
  return { opaque: MB.bytes(), oq: MB.quads, water: MW.bytes(), wq: MW.quads };
}
function meshSprite(id, rt, x, y, z, light) {
  const l = [(light >> 4) * 17, (light & 15) * 17, 230];
  const L = [l, l, l, l];
  const tile = FTILE[id][0];
  if (rt === 5) {
    const a = 0.15, b = 0.85;
    const quads = [[[x + a, y, z + a], [x + b, y, z + b], [x + b, y + 1, z + b], [x + a, y + 1, z + a]], [[x + b, y, z + a], [x + a, y, z + b], [x + a, y + 1, z + b], [x + b, y + 1, z + a]]];
    const uv = [uvOf(tile, 0, 1), uvOf(tile, 1, 1), uvOf(tile, 1, 0), uvOf(tile, 0, 0)];
    for (const q of quads) { MB.quad(q, uv, L); MB.quad([q[1], q[0], q[3], q[2]], [uv[0], uv[1], uv[2], uv[3]], L); }
    return;
  }
  // torch: thin post
  const x0 = x + 7 / 16, x1 = x + 9 / 16, z0 = z + 7 / 16, z1 = z + 9 / 16, y1 = y + 10 / 16;
  const u0 = 7 / 16, u1 = 9 / 16, v0 = 3 / 16, v1 = 13 / 16;
  const uv = [uvOf(tile, 0, 1, u0, v0, u1, v1), uvOf(tile, 1, 1, u0, v0, u1, v1), uvOf(tile, 1, 0, u0, v0, u1, v1), uvOf(tile, 0, 0, u0, v0, u1, v1)];
  const bright = [[255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255]];
  MB.quad([[x1, y, z1], [x1, y, z0], [x1, y1, z0], [x1, y1, z1]], uv, bright);
  MB.quad([[x0, y, z0], [x0, y, z1], [x0, y1, z1], [x0, y1, z0]], uv, bright);
  MB.quad([[x0, y, z1], [x1, y, z1], [x1, y1, z1], [x0, y1, z1]], uv, bright);
  MB.quad([[x1, y, z0], [x0, y, z0], [x0, y1, z0], [x1, y1, z0]], uv, bright);
  const ft = uvOf(tile, 0.5, 0.5, 7 / 16, 4 / 16, 8 / 16, 5 / 16);
  MB.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [ft, ft, ft, ft], bright);
}

// ─────────────────────────── WebGL renderer ───────────────────────────
let gl = null, prog = null, U = {}, A = {}, atlasTex = null, indexBuf = null, dynVbo = null, lineVbo = null;
const MAXQ = 16384;
function initGL(canvas) {
  gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) throw Error('이 기기/브라우저에서 WebGL을 사용할 수 없어 3D 월드를 표시할 수 없습니다.');
  const vs = `attribute vec3 aPos;attribute vec2 aUV;attribute vec4 aLight;uniform mat4 uVP;uniform vec3 uOffset;uniform float uScale;uniform vec3 uEye;
varying vec2 vUV;varying vec4 vL;varying float vDist;varying vec3 vW;
void main(){vec3 w=aPos*uScale+uOffset;vW=w;vUV=aUV;vL=aLight;vDist=length(w-uEye);gl_Position=uVP*vec4(w,1.0);}`;
  // cv(): light curve. Full sky light (l=1) can round to a hair above 1 on mobile GPUs; pow() of the resulting
  // tiny negative base is NaN there (black terrain, striped clouds), so clamp and avoid pow() entirely.
  const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;uniform float uSky;uniform vec3 uFog;uniform vec2 uFogR;uniform float uBlend;uniform float uTime;uniform float uWater;uniform float uMin;uniform float uAlpha;uniform vec3 uSkyTint;uniform float uGamma;
varying vec2 vUV;varying vec4 vL;varying float vDist;varying vec3 vW;
float cv(float l){l=clamp(l,0.0,1.0);float a=clamp(l/(4.0-3.0*l),0.0,1.0);float q=1.0-a;q*=q;return mix(a,1.0-q*q,uGamma);}
void main(){vec4 t=texture2D(uTex,vUV);
if(uBlend<0.5){if(t.a<0.5)discard;t.a=1.0;}
float s=cv(vL.x)*uSky;float b=cv(vL.y);
vec3 li=max(vec3(s)*uSkyTint,vec3(b)*vec3(1.0,0.87,0.66));li=max(li,vec3(uMin));
vec3 c=t.rgb*li*vL.z;
c=mix(c,vec3(1.0,0.2,0.15),vL.w*0.6);
if(uWater>0.5)c*=0.9+0.1*sin(vW.x*1.9+vW.z*1.4+uTime*2.2)*sin(vW.z*0.8-uTime*1.3);
float f=clamp((vDist-uFogR.x)/(uFogR.y-uFogR.x),0.0,1.0);
float alpha=t.a*uAlpha;
float tileIndex=floor(vUV.x*32.0)+floor(vUV.y*32.0)*32.0;
if(uBlend>0.5 && uWater>0.5){
 if(abs(tileIndex-${T.water.toFixed(1)})<0.1){alpha=clamp(0.46+0.12*clamp(vDist/24.0,0.0,1.0),0.42,0.65);}
 if(abs(tileIndex-${T.lava.toFixed(1)})<0.1){alpha=1.0;c=max(c,t.rgb*0.82);}
}
gl_FragColor=vec4(mix(c,uFog,f),alpha);}`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('셰이더 오류: ' + gl.getShaderInfoLog(s)); return s; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error('3D 렌더러를 초기화하지 못했습니다.');
  gl.useProgram(prog);
  for (const n of ['uVP', 'uOffset', 'uScale', 'uEye', 'uTex', 'uSky', 'uFog', 'uFogR', 'uBlend', 'uTime', 'uWater', 'uMin', 'uAlpha', 'uSkyTint', 'uGamma']) U[n] = gl.getUniformLocation(prog, n);
  for (const n of ['aPos', 'aUV', 'aLight']) { A[n] = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(A[n]); }
  atlasTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.uTex, 0);
  const idx = new Uint16Array(MAXQ * 6); for (let q = 0; q < MAXQ; q++) { const v = q * 4, i = q * 6; idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3; }
  indexBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  dynVbo = gl.createBuffer(); lineVbo = gl.createBuffer();
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.frontFace(gl.CCW); gl.cullFace(gl.BACK);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}
function bindChunkAttribs(off) {
  gl.vertexAttribPointer(A.aPos, 4, gl.SHORT, false, 16, off);
  gl.vertexAttribPointer(A.aUV, 2, gl.UNSIGNED_SHORT, true, 16, off + 8);
  gl.vertexAttribPointer(A.aLight, 4, gl.UNSIGNED_BYTE, true, 16, off + 12);
}
function bindDynAttribs(off) {
  gl.vertexAttribPointer(A.aPos, 3, gl.FLOAT, false, 36, off);
  gl.vertexAttribPointer(A.aUV, 2, gl.FLOAT, false, 36, off + 12);
  gl.vertexAttribPointer(A.aLight, 4, gl.FLOAT, false, 36, off + 20);
}
function uploadMesh(ch, m) {
  if (!ch.vbo) { ch.vbo = gl.createBuffer(); ch.wvbo = gl.createBuffer(); }
  gl.bindBuffer(gl.ARRAY_BUFFER, ch.vbo); gl.bufferData(gl.ARRAY_BUFFER, m.oq ? m.opaque : new Uint8Array(16), gl.STATIC_DRAW); ch.oq = m.oq;
  gl.bindBuffer(gl.ARRAY_BUFFER, ch.wvbo); gl.bufferData(gl.ARRAY_BUFFER, m.wq ? m.water : new Uint8Array(16), gl.STATIC_DRAW); ch.wq = m.wq;
  ch.mesh = true;
}
function freeChunkGL(ch) { if (ch.vbo) { gl.deleteBuffer(ch.vbo); gl.deleteBuffer(ch.wvbo); ch.vbo = ch.wvbo = null; } ch.mesh = null; }
function drawChunkBuffer(vbo, quads) {
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  for (let b = 0; b * MAXQ < quads; b++) { bindChunkAttribs(b * MAXQ * 64); gl.drawElements(gl.TRIANGLES, Math.min(MAXQ, quads - b * MAXQ) * 6, gl.UNSIGNED_SHORT, 0); }
}

class DynBuilder {
  constructor() { this.f = new Float32Array(36 * 512); this.quads = 0; }
  reset() { this.quads = 0; }
  quad(p, uv, sky, blk, shade, flash = 0) {
    if ((this.quads + 1) * 36 > this.f.length) { const n = new Float32Array(this.f.length * 2); n.set(this.f); this.f = n; }
    let o = this.quads * 36;
    for (let k = 0; k < 4; k++) { const P = p[k], T2 = uv[k]; this.f[o++] = P[0]; this.f[o++] = P[1]; this.f[o++] = P[2]; this.f[o++] = T2[0]; this.f[o++] = T2[1]; this.f[o++] = sky; this.f[o++] = blk; this.f[o++] = shade; this.f[o++] = flash; }
    this.quads++;
  }
  draw() {
    if (!this.quads) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, dynVbo); gl.bufferData(gl.ARRAY_BUFFER, this.f.subarray(0, this.quads * 36), gl.STREAM_DRAW);
    for (let b = 0; b * MAXQ < this.quads; b++) { bindDynAttribs(b * MAXQ * 144); gl.drawElements(gl.TRIANGLES, Math.min(MAXQ, this.quads - b * MAXQ) * 6, gl.UNSIGNED_SHORT, 0); }
  }
}
const DYN = new DynBuilder(), DYNB = new DynBuilder(), SKY = new DynBuilder(), HAND = new DynBuilder();

// box with per-face tiles; xf maps model-space point → output space
function box(builder, min, max, tiles, xf, sky, blk, flash = 0, shadeMul = 1) {
  for (let fi = 0; fi < 6; fi++) {
    const f = FACES[fi], t = tiles[fi]; if (t == null) continue;
    const tile = Array.isArray(t) ? t[0] : t, sub = Array.isArray(t) ? t : null;
    const p = [], uv = [];
    for (let k = 0; k < 4; k++) {
      const c = f.v[k];
      p.push(xf([c[0] ? max[0] : min[0], c[1] ? max[1] : min[1], c[2] ? max[2] : min[2]]));
      uv.push(sub ? uvOf(tile, f.uv[k][0], f.uv[k][1], sub[1], sub[2], sub[3], sub[4]) : uvOf(tile, f.uv[k][0], f.uv[k][1]));
    }
    builder.quad(p, uv, sky, blk, f.shade * shadeMul, flash);
  }
}
function blockTiles(id) { const t = FTILE[id]; if (!t) return [T.white, T.white, T.white, T.white, T.white, T.white]; const b = BLOCK[id]; const out = t.slice(); if (b.frontTile != null) out[4] = b.frontTile; return out; }

// ── matrices ──
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function mat4mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function viewMatrix(eye, yaw, pitch) {
  const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)], r = [Math.cos(yaw), 0, Math.sin(yaw)];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -d(r, eye), -d(u, eye), d(f, eye), 1]);
}
function frustumPlanes(m) {
  const p = [];
  const row = r => [m[r], m[4 + r], m[8 + r], m[12 + r]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  for (const [a, s] of [[r0, 1], [r0, -1], [r1, 1], [r1, -1], [r2, 1], [r2, -1]]) p.push([r3[0] + s * a[0], r3[1] + s * a[1], r3[2] + s * a[2], r3[3] + s * a[3]]);
  return p;
}
function boxVisible(planes, x0, y0, z0, x1, y1, z1) {
  for (const p of planes) { const x = p[0] > 0 ? x1 : x0, y = p[1] > 0 ? y1 : y0, z = p[2] > 0 ? z1 : z0; if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) return false; }
  return true;
}
