// ─────────────────────────── world: generation, storage, light ───────────────────────────
const OCEAN = 0, BEACH = 1, PLAINS = 2, FOREST = 3, DESERT = 4, SNOWY = 5, MOUNTAIN = 6;
const BIOME_NAME = ['바다', '해변', '평원', '숲', '사막', '설원', '산'];
let W = null;           // active world runtime
let lastChunk = null;

function column(x, z) {
  const n = W.noise, m = W.noise2;
  const cont = n.fbm2(x / 256, z / 256, 4);
  const det = n.fbm2(x / 48 + 31.7, z / 48 - 17.3, 3);
  const mf = Math.max(0, m.fbm2(x / 170 + 9.1, z / 170 - 4.4, 3) - 0.04) * 2.2;
  const temp = m.fbm2(x / 420 + 500.5, z / 420 - 200.5, 2);
  const hum = n.fbm2(x / 360 - 800.5, z / 360 + 300.5, 2);
  let h = SEA + 6 + cont * 42 + det * 9 + mf * mf * 230;
  h = Math.floor(clamp(h, SEA-28, WH - 20));
  let b;
  if (h < SEA) b = OCEAN;
  else if (h <= SEA + 1 && temp > -0.2) b = BEACH;
  else if (mf > 0.42 && h > SEA + 12) b = MOUNTAIN;
  else if (temp < -0.17) b = SNOWY;
  else if (temp > 0.16 && hum < 0.06) b = DESERT;
  else if (hum > 0.02) b = FOREST;
  else b = PLAINS;
  return [h, b];
}

function newChunk(cx, cz) {
  return { cx, cz, blocks: new Uint8Array(CVOL), light: new Uint8Array(CVOL), emit: new Set(), lit: false, needLight: true, needMesh: true, mesh: null, water: null, biomes: new Uint8Array(CS * CS), heights: new Int16Array(CS * CS) };
}

function generateChunk(cx, cz) {
  if(W.dimension && W.dimension!=='overworld') return generateDimensionChunk(cx,cz);
  const ch = newChunk(cx, cz), B = ch.blocks, seed = W.seed;
  const x0 = cx * CS, z0 = cz * CS, M = 3, SZ = CS + M * 2;
  const hs = new Int16Array(SZ * SZ), bs = new Uint8Array(SZ * SZ);
  for (let lz = 0; lz < SZ; lz++) for (let lx = 0; lx < SZ; lx++) { const [h, b] = column(x0 + lx - M, z0 + lz - M); hs[lz * SZ + lx] = h; bs[lz * SZ + lx] = b; }
  const n3a = W.noise.n3, n3b = W.noise2.n3;
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const h = hs[(z + M) * SZ + x + M], b = bs[(z + M) * SZ + x + M], wx = x0 + x, wz = z0 + z;
    ch.biomes[z * CS + x] = b; ch.heights[z * CS + x] = h;
    let top = GRASS, fill = DIRT, deep = STONE;
    if (b === OCEAN) { top = h < SEA - 5 ? GRAVEL : hash2(wx, wz, seed + 3) < 0.08 ? CLAY : SAND; fill = h < SEA - 5 ? GRAVEL : SAND; }
    else if (b === BEACH) { top = SAND; fill = SAND; deep = SANDSTONE; }
    else if (b === DESERT) { top = SAND; fill = SAND; deep = SANDSTONE; }
    else if (b === SNOWY) top = SNOW_GRASS;
    else if (b === MOUNTAIN) { top = h > 47 ? SNOW : h > 39 ? STONE : GRASS; fill = h > 39 ? STONE : DIRT; }
    const caveTop = (b === OCEAN || b === BEACH || h <= SEA + 2) ? h - 6 : h;
    for (let y = YMIN; y <= Math.max(h, SEA); y++) {
      let id;
      if (y === YMIN) id = BEDROCK;
      else if (y <= YMIN+3 && hash3(wx, y, wz, seed) < 0.75 - (y-YMIN) * 0.22) id = BEDROCK;
      else if (y < 17 && y < h-3) id = DEEPSLATE;
      else if (y < h - 3) id = (deep === SANDSTONE && y < h - 6) ? STONE : deep;
      else if (y < h) id = fill;
      else if (y === h) id = top;
      else id = (b === SNOWY && y === SEA) ? ICE : WATER;
      if (id !== WATER && id !== ICE && id !== BEDROCK && y > YMIN+3 && y <= caveTop) {
        const a = n3a(wx / 26, y / 15, wz / 26), c = n3b(wx / 26, y / 15, wz / 26);
        if (a * a + c * c < 0.0075 || (y < 22 && n3a(wx / 55 + 40, y / 26, wz / 55) > 0.42)) id = AIR;
      }
      B[bidx(x, y, z)] = id;
    }
  }
  // ores
  const rnd = mulberry32(hash2(cx, cz, seed + 5) * 4294967296);
  const vein = (id, count, size, ymin, ymax) => {
    for (let v = 0; v < count; v++) {
      let x = rnd() * 16, y = ymin + rnd() * (ymax - ymin), z = rnd() * 16;
      const n = Math.floor(size * (0.6 + rnd() * 0.6));
      for (let k = 0; k < n; k++) {
        const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
        if (ix >= 0 && ix < CS && iz >= 0 && iz < CS && iy > YMIN && iy < WH && (B[bidx(ix, iy, iz)] === STONE || B[bidx(ix, iy, iz)] === DEEPSLATE)) B[bidx(ix, iy, iz)] = id;
        x += rnd() * 2 - 1; y += rnd() * 2 - 1; z += rnd() * 2 - 1;
      }
    }
  };
  vein(COAL_ORE, 22, 10, -15, 130); vein(IRON_ORE, 22, 9, -45, 100); vein(GOLD_ORE, 8, 7, -50, 30); vein(DIAMOND_ORE, 7, 6, -52, 10);
  vein(DIRT, 4, 14, 8, 50); vein(GRAVEL, 3, 12, 5, 50);
  if (rnd() < 0.6) vein(DIAMOND_ORE, 1, 3, 3, 12);
  for(let i=0;i<CVOL;i++){const y=Math.floor(i/256)+YMIN;if(y>=17)break;const m={[COAL_ORE]:DEEP_COAL,[IRON_ORE]:DEEP_IRON,[GOLD_ORE]:DEEP_GOLD,[DIAMOND_ORE]:DEEP_DIAMOND};if(m[B[i]])B[i]=m[B[i]];}
  // surface decoration
  const setL = (lx, y, lz, id, force) => {
    if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < YMIN || y >= WH) return;
    const i = bidx(lx, y, lz), cur = B[i];
    if (cur === AIR || (BLOCK[cur] && BLOCK[cur].render === 'cross') || (force && (cur === LEAVES || cur === SPRUCE_LEAVES || cur === BIRCH_LEAVES))) B[i] = id;
  };
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const h = hs[(z + M) * SZ + x + M], b = bs[(z + M) * SZ + x + M], wx = x0 + x, wz = z0 + z;
    if (h <= SEA || h + 1 >= WH) continue;
    const topId = B[bidx(x, h, z)];
    const r = hash2(wx, wz, seed + 21);
    if (b === DESERT && topId === SAND) {
      if (r < 0.005) { const ht = 1 + Math.floor(hash2(wx, wz, seed + 22) * 3); for (let k = 1; k <= ht; k++) setL(x, h + k, z, CACTUS); }
      else if (r < 0.014) setL(x, h + 1, z, DEAD_BUSH);
    } else if (topId === GRASS) {
      const g = b === PLAINS ? 0.2 : b === FOREST ? 0.09 : 0.05;
      if (r < g) setL(x, h + 1, z, TALL_GRASS);
      else if (r < g + 0.018) setL(x, h + 1, z, hash2(wx, wz, seed + 23) < 0.5 ? FLOWER_RED : FLOWER_YELLOW);
      else if (r < g + 0.0195 && b === PLAINS) setL(x, h + 1, z, PUMPKIN);
      else if (r < g + 0.0205 && b === FOREST) setL(x, h + 1, z, MELON);
    }
  }
  // trees (may cross chunk borders, deterministic per column)
  for (let lz = -M; lz < CS + M; lz++) for (let lx = -M; lx < CS + M; lx++) {
    const k = (lz + M) * SZ + lx + M, h = hs[k], b = bs[k], wx = x0 + lx, wz = z0 + lz;
    if (h <= SEA || h > WH - 12) continue;
    const dens = b === FOREST ? 0.05 : b === SNOWY ? 0.022 : b === PLAINS ? 0.005 : (b === MOUNTAIN && h <= 39) ? 0.012 : 0;
    if (!dens || hash2(wx, wz, seed + 11) >= dens) continue;
    if (W.structures !== false && treeBlocked(wx, wz)) continue;
    if (lx >= 0 && lx < CS && lz >= 0 && lz < CS) { const t = B[bidx(lx, h, lz)]; if (t !== GRASS && t !== SNOW_GRASS && t !== DIRT) continue; }
    const kind = b === SNOWY ? 2 : (b === FOREST && hash2(wx, wz, seed + 12) < 0.3) ? 1 : 0;
    placeTree(setL, lx, h + 1, lz, kind, hash2(wx, wz, seed + 13));
  }
  if (W.structures !== false) generateOverworldStructures(ch);
  // apply player modifications
  const mods = W.mods.get(ckey(cx, cz));
  if (mods) for (const [i, id] of mods) B[i] = id;
  applyPendingTE(ch);
  for (let i = 0; i < CVOL; i++) { const id = B[i]; if (id && BLOCK[id] && BLOCK[id].light) ch.emit.add(i); }
  return ch;
}

function generateDimensionChunk(cx,cz){
 const ch=newChunk(cx,cz),b=ch.blocks,nether=W.dimension==='nether';
 for(let z=0;z<16;z++)for(let x=0;x<16;x++){
  const wx=cx*16+x,wz=cz*16+z,radius=Math.hypot(wx,wz),n=W.noise.n2(wx/42,wz/42);
  const island=radius<100||(radius>180&&(W.noise2.fbm2(wx/100,wz/100,3)>0.03||endForcedIsland(wx,wz)));
  const h=nether?Math.floor(64+n*16):Math.floor(radius<100?60+Math.max(0,1-(radius/100)**2)*6+n*2:62+n*10);
  ch.heights[z*16+x]=nether?127:(island?h:YMIN);
  for(let y=YMIN;y<WH;y++){
   let id=AIR;
   if(nether){
    if(y===YMIN||y===127)id=BEDROCK;
    else if(y<0)id=NETHERRACK;
    else if(y<127){
     const cave=W.noise.n3(wx/43,y/30,wz/43)+W.noise2.n3(wx/75,y/42,wz/75)*0.4;
     if(y<5||y>120||cave>0.12)id=NETHERRACK;
     else if(y<=30)id=LAVA;
     if(id===NETHERRACK&&y>=6&&y<=24&&hash3(Math.floor(wx/2),Math.floor(y/2),Math.floor(wz/2),W.seed+909)<.004)id=ANCIENT_DEBRIS;
     if(id===NETHERRACK){const r=hash3(wx,y,wz,W.seed);if(r<0.022)id=NETHER_QUARTZ;else if(r<0.035)id=BLACKSTONE;else if(n>0.1&&y<43)id=SOUL_SAND;else if(y>60&&r<0.043)id=GLOWSTONE;}
    }
   }else{
    const thickness=Math.max(7,26-radius/7);
    if(island&&y<=h&&y>h-thickness)id=END_STONE;
    for(let k=0;k<10;k++){const angle=k*Math.PI/5,px=Math.round(Math.cos(angle)*43),pz=Math.round(Math.sin(angle)*43),rr=2+k%3,top=85+k*4;
      if((wx-px)**2+(wz-pz)**2<=rr*rr&&y>=50&&y<=top)id=OBSIDIAN;
      if(wx===px&&wz===pz&&y===top+1)id=AMETHYST_BLOCK;
    }
   }
   if(nether){const fx=wx-(Math.floor((wx+128)/256)*256),fz=wz-(Math.floor((wz+128)/256)*256);
    if((Math.abs(fx)<4&&Math.abs(fz)<42)||(Math.abs(fz)<4&&Math.abs(fx)<42)){
      if(y===62||y===63)id=NETHER_BRICKS;else if(y>63&&y<69)id=AIR;
      if((y===64||y===65)&&((Math.abs(fx)===3&&Math.abs(fz)>4)||(Math.abs(fz)===3&&Math.abs(fx)>4)))id=NETHER_BRICKS;
      if(y<63&&y>32&&((Math.abs(fx)<3&&Math.abs(fz%16)<3)||(Math.abs(fz)<3&&Math.abs(fx%16)<3)))id=NETHER_BRICKS;
    }
   }
   if(nether)for(const [tx,tz]of [[40,0],[-40,0],[0,40],[0,-40]]){const fx=wx-Math.round(wx/256)*256, fz=wz-Math.round(wz/256)*256,ax=Math.abs(fx-tx),az=Math.abs(fz-tz);if(ax<=6&&az<=6&&y>=62&&y<=73){if(y===62||y===63||y===73)id=NETHER_BRICKS;else if(ax===6||az===6)id=(ax<2||az<2)&&y<68?AIR:NETHER_BRICKS;else id=AIR;}}
   // Arrival platform is clear of terrain and has a complete return frame.
   const arrivalFloor=nether?48:64;
   if(nether&&Math.abs(wx)<=5&&Math.abs(wz)<=6){if(y===48)id=OBSIDIAN;else if(y>48&&y<55)id=AIR;}
   if(!nether&&Math.abs(wx-100)<=2&&Math.abs(wz)<=2){if(y===48)id=OBSIDIAN;else if(y>48&&y<53)id=AIR;}
   if(nether&&wz===4&&wx>=-2&&wx<=1&&y>=48&&y<=53){id=(wx===-2||wx===1||y===48||y===53)?OBSIDIAN:NETHER_PORTAL;}
   if(!nether&&Math.hypot(wx,wz)<=4){if(y>=68&&y<=74)id=AIR;if(y===67&&Math.hypot(wx,wz)<=3)id=BEDROCK;if(Math.abs(wx)<=1&&Math.abs(wz)<=1&&y===68)id=END_PORTAL;if(wx===0&&wz===0&&y>=68&&y<=71)id=BEDROCK;}
   b[bidx(x,y,z)]=id;
  }
 }
 if(!nether&&W.structures!==false)generateEndStructures(ch);
 const mods=W.mods.get(ckey(cx,cz));if(mods)for(const [i,id]of mods)b[i]=id;
 applyPendingTE(ch);
 for(let i=0;i<CVOL;i++){if(BLOCK[b[i]]?.light)ch.emit.add(i);if(b[i]===NETHER_PORTAL){const x=cx*16+(i&15),y=(i>>8)+YMIN,z=cz*16+((i>>4)&15);if(!W.te.has(pkey(x,y,z)))W.te.set(pkey(x,y,z),{type:'nether',frame:{x:-1,y:49,z:4,dx:1,dz:0,width:2,height:4}});}}
 return ch;
}
function ignitePortal(t){
 const open=id=>id===AIR||id===NETHER_PORTAL;
 for(const [dx,dz]of [[1,0],[0,1]])for(const [sx,sy,sz]of [[t.px,t.py,t.pz],[t.x+dx,t.y,t.z+dz],[t.x-dx,t.y,t.z-dz],[t.x,t.y+1,t.z]]){
  if(!open(getBlock(sx,sy,sz)))continue;
  let y=sy,l=0,r=0;while(y>YMIN&&sy-y<21&&open(getBlock(sx,y-1,sz)))y--;
  if(getBlock(sx,y-1,sz)!==OBSIDIAN)continue;
  while(l>-21&&open(getBlock(sx+(l-1)*dx,y,sz+(l-1)*dz)))l--;
  while(r-l<21&&open(getBlock(sx+(r+1)*dx,y,sz+(r+1)*dz)))r++;
  const width=r-l+1;if(width<2||width>21)continue;
  let height=0;while(height<22&&open(getBlock(sx,y+height,sz)))height++;
  if(height<3||height>21)continue;
  let valid=true;for(let a=l;a<=r;a++)if(getBlock(sx+a*dx,y-1,sz+a*dz)!==OBSIDIAN||getBlock(sx+a*dx,y+height,sz+a*dz)!==OBSIDIAN)valid=false;
  for(let b=0;b<height;b++){if(getBlock(sx+(l-1)*dx,y+b,sz+(l-1)*dz)!==OBSIDIAN||getBlock(sx+(r+1)*dx,y+b,sz+(r+1)*dz)!==OBSIDIAN)valid=false;for(let a=l;a<=r;a++)if(!open(getBlock(sx+a*dx,y+b,sz+a*dz)))valid=false;}
  if(!valid)continue;
  const origin={x:sx+l*dx,y,z:sz+l*dz,dx,dz,width,height};
  for(let b=0;b<height;b++)for(let a=0;a<width;a++){const x=origin.x+a*dx,z=origin.z+a*dz;setBlock(x,y+b,z,NETHER_PORTAL);W.te.set(pkey(x,y+b,z),{type:'nether',frame:origin});}
  hint(tr('네더 차원문이 열렸습니다. 안에 서서 기다리세요.'));return true;
 }return false;
}
function validPortalFrame(f){
 if(!getChunk((f.x-f.dx)>>4,(f.z-f.dz)>>4)||!getChunk((f.x+f.width*f.dx)>>4,(f.z+f.width*f.dz)>>4))return true;
 for(let a=0;a<f.width;a++)for(const y of [f.y-1,f.y+f.height])if(getBlock(f.x+a*f.dx,y,f.z+a*f.dz)!==OBSIDIAN)return false;
 for(let b=0;b<f.height;b++)for(const a of [-1,f.width])if(getBlock(f.x+a*f.dx,f.y+b,f.z+a*f.dz)!==OBSIDIAN)return false;return true;
}
function activateEndFrame(t){
 W.te.set(pkey(t.x,t.y,t.z),{type:'endframe',eye:true});consumeHeld(1);
 for(let cx=t.x-2;cx<=t.x+2;cx++)for(let cz=t.z-2;cz<=t.z+2;cz++){
  let ok=true;for(let d=-1;d<=1;d++)for(const [x,z]of [[cx-2,cz+d],[cx+2,cz+d],[cx+d,cz-2],[cx+d,cz+2]])if(getBlock(x,t.y,z)!==END_FRAME||!W.te.get(pkey(x,t.y,z))?.eye)ok=false;
  if(ok){for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)setBlock(cx+dx,t.y,cz+dz,END_PORTAL);hint(tr('엔드 차원문이 열렸습니다.'));return;}
 }hint(tr('엔더의 눈을 끼웠습니다. 틀 12개를 모두 채우세요.'));
}
function updatePortal(dt){
 P.portalCooldown=Math.max(0,(P.portalCooldown||0)-dt);
 let id=0;for(const yy of [P.y,P.y+0.8,P.y+1.5]){const n=getBlock(Math.floor(P.x),Math.floor(yy),Math.floor(P.z));if(n===NETHER_PORTAL||n===END_PORTAL)id=n;}
 if(!id){P.portalTime=0;P.portalExit=true;}else if(P.portalCooldown<=0&&P.portalExit!==false){
  if(!P.portalTime&&id===NETHER_PORTAL&&G.mode==='survival')hint(tr('차원문 안에서 4초 동안 기다리세요.'));
  P.portalTime=(P.portalTime||0)+dt;
  if(P.portalTime>=(id===END_PORTAL?0.1:G.mode==='creative'?0.3:4)){P.portalExit=false;travelDimension(id===END_PORTAL?(W.dimension==='end'?'overworld':'end'):(W.dimension==='nether'?'overworld':'nether'));return;}
 }
 W.portalCheck=(W.portalCheck||0)+dt;if(W.portalCheck<1)return;W.portalCheck=0;
 for(const [k,te]of [...W.te])if(te.type==='nether'&&te.frame&&!validPortalFrame(te.frame)){const [x,y,z]=k.split(',').map(Number);if(getBlock(x,y,z)===NETHER_PORTAL)setBlock(x,y,z,AIR);W.te.delete(k);}
}
function isLava(id){return id===LAVA||(id>=192&&id<=195);}
function lavaUpdate(x,y,z){
 const id=getBlock(x,y,z);if(!isLava(id))return;
 for(const [dx,dy,dz]of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])if(isWater(getBlock(x+dx,y+dy,z+dz))){setBlock(x,y,z,id===LAVA?OBSIDIAN:COBBLE);return;}
 if(y>YMIN&&getBlock(x,y-1,z)===AIR){setBlock(x,y-1,z,192);return;}
 const level=id===LAVA?0:id-191;if(level>=4)return;
 for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(getBlock(x+dx,y,z+dz)===AIR)setBlock(x+dx,y,z+dz,192+level);
}
function updateLava(dt){
 if(G.loading)return;const x=Math.floor(P.x),y=Math.floor(P.y),z=Math.floor(P.z);
 if(isLava(getBlock(x,y,z))||isLava(getBlock(x,y+1,z))){P.lavaT=(P.lavaT||0)+dt;if(P.lavaT>0.5){P.lavaT=0;damagePlayer(4,'lava');}}else P.lavaT=0;
}
function travelDimension(dest){
 if(!G||G.loading)return;
 P.portalCooldown=6;P.portalTime=0;
 const old=W.dimension||'overworld';if(dest===old)dest='overworld';
 W.dimensions[old]={version:2,mods:encodeMods(),te:Object.fromEntries(W.te),pos:{x:P.x,y:P.y,z:P.z},spawn:G.spawn};
 for(const ch of W.chunks.values())freeChunkGL(ch);
 const saved=W.dimensions[dest];W.dimension=dest;W.mods=decodeMods(saved?.mods);W.te=new Map(Object.entries(saved?.te||{}));W.chunks=new Map();
 for(const k of ['mobs','items','particles','tnts','arrows'])W[k]=[];
 W.fluidQ.clear();W.gravQ.clear();lastChunk=null;lastPc=null;wantList=[];
 const pos=(saved&&(saved.version===2||dest==='overworld')?saved.pos:null)||(dest==='overworld'?findSpawn():{x:dest==='end'?100.5:.5,y:49,z:.5});
 Object.assign(P,pos,{vx:0,vy:0,vz:0,fallStart:pos.y});G.spawn=saved?.spawn||{...pos};
 G.loading=true;G.fresh=false;G.ui='loading';G.target=null;G.targetMob=null;G.sleep=0;ctx.setPaused(false);showLoading(0);
}
function placeTree(set, x, y, z, kind, r) {
  const log = kind === 1 ? BIRCH_LOG : kind === 2 ? SPRUCE_LOG : LOG;
  const leaf = kind === 1 ? BIRCH_LEAVES : kind === 2 ? SPRUCE_LEAVES : LEAVES;
  if (kind === 2) {
    const ht = 6 + Math.floor(r * 3);
    for (let k = 0; k < ht; k++) set(x, y + k, z, log, true);
    let rad = 0;
    for (let k = ht; k >= 2; k--) {
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (Math.abs(dx) + Math.abs(dz) <= rad + (rad > 1 ? 1 : 0) && (dx || dz || k >= ht)) set(x + dx, y + k, z + dz, leaf);
      rad = rad >= 2 ? 1 : rad + 1;
    }
    set(x, y + ht, z, leaf); set(x, y + ht + 1, z, leaf);
    return;
  }
  const ht = (kind === 1 ? 5 : 4) + Math.floor(r * 3);
  for (let k = 0; k < ht; k++) set(x, y + k, z, log, true);
  for (let k = ht - 3; k <= ht; k++) {
    const rad = k >= ht - 1 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (Math.abs(dx) === rad && Math.abs(dz) === rad && (k === ht || hash3(x + dx, k, z + dz, 7) < 0.5)) continue;
      if (dx === 0 && dz === 0 && k < ht) continue;
      set(x + dx, y + k, z + dz, leaf);
    }
  }
}

function getChunk(cx, cz) {
  if (lastChunk && lastChunk.cx === cx && lastChunk.cz === cz) return lastChunk;
  const c = W.chunks.get(ckey(cx, cz)); if (c) lastChunk = c; return c;
}
function getBlock(x, y, z) {
  if (y < YMIN) return BEDROCK; if (y >= WH) return AIR;
  const ch = getChunk(x >> 4, z >> 4); if (!ch) return BEDROCK;
  return ch.blocks[bidx(x & 15, y, z & 15)];
}
function getLight(x, y, z) {
  if (y >= WH) return 0xF0; if (y < YMIN) return 0;
  const ch = getChunk(x >> 4, z >> 4); if (!ch) return 0xF0;
  return ch.light[bidx(x & 15, y, z & 15)];
}
const solidAt = (x, y, z) => { const b = BLOCK[getBlock(x, y, z)]; return !!(b && b.solid); };

function recordMod(cx, cz, i, id) {
  const k = ckey(cx, cz); let m = W.mods.get(k); if (!m) W.mods.set(k, m = new Map()); m.set(i, id);
}
function setBlock(x, y, z, id, opts = {}) {
  if (y < YMIN || y >= WH) return false;
  const cx = x >> 4, cz = z >> 4, ch = getChunk(cx, cz); if (!ch) return false;
  const lx = x & 15, lz = z & 15, i = bidx(lx, y, lz), old = ch.blocks[i];
  if (old === id) return false;
  ch.blocks[i] = id; recordMod(cx, cz, i, id);
  if(id===AIR && (old===BED||old===BED_HEAD)){
    const oz=z+(old===BED?1:-1), other=getBlock(x,y,oz);
    if(other===(old===BED?BED_HEAD:BED)){setBlock(x,y,oz,AIR);if(old===BED_HEAD&&G.mode==='survival')spawnItem(BED,1,x+0.5,y+0.5,z+0.5);}
  }
  const ol = (BLOCK[old] && BLOCK[old].light) || 0, nl = (BLOCK[id] && BLOCK[id].light) || 0;
  if (nl) ch.emit.add(i); else ch.emit.delete(i);
  const k = pkey(x, y, z);
  if (W.te.has(k) && (!BLOCK[id] || !BLOCK[id].use || BLOCK[id].use !== W.te.get(k).type)) W.te.delete(k);
  // relight & remesh this chunk and neighbours that might be affected
  const lightRange = (ol || nl) ? 14 : 1;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const tcx = (x + dx * lightRange) >> 4, tcz = (z + dz * lightRange) >> 4;
    const c = getChunk(tcx, tcz); if (c) { c.needLight = true; c.needMesh = true; c.urgent = true; }
  }
  // neighbours that share faces (AO / culling)
  for (const [ax, az] of [[lx === 0 ? -1 : lx === 15 ? 1 : 0, 0], [0, lz === 0 ? -1 : lz === 15 ? 1 : 0]]) if (ax || az) { const c = getChunk(cx + ax, cz + az); if (c) { c.needMesh = true; c.urgent = true; } }
  if (opts.noUpdate !== true) for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const kk = pkey(x + dx, y + dy, z + dz); W.fluidQ.add(kk); W.gravQ.add(kk); }
  return true;
}

// ── lighting ──
const LQ = new Int32Array(CVOL * 4);
function isOpaqueId(id) { const b = BLOCK[id]; return !!(b && b.opaque); }
function lightChunk(ch) {
  const L = ch.light, B = ch.blocks; L.fill(0);
  const top = new Int16Array(CS * CS);
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    let lv = 15, t = WH;
    for (let y = WH - 1; y >= YMIN; y--) {
      const i = bidx(x, y, z), id = B[i];
      if (id) { const b = BLOCK[id]; if (b.opaque) lv = 0; else if (b.render === 'cutout' || b.render === 'water' || b.render === 'translucent') lv = Math.max(0, lv - (isWater(id) ? 2 : 1)); }
      if (lv < 15 && t === WH) t = y;
      if (lv === 0) break;
      L[i] = lv << 4;
    }
    top[z * CS + x] = Math.min(t, WH - 1);
  }
  let qh = 0, qt = 0;
  const push = (i) => { LQ[qt++] = i; };
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    let mt = top[z * CS + x];
    if (x > 0) mt = Math.max(mt, top[z * CS + x - 1]); if (x < 15) mt = Math.max(mt, top[z * CS + x + 1]);
    if (z > 0) mt = Math.max(mt, top[(z - 1) * CS + x]); if (z < 15) mt = Math.max(mt, top[(z + 1) * CS + x]);
    for (let y = Math.min(WH - 1, mt + 1); y >= YMIN; y--) { const i = bidx(x, y, z); if ((L[i] >> 4) > 1) push(i); }
  }
  // seeds from neighbouring chunks
  const seedFrom = (nc, getN, getOwn) => {
    if (!nc || !nc.lit) return;
    for (let y = YMIN; y < WH; y++) for (let k = 0; k < CS; k++) {
      const s = nc.light[getN(y, k)] >> 4, i = getOwn(y, k);
      if (s > 1 && !isOpaqueId(B[i]) && (L[i] >> 4) < s - 1) { L[i] = (s - 1) << 4 | (L[i] & 15); push(i); }
    }
  };
  seedFrom(getChunk(ch.cx - 1, ch.cz), (y, k) => bidx(15, y, k), (y, k) => bidx(0, y, k));
  seedFrom(getChunk(ch.cx + 1, ch.cz), (y, k) => bidx(0, y, k), (y, k) => bidx(15, y, k));
  seedFrom(getChunk(ch.cx, ch.cz - 1), (y, k) => bidx(k, y, 15), (y, k) => bidx(k, y, 0));
  seedFrom(getChunk(ch.cx, ch.cz + 1), (y, k) => bidx(k, y, 0), (y, k) => bidx(k, y, 15));
  while (qh < qt) {
    const i = LQ[qh++], v = (L[i] >> 4) - 1; if (v <= 0) continue;
    const x = i & 15, z = (i >> 4) & 15, y = (i >> 8) + YMIN;
    const tryN = (j) => { if ((L[j] >> 4) < v && !isOpaqueId(B[j])) { L[j] = v << 4 | (L[j] & 15); if (v > 1) push(j); } };
    if (x > 0) tryN(i - 1); if (x < 15) tryN(i + 1);
    if (z > 0) tryN(i - 16); if (z < 15) tryN(i + 16);
    if (y > YMIN) tryN(i - 256); if (y < WH - 1) tryN(i + 256);
    if (qt > LQ.length - 8) break;
  }
  // block light: emitters in this and neighbouring chunks
  const sources = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const c = (dx || dz) ? getChunk(ch.cx + dx, ch.cz + dz) : ch; if (!c) continue;
    for (const i of c.emit) { const lx = (i & 15) + dx * CS, lz = ((i >> 4) & 15) + dz * CS; if (lx < -14 || lx > 29 || lz < -14 || lz > 29) continue; sources.push([lx, (i >> 8) + YMIN, lz, BLOCK[c.blocks[i]] ? BLOCK[c.blocks[i]].light : 0]); }
  }
  if (sources.length) blockLight(ch, sources);
  ch.lit = true; ch.needLight = false;
  // Adjacent meshes may have sampled this chunk before its light was calculated.
  for (let dz=-1; dz<=1; dz++) for (let dx=-1; dx<=1; dx++) {
    if (!dx && !dz) continue; const neighbor=getChunk(ch.cx+dx,ch.cz+dz);
    if (neighbor && neighbor.mesh) neighbor.needMesh=true;
  }
}
// BFS in a padded region (chunk ± 15 blocks) so light crosses chunk borders
const PAD = 15, RW = CS + PAD * 2, RVOL = RW * RW * HEIGHT;
const RL = new Uint8Array(RVOL), RQ = new Int32Array(RVOL);
function blockLight(ch, sources) {
  RL.fill(0);
  const ox = ch.cx * CS - PAD, oz = ch.cz * CS - PAD;
  const ridx = (x, y, z) => ((y - YMIN) * RW + z) * RW + x;
  let qh = 0, qt = 0;
  for (const [lx, y, lz, lv] of sources) { const i = ridx(lx + PAD, y, lz + PAD); if (RL[i] < lv) { RL[i] = lv; RQ[qt++] = i; } }
  while (qh < qt) {
    const i = RQ[qh++], v = RL[i] - 1; if (v <= 0) continue;
    const x = i % RW, z = Math.floor(i / RW) % RW, y = Math.floor(i / (RW * RW)) + YMIN;
    const tryN = (nx, ny, nz) => {
      if (nx < 0 || nz < 0 || nx >= RW || nz >= RW || ny < YMIN || ny >= WH) return;
      const j = ridx(nx, ny, nz); if (RL[j] >= v) return;
      if (isOpaqueId(getBlock(ox + nx, ny, oz + nz))) return;
      RL[j] = v; if (v > 1) RQ[qt++] = j;
    };
    tryN(x - 1, y, z); tryN(x + 1, y, z); tryN(x, y - 1, z); tryN(x, y + 1, z); tryN(x, y, z - 1); tryN(x, y, z + 1);
  }
  const L = ch.light;
  for (let y = YMIN; y < WH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) { const v = RL[ridx(x + PAD, y, z + PAD)]; if (v) { const i = bidx(x, y, z); L[i] = (L[i] & 0xF0) | v; } }
}

// ── fluids, falling blocks, random ticks ──
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function flowable(id) { if (id === AIR) return true; const b = BLOCK[id]; return !!(b && !b.solid && !b.fluid && b.render !== 'water'); }
function washAway(x, y, z) { const id = getBlock(x, y, z); if (id && !isWater(id) && BLOCK[id] && BLOCK[id].render !== 'water') dropBlockItems(x, y, z, id, false); }
function fluidUpdate(x, y, z) {
  if(isLava(getBlock(x,y,z))){lavaUpdate(x,y,z);return;}
  const id = getBlock(x, y, z);
  if (!isWater(id)) return;
  const lvl = waterLevel(id);
  if (lvl > 0) {
    let expect = 99, sources = 0;
    if (isWater(getBlock(x, y + 1, z))) expect = 1;
    for (const [dx, dz] of DIRS4) {
      const n = getBlock(x + dx, y, z + dz); if (!isWater(n)) continue;
      const nl = waterLevel(n); if (nl === 0) sources++;
      const sp = (nl === 0 || isWater(getBlock(x + dx, y + 1, z + dz))) ? 1 : nl + 1;
      if (sp < expect) expect = sp;
    }
    const below = getBlock(x, y - 1, z);
    if (sources >= 2 && ((BLOCK[below] && BLOCK[below].solid) || below === WATER)) expect = 0;
    if (expect > 7) { setBlock(x, y, z, AIR); return; }
    if (expect !== lvl) { setBlock(x, y, z, WATER + expect); return; }
  }
  const below = getBlock(x, y - 1, z);
  if (y > YMIN && (flowable(below) || (isWater(below) && waterLevel(below) > 1))) { if (!isWater(below)) washAway(x, y - 1, z); setBlock(x, y - 1, z, WATER + 1); return; }
  if (isWater(below)) return;
  const sp = (lvl === 0 || isWater(getBlock(x, y + 1, z))) ? 1 : lvl + 1;
  if (sp > 7) return;
  for (const [dx, dz] of DIRS4) {
    const n = getBlock(x + dx, y, z + dz);
    if (flowable(n)) { washAway(x + dx, y, z + dz); setBlock(x + dx, y, z + dz, WATER + sp); }
    else if (isWater(n) && waterLevel(n) > sp) setBlock(x + dx, y, z + dz, WATER + sp);
  }
}
function gravityUpdate(x, y, z) {
  const id = getBlock(x, y, z), b = BLOCK[id];
  if (!b) return;
  if (id >= POWDER && id < POWDER + 16) { for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (isWater(getBlock(x + dx, y + dy, z + dz))) { setBlock(x, y, z, CONCRETE + id - POWDER); return; } }
  if (b.gravity) {
    const below = getBlock(x, y - 1, z);
    if (y > YMIN && (below === AIR || isWater(below) || (BLOCK[below] && BLOCK[below].replaceable))) { setBlock(x, y, z, AIR); setBlock(x, y - 1, z, id); }
    return;
  }
  // plants and torches need support
  if (b.needsSoil || b.needsSand || b.needsFloor || b.needsFarm) {
    const below = getBlock(x, y - 1, z), bb = BLOCK[below];
    const ok = b.needsFarm ? below === FARMLAND : b.needsSoil ? (below === GRASS || below === DIRT || below === SNOW_GRASS || below === FARMLAND) : b.needsSand ? (below === SAND || below === DIRT || below === GRASS || below === SUGAR_CANE || below === RED_SAND) : !!(bb && bb.solid);
    if (!ok) { setBlock(x, y, z, AIR); dropBlockItems(x, y, z, id, false); }
  }
  if (id === CACTUS) {
    const below = getBlock(x, y - 1, z);
    if (below !== SAND && below !== CACTUS) { setBlock(x, y, z, AIR); dropBlockItems(x, y, z, id, false); }
  }
}
function randomTicks(px, pz) {
  const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    const ch = getChunk(pcx + dx, pcz + dz); if (!ch || !ch.lit) continue;
    for (let n = 0; n < 3; n++) {
      const i = Math.floor(Math.random() * CVOL), id = ch.blocks[i];
      if (id !== SAPLING && id !== DIRT && id !== GRASS) continue;
      const x = (i & 15) + ch.cx * CS, z = ((i >> 4) & 15) + ch.cz * CS, y = (i >> 8) + YMIN;
      const above = getBlock(x, y + 1, z);
      if (id === SAPLING && Math.random() < 0.12) growTree(x, y, z);
      else if (id === GRASS && isOpaqueId(above)) setBlock(x, y, z, DIRT, { noUpdate: true });
      else if (id === DIRT && !isOpaqueId(above) && !isWater(above) && (getLight(x, y + 1, z) >> 4) >= 9) {
        for (let k = 0; k < 4; k++) { const ax = x + Math.floor(Math.random() * 3) - 1, ay = y + Math.floor(Math.random() * 3) - 1, az = z + Math.floor(Math.random() * 3) - 1; if (getBlock(ax, ay, az) === GRASS) { setBlock(x, y, z, GRASS, { noUpdate: true }); break; } }
      }
    }
  }
}
function growTree(x, y, z) {
  for (let k = 1; k < 6; k++) if (getBlock(x, y + k, z) !== AIR) return;
  const below = getBlock(x, y - 1, z);
  const kind = below === SNOW_GRASS ? 2 : Math.random() < 0.3 ? 1 : 0;
  setBlock(x, y, z, AIR, { noUpdate: true });
  placeTree((lx, ly, lz, id, force) => { const cur = getBlock(lx, ly, lz); if (cur === AIR || (BLOCK[cur] && BLOCK[cur].render === 'cross') || (force && BLOCK[cur] && BLOCK[cur].render === 'cutout')) setBlock(lx, ly, lz, id, { noUpdate: true }); }, x, y, z, kind, Math.random());
}

function findSpawn() {
  for (let r = 0; r < 600; r += 8) for (let a = 0; a < Math.max(1, r / 2); a++) {
    const ang = a / Math.max(1, r / 2) * Math.PI * 2, x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
    const [h, b] = column(x, z);
    if (b !== OCEAN && b !== BEACH && h > SEA + 1 && h < SEA+35) return { x: x + 0.5, y: h + 1, z: z + 0.5 };
  }
  return { x: 0.5, y: WH - 10, z: 0.5 };
}

// ── save encoding ──
function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const s = atob(str), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function encodeMods() {
 const out={};for(const [k,m]of W.mods){if(!m.size)continue;const a=new Uint8Array(m.size*4);let j=0;for(const [i,id]of m){a[j++]=i&255;a[j++]=(i>>>8)&255;a[j++]=(i>>>16)&255;a[j++]=id;}out[k]={v:2,data:b64(a)};}return out;
}
function decodeMods(obj){
 const mods=new Map();for(const k in obj||{}){try{const val=obj[k],modern=val?.v===2,a=unb64(modern?val.data:val),m=new Map(),stride=modern?4:3;for(let j=0;j+stride<=a.length;j+=stride){const i=modern?(a[j]|a[j+1]<<8|a[j+2]<<16):(a[j]|a[j+1]<<8)-YMIN*256;if(i>=0&&i<CVOL)m.set(i,a[j+stride-1]);}mods.set(k,m);}catch{}}return mods;
}
