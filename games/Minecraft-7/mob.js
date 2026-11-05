// ── mobs ──
const MOBDEF = {
  pig: { name: '돼지', hp: 10, w: 0.45, h: 0.9, speed: 1.3, passive: true, drops: [[PORK, 1, 3]], cooked: COOKED_PORK },
  cow: { name: '소', hp: 10, w: 0.45, h: 1.3, speed: 1.2, passive: true, drops: [[BEEF, 1, 3], [LEATHER, 0, 2]], cooked: STEAK },
  sheep: { name: '양', hp: 8, w: 0.45, h: 1.25, speed: 1.2, passive: true, drops: [[WOOL, 1, 1], [MUTTON, 1, 2]] },
  zombie: { name: '좀비', hp: 20, w: 0.3, h: 1.9, speed: 2.3, hostile: true, dmg: 3, drops: [[FLESH, 0, 2]], burns: true },
  spider: { name: '거미', hp: 16, w: 0.65, h: 0.9, speed: 3.1, hostile: true, dmg: 2, drops: [[STRING, 0, 2]], climbs: true },
};
const EXTRA_MOBS=[
 ['villager','주민',20,.3,1.95,1.2,'villager_face','humanoid','overworld'],
 ['iron_golem','철 골렘',100,.65,2.7,1.4,'golem_face','golem','overworld'],
 ['skeleton','스켈레톤',20,.3,1.95,2,'skeleton_face','skeleton','overworld'],
 ['creeper','크리퍼',20,.3,1.7,1.6,'creeper_face','creeper','overworld'],
 ['enderman','엔더맨',40,.3,2.9,2.6,'enderman_face','enderman','end'],
 ['blaze','블레이즈',20,.3,1.8,1.5,'blaze_face','blaze','nether'],
 ['piglin','피글린',16,.3,1.95,2,'piglin_face','humanoid','nether'],
 ['zombified_piglin','좀비화 피글린',20,.3,1.95,1.7,'piglin_face','humanoid','nether'],
 ['wither_skeleton','위더 스켈레톤',20,.35,2.4,2.2,'enderman_face','skeleton','nether'],
 ['husk','허스크',20,.3,1.95,2,'villager_face','humanoid','overworld'],
 ['stray','스트레이',20,.3,1.95,2,'skeleton_face','skeleton','overworld'],
 ['witch','마녀',26,.3,1.95,1.8,'villager_face','witch','overworld'],
 ['wolf','늑대',8,.3,.85,1.6,'skeleton_face','quadruped','overworld'],
 ['cat','고양이',10,.25,.7,1.8,'piglin_face','quadruped','overworld'],
 ['chicken','닭',4,.2,.7,1.3,'skeleton_face','chicken','overworld'],
 ['horse','말',30,.6,1.6,2.3,'villager_robe','quadruped','overworld'],
 ['slime','슬라임',16,.5,1,1.5,'creeper_face','slime','overworld'],
 ['magma_cube','마그마 큐브',16,.5,1,1.5,'blaze_face','slime','nether']
];
for(let i=0;i<EXTRA_MOBS.length;i++){
 const [type,name,hp,w,h,speed,face,model,dimension]=EXTRA_MOBS[i],passive=['villager','iron_golem','wolf','cat','chicken','horse','zombified_piglin'].includes(type);
 MOBDEF[type]={name,hp,w,h,speed,face,model,dimension,passive,hostile:!passive,dmg:type==='iron_golem'?12:3,burns:['skeleton','stray'].includes(type),drops:type==='iron_golem'?[[IRON,3,5]]:type==='chicken'?[[BULK_ITEM_START+22,1,2]]:type==='skeleton'?[[ARROW,0,2],[BULK_ITEM_START+3,0,2]]:type==='enderman'?[[BULK_ITEM_START+7,0,1]]:type==='blaze'?[[BULK_ITEM_START+8,0,1]]:[]};
 I(368+i,name+' 생성 알','spawn_egg_'+i,{spawnMob:type});
}
const NETHER_MOBS=[
 ['ghast','가스트',10,2,4,2,'ghast_face','ghast','ghast_body','nether'],
 ['hoglin','호글린',40,.7,1.4,2,'hoglin_face','quadruped','hoglin_body','nether'],
 ['zoglin','조글린',40,.7,1.4,2.4,'zoglin_face','quadruped','zoglin_body','nether'],
 ['strider','스트라이더',20,.45,1.7,1.4,'strider_face','strider','strider_body','nether'],
 ['piglin_brute','피글린 야수',50,.35,1.95,2.8,'brute_face','humanoid','brute_body','nether'],
 ['ender_dragon','엔더 드래곤',200,3,3,6,'dragon_face','dragon','dragon_body','end'],
 ['silverfish','좀벌레',8,.2,.3,2,'silverfish_face','quadruped','silverfish_body','overworld'],
 ['endermite','엔더마이트',8,.2,.3,2,'endermite_face','quadruped','endermite_body','end']
];
NETHER_MOBS.forEach(([type,name,hp,w,h,speed,face,model,body,dimension],i)=>{MOBDEF[type]={name,hp,w,h,speed,face,model,body,dimension,passive:type==='strider',hostile:type!=='strider',flying:['ghast','ender_dragon'].includes(type),fireproof:dimension==='nether',dmg:type==='piglin_brute'?10:5,drops:type==='ghast'?[[BULK_ITEM_START+10,0,1],[BULK_ITEM_START+5,0,2]]:type==='hoglin'?[[PORK,2,4]]:[],};I(400+i,name+' 생성 알','spawn_egg_'+(i%18),{spawnMob:type});});
function spawnMob(type, x, y, z) {
  const d = MOBDEF[type];
  const m = { type, x, y, z, vx: 0, vy: 0, vz: 0, w: d.w, h: d.h, hp: d.hp, yaw: Math.random() * 6.28, bodyYaw: 0, walk: 0, wanderT: 0, moving: false, hurt: 0, panic: 0, attackCd: 0, dead: 0, burn: 0, onGround: false, color: type === 'sheep' ? Math.floor(Math.random() * 10) : 0 };
  m.bodyYaw = m.yaw; W.mobs.push(m); return m;
}
function hurtMob(m, dmg, fx, fz, explosion, kb = 1) {
  dmg*=Math.max(0,1-.2*(effectLevel(m,'resistance')+1));
  if (m.dead || m.hurt > 0.0 && !explosion) return false;
  m.hp -= dmg; m.hurt = 0.5;
  const dx = m.x - fx, dz = m.z - fz, d = Math.hypot(dx, dz) || 1;
  if (!explosion) { m.vx += dx / d * 7 * kb; m.vz += dz / d * 7 * kb; m.vy = Math.max(m.vy, 5.5 * Math.min(1, 0.4 + kb * 0.6)); }
  if (MOBDEF[m.type].passive) m.panic = 5;
  sfx(m.type === 'zombie' ? 'zhurt' : m.type === 'spider' ? 'shurt' : 'mhurt');
  if (m.hp <= 0) { m.dead = 0.001; }
  return true;
}
function isDay() { return W.daylight > 0.55; }
function updateMobs(dt) {
  const survival = G.mode === 'survival' && !P.dead;
  for (let i = W.mobs.length - 1; i >= 0; i--) {
    const m = W.mobs[i], d = MOBDEF[m.type];
    const pdx = P.x - m.x, pdz = P.z - m.z, pdist = Math.hypot(pdx, pdz), pdy = P.y - m.y;
    if (pdist > (m.type==='ender_dragon'?300:96) || m.y < YMIN-20 || (d.hostile && pdist > 72 && Math.random() < dt * 0.5)) { W.mobs.splice(i, 1); continue; }
    if(d.flying&&!m.dead){
      m.attackCd=Math.max(0,m.attackCd-dt);m.hurt=Math.max(0,m.hurt-dt);m.walk+=dt;
      const targetY=m.type==='ender_dragon'?90+Math.sin(m.walk*.4)*14:Math.max(40,Math.min(100,P.y+8));
      const angle=m.type==='ender_dragon'?m.walk*.2:Math.atan2(m.z-P.z,m.x-P.x)+.15;
      const radius=m.type==='ender_dragon'?32:18,tx=P.x+Math.cos(angle)*radius,tz=P.z+Math.sin(angle)*radius;
      const dir=[tx-m.x,targetY-m.y,tz-m.z],len=Math.hypot(...dir)||1;const nx=m.x+dir[0]/len*d.speed*dt,ny=m.y+dir[1]/len*d.speed*dt,nz=m.z+dir[2]/len*d.speed*dt;
      if(!solidAt(Math.floor(nx),Math.floor(ny+1),Math.floor(nz))){m.x=nx;m.y=ny;m.z=nz;}m.bodyYaw=Math.atan2(P.x-m.x,-(P.z-m.z));
      if(survival&&W.difficulty>0&&pdist<50&&m.attackCd<=0){m.attackCd=m.type==='ghast'?4:3;const dx=P.x-m.x,dy=P.y+1-m.y-1.5,dz=P.z-m.z,l=Math.hypot(dx,dy,dz)||1;W.arrows.push({x:m.x,y:m.y+1.5,z:m.z,vx:dx/l*14,vy:dy/l*14,vz:dz/l*14,yaw:m.bodyYaw,pitch:0,age:0,stuck:false,pick:false,enemy:true,owner:m,fireball:true,dmg:6});}continue;
    }
    if (m.dead) {
      if(m.type==='ender_dragon')G.world.dragonDefeated=true;
      m.dead += dt;
      if (m.dead > 0.9) {
        W.mobs.splice(i, 1);
        particles(m.x, m.y + m.h / 2, m.z, T.white, 14, 0.4, 2, 0.7);
        for (const [id, a, b] of d.drops) { if (id === WOOL && m.sheared) continue; const n = a + Math.floor(Math.random() * (b - a + 1)); const outId = (m.burn > 0 && d.cooked && id === d.drops[0][0]) ? d.cooked : (id === WOOL && m.color >= 8 ? COLOR_WOOL + 7 : id); spawnItem(outId, n, m.x, m.y + 0.5, m.z); }
        continue;
      }
    }
    if(m.type==='iron_golem'&&!m.dead){const enemy=W.mobs.find(e=>!e.dead&&MOBDEF[e.type].hostile&&Math.hypot(e.x-m.x,e.z-m.z)<10);if(enemy){const d=Math.hypot(enemy.x-m.x,enemy.z-m.z)||1;m.vx+=(enemy.x-m.x)/d*dt*5;m.vz+=(enemy.z-m.z)/d*dt*5;if(d<2&&m.attackCd<=0){hurtMob(enemy,12,m.x,m.z,false);m.attackCd=1;}}}
    if(m.type==='creeper'&&!m.dead){m.fuse=survival&&pdist<3?(m.fuse||0)+dt:Math.max(0,(m.fuse||0)-dt);if(m.fuse>1.5){m.dead=1;explode(m.x,m.y+0.5,m.z,3);continue;}}
    m.hurt = Math.max(0, m.hurt - dt); m.panic = Math.max(0, m.panic - dt); m.attackCd = Math.max(0, m.attackCd - dt);
    if (m.sheared) m.sheared = Math.max(0, m.sheared - dt);
    if(['skeleton','stray','piglin','blaze'].includes(m.type)&&survival&&W.difficulty>0&&!m.dead&&pdist>4&&pdist<17&&m.attackCd<=0){
      const from=[m.x,m.y+m.h*.8,m.z],delta=[pdx,P.y+1-from[1],pdz],len=Math.hypot(...delta),dir=delta.map(v=>v/len);
      if(!raycast(from,dir,len,false)){m.attackCd=2.5;W.arrows.push({x:from[0]+dir[0]*.7,y:from[1],z:from[2]+dir[2]*.7,vx:dir[0]*22,vy:dir[1]*22+len*.25,vz:dir[2]*22,yaw:m.yaw,pitch:0,age:0,stuck:false,crit:false,dmg:3,pick:false,enemy:true,owner:m});}
    }
    const hostileNow = d.hostile && !(m.type === 'spider' && isDay() && !m.angry) && survival && W.difficulty !== 0;
    let tx = 0, tz = 0, speed = 0;
    if (!m.dead && hostileNow && pdist < 18 && Math.abs(pdy) < 10) {
      tx = pdx / (pdist || 1); tz = pdz / (pdist || 1); speed = d.speed; m.yaw = Math.atan2(tx, -tz);
      if (pdist < d.w + 0.75 && pdy > -1.5 && pdy < m.h && m.attackCd <= 0) { m.attackCd = 1; damagePlayer(d.dmg, m.type, m); }
      if (m.type === 'spider' && m.onGround && pdist < 4 && pdist > 1.5 && Math.random() < dt * 2) { m.vy = 6; m.vx += tx * 4; m.vz += tz * 4; }
    } else if (!m.dead && m.panic > 0) {
      m.wanderT -= dt; if (m.wanderT <= 0) { m.yaw = Math.random() * 6.28; m.wanderT = 0.6 + Math.random(); }
      tx = Math.sin(m.yaw); tz = -Math.cos(m.yaw); speed = d.speed * 2.1;
    } else if (!m.dead) {
      m.wanderT -= dt;
      if (m.wanderT <= 0) { m.moving = Math.random() < 0.55; m.yaw += (Math.random() - 0.5) * 3; m.wanderT = 2 + Math.random() * 5; }
      if (m.moving) { tx = Math.sin(m.yaw); tz = -Math.cos(m.yaw); speed = d.speed * 0.6;
        // avoid cliffs and water while wandering
        const ax = Math.floor(m.x + tx * 0.9), az = Math.floor(m.z + tz * 0.9), fy = Math.floor(m.y);
        if (!solidAt(ax, fy - 1, az) && !solidAt(ax, fy - 2, az) && !solidAt(ax, fy, az) || isWater(getBlock(ax, fy, az))) { m.moving = false; m.yaw += 2; }
      }
    }
    speed*=Math.max(.1,1+.2*(effectLevel(m,'speed')+1)-.15*(effectLevel(m,'slowness')+1));
    const inW = entityInWater(m, m.h * 0.5);
    const acc = m.onGround ? 10 : 2;
    m.vx += (tx * speed - m.vx) * Math.min(1, acc * dt); m.vz += (tz * speed - m.vz) * Math.min(1, acc * dt);
    if(m.type==='strider'&&isLava(getBlock(Math.floor(m.x),Math.floor(m.y),Math.floor(m.z)))){let surface=Math.floor(m.y);while(surface<126&&isLava(getBlock(Math.floor(m.x),surface+1,Math.floor(m.z))))surface++;m.y=Math.min(surface+1,m.y+dt*4);m.vy=GRAVITY*dt;m.onGround=true;}
    if (inW) { m.vy = Math.min(m.vy + 22 * dt, 2.2); m.vy -= 2 * dt; } else m.vy -= GRAVITY * dt;
    m.vy = Math.max(m.vy, -60);
    const bx = moveAxis(m, 'x', m.vx * dt), bz = moveAxis(m, 'z', m.vz * dt);
    const wasGround = m.onGround; m.onGround = false;
    if (moveAxis(m, 'y', m.vy * dt)) { if (m.vy < 0) { m.onGround = true; if (!wasGround && m.vy < -15) hurtMob(m, Math.floor((-m.vy - 14) / 2.2), m.x, m.z, true); } m.vy = 0; }
    if ((bx || bz) && speed > 0) { if (m.onGround) m.vy = 8.4; else if (d.climbs) m.vy = 3.5; }
    // body follows movement direction
    const sp = Math.hypot(m.vx, m.vz);
    if (sp > 0.3) { const want = Math.atan2(m.vx, -m.vz); let dd = want - m.bodyYaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); m.bodyYaw += dd * Math.min(1, 8 * dt); }
    m.walk += sp * dt * 2.2;
    // sunlight burns zombies
    if (d.burns && !m.dead && isDay() && !inW) {
      const l = getLight(Math.floor(m.x), Math.floor(m.y + 1.6), Math.floor(m.z));
      if ((l >> 4) >= 15) { m.burn += dt; if (m.burn > 1) { m.burn = 0.01; hurtMob(m, 1, m.x, m.z, true); m.hurt = 0.2; } if (Math.random() < dt * 8) particles(m.x, m.y + 1.2, m.z, T.furnace_front_lit, 1, 0.3, 1, 0.5); }
    }
    if (!m.dead && d.hostile && Math.random() < dt * 0.06 && pdist < 16) sfx(m.type === 'zombie' ? 'groan' : 'hiss', 0.4);
    if (!m.dead && d.passive && Math.random() < dt * 0.05 && pdist < 12) sfx(m.type, 0.35);
  }
}
function spawnExtraMobs(dt){
 W.extraSpawn=(W.extraSpawn||0)-dt;if(W.extraSpawn>0)return;W.extraSpawn=5;
 const dimension=W.dimension||'overworld';
 if(dimension==='overworld'){
 const gx=Math.round((P.x-32)/192)*192+32,gz=Math.round((P.z-32)/192)*192+32,base=villageSite(gx,gz).base;
 if(Math.hypot(P.x-gx,P.z-gz)<60&&getBlock(gx+12,base+4,gz+12)===PLANKS){
  if(W.mobs.filter(m=>m.type==='villager').length<5)spawnMob('villager',gx+3,base,gz+3);
  if(!W.mobs.some(m=>m.type==='iron_golem'))spawnMob('iron_golem',gx+5,base,gz+5);
  if(!W.mobs.some(m=>m.type==='cat'))spawnMob('cat',gx+7,base,gz+5);
 }
 return;
 }
 if(dimension==='end'&&!G.world.dragonDefeated&&!W.mobs.some(m=>m.type==='ender_dragon')&&Math.hypot(P.x,P.z)<150)spawnMob('ender_dragon',0,100,0);
 if(W.mobs.length>18)return;
 const type=dimension==='end'?'enderman':['piglin','zombified_piglin','blaze','magma_cube','wither_skeleton','ghast','hoglin','strider','piglin_brute'][Math.floor(Math.random()*9)];if(MOBDEF[type].hostile&&W.difficulty===0)return;
 const a=Math.random()*6.28,x=Math.floor(P.x+Math.cos(a)*24),z=Math.floor(P.z+Math.sin(a)*24);
 for(let y=Math.min(WH-4,Math.floor(P.y)+20);y>Math.max(YMIN,Math.floor(P.y)-25);y--)if(solidAt(x,y-1,z)&&!solidAt(x,y,z)&&!solidAt(x,y+1,z)&&!isLava(getBlock(x,y,z))){spawnMob(type,x+.5,y,z+.5);break;}
}
let spawnTimer = 0;
function spawnLogic(dt) {
  if(G.world.rules?.doMobSpawning===false)return;
  spawnExtraMobs(dt);
  if(W.dimension && W.dimension!=='overworld')return;
  spawnTimer -= dt; if (spawnTimer > 0) return; spawnTimer = 1;
  let passive = 0, hostile = 0;
  for (const m of W.mobs) MOBDEF[m.type].hostile ? hostile++ : passive++;
  const tryPos = (minR, maxR) => {
    const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
    const x = Math.floor(P.x + Math.cos(a) * r), z = Math.floor(P.z + Math.sin(a) * r);
    const ch = getChunk(x >> 4, z >> 4); if (!ch || !ch.lit) return null;
    return [x, z];
  };
  if (passive < 10 && Math.random() < 0.3) {
    const p = tryPos(22, 44);
    if (p) {
      let y = WH - 2; while (y > YMIN+1 && getBlock(p[0], y, p[1]) === AIR) y--;
      if (getBlock(p[0], y, p[1]) === GRASS && (getLight(p[0], y + 1, p[1]) >> 4) > 9) {
        const types = ['pig','cow','sheep','chicken','horse','wolf'], t = types[Math.floor(Math.random() * types.length)];
        for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) { const ox = p[0] + Math.floor(Math.random() * 3) - 1, oz = p[1] + Math.floor(Math.random() * 3) - 1; if (!solidAt(ox, y + 1, oz) && solidAt(ox, y, oz)) spawnMob(t, ox + 0.5, y + 1, oz + 0.5); }
      }
    }
  }
  if (W.difficulty === 0 || hostile >= [0, 5, 8, 11][W.difficulty]) return;
  for (let tries = 0; tries < 3; tries++) {
    const p = tryPos(20, 40); if (!p) continue;
    const y0 = Math.floor(P.y);
    for (let y = Math.min(WH - 3, y0 + 14); y > Math.max(YMIN+1, y0 - 14); y--) {
      if (!solidAt(p[0], y - 1, p[1]) || solidAt(p[0], y, p[1]) || solidAt(p[0], y + 1, p[1]) || isWater(getBlock(p[0], y, p[1]))) continue;
      const l = getLight(p[0], y, p[1]), eff = Math.max(l & 15, (l >> 4) - (15 - W.skyLevel));
      if (eff <= 7 && getBlock(p[0], y - 1, p[1]) !== BEDROCK) { spawnMob(['zombie','spider','skeleton','creeper','witch','slime'][Math.floor(Math.random()*6)], p[0] + 0.5, y, p[1] + 0.5); return; }
      break;
    }
  }
}

// ── model rendering ──
function dExtraModel(m){return !!MOBDEF[m.type].model;}
function drawMobs(B, ox, oy, oz) {
  for (const m of W.mobs) {
    if(effectLevel(m,'invisibility')>=0)continue;
    const [sky, blk] = lightAt(m.x, m.y + 0.6, m.z);
    const flash = m.hurt > 0.25 || m.dead ? 1 : 0;
    const cy = Math.cos(m.bodyYaw), sy = Math.sin(m.bodyYaw);
    const roll = m.dead ? Math.min(1, m.dead * 2.5) * Math.PI / 2 : 0;
    const swing = Math.sin(m.walk * 2.8) * Math.min(1, Math.hypot(m.vx, m.vz) / 1.2) * 0.7;
    const part = (min, max, tiles, pivot, rotX, rotZ = 0) => box(B, min, max, tiles, p => {
      let [x, y, z] = p;
      if (rotX) { const dy = y - pivot[1], dz = z - pivot[2], c = Math.cos(rotX), s = Math.sin(rotX); y = pivot[1] + dy * c - dz * s; z = pivot[2] + dy * s + dz * c; }
      if (rotZ) { const dx = x - pivot[0], dy = y - pivot[1], c = Math.cos(rotZ), s = Math.sin(rotZ); x = pivot[0] + dx * c - dy * s; y = pivot[1] + dx * s + dy * c; }
      if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const nx = x * c - y * s, ny = x * s + y * c; x = nx; y = ny; }
      return [m.x - ox + x * cy - z * sy, m.y - oy + y, m.z - oz + x * sy + z * cy];
    }, sky, blk, flash);
    const six = t => [t, t, t, t, t, t];
    // Order follows the six box faces: right, left, top, bottom, back, front.
    const skin = (name, cells) => cells.map(i => T['skin_'+name+'_'+i]);
    const withFace = (t, f) => [t, t, t, t, t, f];
    const skinFaces = (name, cells) => cells.map(i => T['skin_'+name+'_'+i]);
    if(dExtraModel(m)){
      const d=MOBDEF[m.type],ft=T[d.face],body=d.body?T[d.body]:d.model==='golem'?T.golem_face:d.model==='skeleton'?T[d.face]:d.model==='enderman'?T.enderman_face:d.model==='humanoid'||d.model==='witch'?T.villager_robe:ft;
      const H=d.h,w=d.w;
      if(d.model==='ghast'){
        part([-2,1,-2],[2,4,2],withFace(body,ft),[0,0,0],0);
        for(let k=0;k<9;k++){const x=(k%3-1)*1.1,z=(Math.floor(k/3)-1)*1.1;part([x-.15,-.7,z-.15],[x+.15,1,z+.15],six(body),[x,1,z],Math.sin(m.walk+k)*.2);}
      }else if(d.model==='dragon'){
        part([-1,1,-2],[1,2.5,2],six(body),[0,0,0],0);part([-.6,1.3,-4],[.6,2.3,-2],withFace(body,ft),[0,0,0],0);
        for(let k=0;k<5;k++)part([-.4+k*.04,1.2,2+k],[.4-k*.04,1.7,3+k],six(body),[0,0,0],0);
        for(const side of [-1,1])part(side<0?[-7,1.5,-1]:[1,1.5,-1],side<0?[-1,1.65,3]:[7,1.65,3],six(body),[side,1.5,0],0,side*Math.sin(m.walk*2)*.4);
      }else if(d.model==='strider'){
        part([-.65,.7,-.65],[.65,1.7,.65],withFace(body,ft),[0,0,0],0);for(const side of [-1,1])part([side*.3-.08,0,-.08],[side*.3+.08,.7,.08],six(body),[side*.3,.7,0],side*swing);
      }else if(d.model==='slime'){part([-w,0,-w],[w,H,w],withFace(body,ft),[0,0,0],0);}
      else if(d.model==='quadruped'||d.model==='chicken'){
       part([-w,H*.4,-w],[w,H*.85,w],six(body),[0,0,0],0);
       part([-w*.6,H*.65,-w*1.8],[w*.6,H,-w*.6],withFace(body,ft),[0,0,0],0);
       for(const side of [-1,1])for(const z of [-w*.6,w*.6])part([side*w*.65-.07,0,z-.07],[side*w*.65+.07,H*.45,z+.07],six(body),[side*w*.65,H*.45,z],side*swing);
      }else if(d.model==='blaze'){
       part([-.25,1,-.25],[.25,1.5,.25],withFace(body,ft),[0,0,0],0);
       for(let k=0;k<12;k++){const a=k*Math.PI/2+m.walk,r=.45,y=.2+Math.floor(k/4)*.45;part([Math.cos(a)*r-.06,y,Math.sin(a)*r-.06],[Math.cos(a)*r+.06,y+.35,Math.sin(a)*r+.06],six(body),[0,0,0],0);}
      }else{
       const thin=d.model==='skeleton'||d.model==='enderman',lw=thin?.07:w*.35,leg=H*.43,shoulder=H*.78;
       for(const side of [-1,1])part([side*w*.5-lw,0,-lw],[side*w*.5+lw,leg,lw],six(body),[side*w*.5,leg,0],side*swing);
       part([-w,leg,-w*.5],[w,shoulder,w*.5],six(body),[0,0,0],0);
       if(d.model!=='creeper')for(const side of [-1,1])part([side*(w+.1)-lw,leg,-lw],[side*(w+.1)+lw,shoulder,lw],six(body),[side*(w+.1),shoulder,0],-side*swing);
       part([-w*.8,shoulder,-w*.8],[w*.8,H,w*.8],withFace(body,ft),[0,0,0],0);
       if(m.type==='villager'||m.type==='witch')part([-.07,H*.82,-w-0.14],[.07,H*.92,-w*.7],six(ft),[0,0,0],0);
       if(d.model==='witch')part([-.35,H,-.35],[.35,H+.22,.35],six(T.enderman_face),[0,0,0],0);
      }
    }else if (m.type === 'zombie') {
      const S = T.zombie_skin, sh = T.zombie_shirt, pa = T.zombie_pants;
      part([-0.25, 0, -0.125], [0, 0.75, 0.125], skin('zombie',[13,13,12,14,13,12]), [0, 0.75, 0], swing);
      part([0, 0, -0.125], [0.25, 0.75, 0.125], skin('zombie',[13,13,12,14,13,12]), [0, 0.75, 0], -swing);
      part([-0.25, 0.75, -0.125], [0.25, 1.5, 0.125], skin('zombie',[8,8,9,9,7,6]), [0, 0, 0], 0);
      part([-0.5, 0.75, -0.125], [-0.25, 1.5, 0.125], skin('zombie',[11,11,9,15,11,10]), [0, 1.4, 0], Math.PI / 2 + swing * 0.15);
      part([0.25, 0.75, -0.125], [0.5, 1.5, 0.125], skin('zombie',[11,11,9,15,11,10]), [0, 1.4, 0], Math.PI / 2 - swing * 0.15);
      part([-0.25, 1.5, -0.25], [0.25, 2, 0.25], skin('zombie',[3,2,4,5,1,0]), [0, 0, 0], 0);
    } else if (m.type === 'spider') {
      const S = T.spider_body;
      part([-0.42, 0.3, -0.1], [0.42, 0.85, 0.75], skin('spider',[7,6,8,9,7,6]), [0, 0, 0], 0);
      part([-0.25, 0.32, -0.55], [0.25, 0.72, -0.1], skin('spider',[3,2,4,5,1,0]), [0, 0, 0], 0);
      for (let k = 0; k < 4; k++) for (const side of [-1, 1]) {
        const z = -0.05 + k * 0.17, a = (-side * 0.5) + Math.sin(m.walk * 3 + k + (side > 0 ? 1.5 : 0)) * 0.25;
        part(side < 0 ? [-0.95, 0.48, z - 0.04] : [0.08, 0.48, z - 0.04], side < 0 ? [-0.08, 0.56, z + 0.04] : [0.95, 0.56, z + 0.04], six(S), [0, 0.52, z], 0, a);
      }
    } else {
      const big = m.type === 'cow', sheep = m.type === 'sheep';
      const woolT = m.color >= 8 ? T.wool_7 : T.wool, skin = m.type === 'pig' ? T.pig_skin : big ? T.cow_skin : woolT, face = m.type === 'pig' ? T.pig_face : big ? T.cow_face : T.sheep_face;
      const legT = m.type === 'pig' ? T.pig_skin : big ? T.cow_skin : T.sheep_face;
      const bw = big ? 0.38 : sheep ? 0.33 : 0.3, by0 = big ? 0.75 : sheep ? 0.6 : 0.38, by1 = big ? 1.3 : sheep ? 1.15 : 0.85, bl = big ? 0.6 : 0.5;
      const lh = by0, lw = big ? 0.13 : 0.12;
      if (sheep && m.sheared) part([-bw * 0.72, by0 + 0.06, -bl * 0.9], [bw * 0.72, by1 - 0.12, bl * 0.9], six(T.sheep_shorn), [0, 0, 0], 0);
      else part([-bw, by0, -bl], [bw, by1, bl], sheep && m.color >= 8 ? six(woolT) : skinFaces(m.type,[7,6,8,9,7,6]), [0, 0, 0], 0);
      for (const [lx, lz, s] of [[-1, -1, 1], [1, -1, -1], [-1, 1, -1], [1, 1, 1]]) {
        const cx = lx * (bw - lw), cz = lz * (bl - lw - 0.04);
        part([cx - lw, 0, cz - lw], [cx + lw, lh, cz + lw], skinFaces(m.type,[10,10,12,13,10,11]), [cx, lh, cz], swing * s);
      }
      const hs = big ? 0.3 : 0.25, hy = big ? 1.05 : sheep ? 0.95 : 0.5;
      part([-hs, hy, -bl - hs * 1.6], [hs, hy + hs * 2, -bl + hs * 0.3], skinFaces(m.type,[3,2,4,5,1,0]), [0, 0, 0], 0);
      if (!sheep) part([-hs*.58, hy+hs*.18, -bl-hs*1.9], [hs*.58, hy+hs*.9, -bl-hs*1.59], skinFaces(m.type,[15,15,15,15,15,14]), [0,0,0], 0);
    }
  }
}
function drawItems(B, ox, oy, oz) {
  for (const e of W.items) {
    const [sky, blk] = lightAt(e.x, e.y + 0.2, e.z);
    const bob = Math.sin(e.age * 2.5) * 0.06 + 0.08, rot = e.age * 1.8;
    const c = Math.cos(rot), s = Math.sin(rot);
    const b = e.id < 256 ? BLOCK[e.id] : null;
    const copies = e.count > 16 ? 3 : e.count > 1 ? 2 : 1;
    for (let k = 0; k < copies; k++) {
      const offx = k * 0.07, offy = k * 0.05;
      if (isCubeItem(e.id)) {
        const hs = 0.125, hy = hs * 2 * (b.height || 1);
        box(B, [-hs, 0, -hs], [hs, hy, hs], blockTiles(e.id), p => [e.x - ox + offx + p[0] * c - p[2] * s, e.y - oy + bob + offy + p[1], e.z - oz + p[0] * s + p[2] * c], sky, blk);
      } else {
        // extruded 3D sprite, 0.4 blocks wide, spinning around its vertical axis
        drawItemMesh(B, itemTileIdle(e.id), p => { const x = (p[0] - 0.5) * 0.4, y = p[1] * 0.4, z = (p[2] - 0.5) * 0.4; return [e.x - ox + offx + x * c - z * s, e.y - oy + bob + offy + y, e.z - oz + x * s + z * c]; }, sky, blk, 0.95);
      }
    }
  }
  for (const a of W.arrows) {
    if(a.fireball){const t=T.magma;box(B,[-.25,-.25,-.25],[.25,.25,.25],Array(6).fill(t),p=>[a.x-ox+p[0],a.y-oy+p[1],a.z-oz+p[2]],1,1);continue;}
    const [sky, blk] = lightAt(a.x, a.y, a.z), cy = Math.cos(a.yaw), sy = Math.sin(a.yaw), cp = Math.cos(a.pitch), sp = Math.sin(a.pitch);
    const F = [sy * cp, sp, -cy * cp], R = [cy, 0, sy], Up = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]], t = T.arrow_shaft;
    box(B, [-0.035, -0.035, -0.5], [0.035, 0.035, 0], [t, t, t, t, t, t], p => [a.x - ox + R[0] * p[0] + Up[0] * p[1] - F[0] * p[2], a.y - oy + R[1] * p[0] + Up[1] * p[1] - F[1] * p[2], a.z - oz + R[2] * p[0] + Up[2] * p[1] - F[2] * p[2]], sky, blk);
  }
  for (const t of W.tnts) {
    const [sky, blk] = lightAt(t.x, t.y + 0.5, t.z);
    const flashOn = Math.floor(t.fuse * 4) % 2 === 0;
    const grow = t.fuse < 0.4 ? 1 + (0.4 - t.fuse) * 0.4 : 1;
    box(B, [-0.5 * grow, 0, -0.5 * grow], [0.5 * grow, grow, 0.5 * grow], blockTiles(TNT), p => [t.x - ox + p[0], t.y - oy + p[1], t.z - oz + p[2]], sky, blk, 0, flashOn ? 2.2 : 1);
  }
}
function drawParticles(B, ox, oy, oz, right, up) {
  for (const p of W.particles) {
    const [sky, blk] = p.grav < 0 || p.glow ? [1, 0] : lightAt(p.x, p.y, p.z);
    const s = p.size, rx = right[0] * s, ry = right[1] * s, rz = right[2] * s, ux = up[0] * s, uy = up[1] * s, uz = up[2] * s;
    const x = p.x - ox, y = p.y - oy, z = p.z - oz;
    const q = [[x - rx - ux, y - ry - uy, z - rz - uz], [x + rx - ux, y + ry - uy, z + rz - uz], [x + rx + ux, y + ry + uy, z + rz + uz], [x - rx + ux, y - ry + uy, z - rz + uz]];
    const d = p.full ? 1 : 3 / 16, uv = [uvOf(p.tile, 0, 1, p.su, p.sv, p.su + d, p.sv + d), uvOf(p.tile, 1, 1, p.su, p.sv, p.su + d, p.sv + d), uvOf(p.tile, 1, 0, p.su, p.sv, p.su + d, p.sv + d), uvOf(p.tile, 0, 0, p.su, p.sv, p.su + d, p.sv + d)];
    B.quad(q, uv, sky, blk, p.grav < 0 ? Math.min(1, p.life) * 0.9 : 0.9);
  }
}
