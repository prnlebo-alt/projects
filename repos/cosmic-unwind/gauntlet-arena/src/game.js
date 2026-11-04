(function(){
'use strict';
if(!window.THREE){document.body.innerHTML='<div style="padding:30px;color:white;font-family:sans-serif">Three.js failed to load.</div>';throw new Error('THREE_MISSING');}
var T=window.THREE;
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
var TAU=Math.PI*2;
var CONFIG={arenaX:15,arenaZ:12,eyeY:1.65,speed:7.2,mag:12,reloadMs:1050,shotGap:150,enemyHp:60,enemyDamage:10,enemyFireMin:1.15,enemyFireMax:1.75,boltSpeed:8.2};
var state={gameState:'READY',health:100,ammo:12,reloading:false,yaw:0,pitch:0,kills:0,shots:0,hits:0,damageEvents:0,hitEvents:0,deathEvents:0,muzzleEvents:0,reloadEvents:0,startedAt:0,lastShot:0,lastDamageAt:0,lastHitAt:0,fpsSamples:[],frameSamples:[],pointerLocked:false};
var keys={},enemies=[],bolts=[],effects=[];
var scene=new T.Scene(); scene.fog=new T.FogExp2(0x050817,0.028);
var camera=new T.PerspectiveCamera(76,innerWidth/innerHeight,.08,80); camera.position.set(0,CONFIG.eyeY,8.8); scene.add(camera);
var RENDER_SCALE=.32;var renderer=new T.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'}); renderer.setPixelRatio(1); renderer.setSize(Math.ceil(innerWidth*RENDER_SCALE),Math.ceil(innerHeight*RENDER_SCALE),false); renderer.setClearColor(0x030610,1); document.getElementById('render-root').appendChild(renderer.domElement);
var clock=new T.Clock();
var raycaster=new T.Raycaster();
var center=new T.Vector2(0,0);
var tempV=new T.Vector3();
var ui={health:document.getElementById('health-value'),healthFill:document.getElementById('health-fill'),ammo:document.getElementById('ammo-value'),hostiles:document.getElementById('hostile-value'),status:document.getElementById('status-text'),reticle:document.getElementById('reticle'),hitmarker:document.getElementById('hitmarker'),damage:document.getElementById('damage-vignette'),muzzle:document.getElementById('muzzle-flash'),start:document.getElementById('start-card'),end:document.getElementById('end-card'),endTitle:document.getElementById('end-title'),endKicker:document.getElementById('end-kicker'),endCopy:document.getElementById('end-copy'),endStats:document.getElementById('end-stats')};

function mat(color,emissive,shininess,transparent,opacity){return new T.MeshPhongMaterial({color:color,emissive:emissive||0x000000,shininess:shininess==null?55:shininess,transparent:!!transparent,opacity:opacity==null?1:opacity});}
function basic(color,transparent,opacity){return new T.MeshBasicMaterial({color:color,transparent:!!transparent,opacity:opacity==null?1:opacity,blending:transparent?T.AdditiveBlending:T.NormalBlending,depthWrite:!transparent});}
function box(w,h,d,m,x,y,z){var o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x||0,y||0,z||0);scene.add(o);return o;}
function addEdgeStrips(){
  var cyan=basic(0x1bd9ff,true,.55), mag=basic(0xff3ed0,true,.34), orange=basic(0xff9b42,true,.34);
  var i,x,z;
  for(i=-12;i<=12;i+=4){box(2.3,.018,.035,cyan,i,.035,-11.75);box(2.3,.018,.035,cyan,i,.035,11.75);}
  for(i=-9;i<=9;i+=3){box(.035,.018,1.7,mag,-14.75,.036,i);box(.035,.018,1.7,mag,14.75,.036,i);}
  for(x=-12;x<=12;x+=6)for(z=-9;z<=9;z+=6){var p=box(.55,.025,.06,orange,x,.04,z);p.rotation.y=(x+z)%12?0:Math.PI/2;}
}
function buildArena(){
  scene.add(new T.AmbientLight(0x26335d,.55));
  var key=new T.DirectionalLight(0x8bdcff,.65);key.position.set(5,11,7);scene.add(key);
  var magL=new T.PointLight(0xff3dd4,1.1,22);magL.position.set(-10,4,-6);scene.add(magL);
  var cyanL=new T.PointLight(0x19d8ff,1.2,25);cyanL.position.set(9,3,1);scene.add(cyanL);
  var floorMat=mat(0x091123,0x020916,40);box(30,.18,24,floorMat,0,-.1,0);
  var wallMat=mat(0x0b1121,0x02030a,28);box(30,6,.35,wallMat,0,3,-12);box(30,6,.35,wallMat,0,3,12);box(.35,6,24,wallMat,-15,3,0);box(.35,6,24,wallMat,15,3,0);
  var ceilMat=mat(0x070b17,0x010208,14);box(30,.18,24,ceilMat,0,6.05,0);
  addEdgeStrips();
  var ribMat=mat(0x121a30,0x030711,65), emissiveC=mat(0x17304a,0x0b7d9b,90), emissiveM=mat(0x351736,0x97116f,90);
  [-12,-6,0,6,12].forEach(function(x){box(.34,5.1,.5,ribMat,x,2.65,-11.55);box(.34,5.1,.5,ribMat,x,2.65,11.55);box(.1,3.8,.58,x===0?emissiveM:emissiveC,x,2.65,-11.25);});
  [-10,10].forEach(function(x){[-7,7].forEach(function(z){var core=box(1.45,2.6,1.45,ribMat,x,1.3,z);var cap=box(1.62,.16,1.62,emissiveC,x,2.65,z);cap.rotation.y=Math.PI/4;var foot=box(1.7,.15,1.7,emissiveM,x,.12,z);foot.rotation.y=Math.PI/4;});});
  var reactor=new T.Group();
  var base=new T.Mesh(new T.CylinderGeometry(2.25,2.6,.7,8),ribMat);base.position.y=.35;reactor.add(base);
  var ring1=new T.Mesh(new T.TorusGeometry(1.5,.08,8,32),basic(0x22e5ff,true,.7));ring1.position.y=1.65;ring1.rotation.x=Math.PI/2;reactor.add(ring1);
  var ring2=new T.Mesh(new T.TorusGeometry(1.05,.055,8,28),basic(0xff43d6,true,.48));ring2.position.y=1.65;ring2.rotation.x=Math.PI/2;reactor.add(ring2);
  var crystal=new T.Mesh(new T.OctahedronGeometry(.65,1),mat(0x6eeeff,0x0c9fc7,100,true,.8));crystal.position.y=1.65;reactor.add(crystal);reactor.position.set(0,0,-3.2);scene.add(reactor);effects.push({type:'reactor',group:reactor,ring1:ring1,ring2:ring2,crystal:crystal});
  var beamGeo=new T.CylinderGeometry(.035,.035,5.6,6),beamMat=basic(0x52efff,true,.18);[-8,8].forEach(function(x){var b=new T.Mesh(beamGeo,beamMat);b.position.set(x,3,-11.65);scene.add(b);});
  for(var gx=-12;gx<=12;gx+=3){var line=box(.018,.02,21.5,basic(0x11364b,true,.16),gx,.02,0);}
  for(var gz=-9;gz<=9;gz+=3){box(27.5,.021,.018,basic(0x11364b,true,.13),0,.021,gz);}
}

function droneMesh(index){
  var g=new T.Group();
  var shell=mat(0x283651,0x020617,92), dark=mat(0x10182a,0x01030a,58), glow=mat(index===1?0xff5ad9:0x4eeeff,index===1?0xb31783:0x0b83a7,100);
  var body=new T.Mesh(new T.OctahedronGeometry(.78,1),shell);body.scale.y=.62;g.add(body);
  var core=new T.Mesh(new T.SphereGeometry(.33,14,10),glow);core.position.z=.48;g.add(core);
  var ring=new T.Mesh(new T.TorusGeometry(.95,.065,6,24),basic(index===1?0xff4fd5:0x39e7ff,true,.72));ring.rotation.x=Math.PI/2;g.add(ring);
  var wingGeo=new T.BoxGeometry(.75,.16,.48);var lw=new T.Mesh(wingGeo,dark);lw.position.x=-.92;lw.rotation.z=.25;g.add(lw);var rw=lw.clone();rw.position.x=.92;rw.rotation.z=-.25;g.add(rw);
  var eye=new T.Mesh(new T.SphereGeometry(.12,10,8),basic(0xff764c,true,.95));eye.position.set(0,.05,.77);g.add(eye);
  g.traverse(function(o){if(o instanceof T.Mesh)o.userData.enemyRoot=g;});
  return g;
}
function spawnEnemies(){
  enemies.forEach(function(e){scene.remove(e.mesh);});enemies=[];
  var starts=[[-7,2.2,-6],[6.2,2.5,-7.5],[8,2.05,4.3]];
  starts.forEach(function(p,i){var mesh=droneMesh(i);mesh.position.set(p[0],p[1],p[2]);scene.add(mesh);enemies.push({id:i,mesh:mesh,hp:CONFIG.enemyHp,alive:true,phase:i*2.1,orbit:1.6+i*.25,nextFire:.8+i*.55,lastFire:0,spawn:new T.Vector3(p[0],p[1],p[2]),lastDeathEffect:false});});
}
function clearBolts(){bolts.forEach(function(b){scene.remove(b.mesh);});bolts=[];}
function updateCamera(){camera.rotation.order='YXZ';camera.rotation.y=state.yaw;camera.rotation.x=state.pitch;}
function startGame(){if(state.gameState==='PLAYING')return;document.body.classList.add('playing');ui.start.classList.add('hidden');ui.end.classList.add('hidden');state.gameState='PLAYING';state.startedAt=performance.now();if(renderer.domElement.requestPointerLock)renderer.domElement.requestPointerLock();updateHud();}
function resetGame(autoLock){
  clearBolts();spawnEnemies();camera.position.set(0,CONFIG.eyeY,8.8);state.health=100;state.ammo=CONFIG.mag;state.reloading=false;state.yaw=0;state.pitch=0;state.kills=0;state.shots=0;state.hits=0;state.damageEvents=0;state.hitEvents=0;state.deathEvents=0;state.muzzleEvents=0;state.reloadEvents=0;state.lastShot=0;state.lastDamageAt=0;state.lastHitAt=0;state.gameState='PLAYING';state.startedAt=performance.now();document.body.classList.add('playing');document.body.classList.remove('critical');ui.end.classList.add('hidden');ui.start.classList.add('hidden');updateCamera();updateHud();if(autoLock&&renderer.domElement.requestPointerLock)renderer.domElement.requestPointerLock();
}
function finish(win){
  if(state.gameState!=='PLAYING')return;state.gameState=win?'WIN':'LOSE';state.reloading=false;keys={};if(document.exitPointerLock)document.exitPointerLock();ui.end.classList.remove('hidden');ui.endTitle.textContent=win?'SECTOR SECURED':'SIMULATION FAILED';ui.endKicker.textContent=win?'ENCOUNTER COMPLETE':'BIOSIGNAL LOST';ui.endCopy.textContent=win?'All hostile signals have been neutralized.':'The drone swarm overwhelmed your combat frame.';var sec=Math.max(1,Math.round((performance.now()-state.startedAt)/1000));ui.endStats.textContent='KILLS '+state.kills+' · HITS '+state.hits+' · TIME '+sec+'S';updateHud();
}
function damagePlayer(amount){if(state.gameState!=='PLAYING')return;state.health=clamp(state.health-amount,0,100);state.damageEvents++;state.lastDamageAt=performance.now();ui.damage.classList.remove('show');void ui.damage.offsetWidth;ui.damage.classList.add('show');setTimeout(function(){ui.damage.classList.remove('show');},180);if(state.health<=25)document.body.classList.add('critical');updateHud();if(state.health<=0)finish(false);}
function showHit(){state.hitEvents++;state.lastHitAt=performance.now();ui.hitmarker.classList.add('show');setTimeout(function(){ui.hitmarker.classList.remove('show');},105);}
function flashMuzzle(){state.muzzleEvents++;ui.muzzle.classList.remove('show');void ui.muzzle.offsetWidth;ui.muzzle.classList.add('show');ui.reticle.classList.add('kick');setTimeout(function(){ui.reticle.classList.remove('kick');},75);}
function spawnDeathFx(pos){state.deathEvents++;for(var i=0;i<7;i++){var m=new T.Mesh(new T.OctahedronGeometry(.07+Math.random()*.07,0),basic(i%2?0x48eaff:0xff53d7,true,.9));m.position.copy(pos);scene.add(m);effects.push({type:'spark',mesh:m,life:.45+Math.random()*.3,vel:new T.Vector3((Math.random()-.5)*4,Math.random()*3,(Math.random()-.5)*4)});}}
function killEnemy(e){if(!e.alive)return;e.alive=false;state.kills++;e.mesh.visible=false;spawnDeathFx(e.mesh.position.clone());updateHud();if(enemies.every(function(x){return !x.alive;}))setTimeout(function(){finish(true);},220);}
function fire(){
  var now=performance.now();if(state.gameState!=='PLAYING'||state.reloading||now-state.lastShot<CONFIG.shotGap)return;if(state.ammo<=0){reload();return;}state.lastShot=now;state.ammo--;state.shots++;flashMuzzle();
  raycaster.setFromCamera(center,camera);var targets=[];enemies.forEach(function(e){if(e.alive)e.mesh.traverse(function(o){if(o instanceof T.Mesh)targets.push(o);});});var hits=raycaster.intersectObjects(targets,false);if(hits.length){var root=hits[0].object.userData.enemyRoot;var enemy=null;for(var i=0;i<enemies.length;i++)if(enemies[i].mesh===root)enemy=enemies[i];if(enemy&&enemy.alive){enemy.hp-=30;state.hits++;showHit();enemy.mesh.scale.set(1.11,1.11,1.11);setTimeout(function(){if(enemy.alive)enemy.mesh.scale.set(1,1,1);},70);if(enemy.hp<=0)killEnemy(enemy);}}
  updateHud();
}
function reload(){if(state.gameState!=='PLAYING'||state.reloading||state.ammo>=CONFIG.mag)return;state.reloading=true;state.reloadEvents++;updateHud();var token=state.reloadEvents;setTimeout(function(){if(state.gameState==='PLAYING'&&state.reloading&&token===state.reloadEvents){state.ammo=CONFIG.mag;state.reloading=false;updateHud();}},CONFIG.reloadMs);}
function enemyFire(e){
  if(!e.alive||state.gameState!=='PLAYING')return;var dir=camera.position.clone().sub(e.mesh.position).normalize();var mesh=new T.Mesh(new T.SphereGeometry(.11,8,6),basic(0xff4f7d,true,.95));mesh.position.copy(e.mesh.position);scene.add(mesh);bolts.push({mesh:mesh,vel:dir.multiplyScalar(CONFIG.boltSpeed),life:4});
}
function updateEnemies(dt,t){
  enemies.forEach(function(e){if(!e.alive)return;var s=e.spawn;e.mesh.position.x=s.x+Math.sin(t*.75+e.phase)*e.orbit;e.mesh.position.z=s.z+Math.cos(t*.58+e.phase)*e.orbit*.72;e.mesh.position.y=s.y+Math.sin(t*1.8+e.phase)*.36;e.mesh.rotation.y=Math.atan2(camera.position.x-e.mesh.position.x,camera.position.z-e.mesh.position.z);e.mesh.rotation.z=Math.sin(t*1.4+e.phase)*.08;var ring=e.mesh.children[2];if(ring)ring.rotation.z+=dt*1.8;if(t>e.nextFire){enemyFire(e);e.lastFire=t;e.nextFire=t+CONFIG.enemyFireMin+Math.random()*(CONFIG.enemyFireMax-CONFIG.enemyFireMin);}});
}
function updateBolts(dt){for(var i=bolts.length-1;i>=0;i--){var b=bolts[i];b.mesh.position.add(b.vel.clone().multiplyScalar(dt));b.life-=dt;var dx=b.mesh.position.x-camera.position.x,dz=b.mesh.position.z-camera.position.z,dy=b.mesh.position.y-CONFIG.eyeY;if(state.gameState==='PLAYING'&&dx*dx+dz*dz+dy*dy<.42){damagePlayer(CONFIG.enemyDamage);scene.remove(b.mesh);bolts.splice(i,1);continue;}if(b.life<=0||Math.abs(b.mesh.position.x)>17||Math.abs(b.mesh.position.z)>14){scene.remove(b.mesh);bolts.splice(i,1);}}
}
function updateEffects(dt,t){for(var i=effects.length-1;i>=0;i--){var e=effects[i];if(e.type==='reactor'){e.ring1.rotation.z=t*.5;e.ring2.rotation.z=-t*.75;e.crystal.rotation.y=t*.8;e.crystal.rotation.z=t*.34;e.crystal.position.y=1.65+Math.sin(t*1.7)*.09;continue;}if(e.type==='spark'){e.life-=dt;e.mesh.position.add(e.vel.clone().multiplyScalar(dt));e.vel.y-=dt*3;e.mesh.rotation.x+=dt*5;e.mesh.rotation.y+=dt*7;e.mesh.material.opacity=clamp(e.life*2,0,1);if(e.life<=0){scene.remove(e.mesh);effects.splice(i,1);}}}}
function updatePlayer(dt){if(state.gameState!=='PLAYING')return;var f=(keys.KeyW?1:0)-(keys.KeyS?1:0),r=(keys.KeyD?1:0)-(keys.KeyA?1:0);if(!f&&!r)return;var len=Math.sqrt(f*f+r*r);f/=len;r/=len;var sy=Math.sin(state.yaw),cy=Math.cos(state.yaw);var dx=(r*cy-f*sy)*CONFIG.speed*dt;var dz=(-r*sy-f*cy)*CONFIG.speed*dt;camera.position.x=clamp(camera.position.x+dx,-13.5,13.5);camera.position.z=clamp(camera.position.z+dz,-10.5,10.5);}
function updateHud(){var alive=enemies.filter(function(e){return e.alive;}).length;ui.health.textContent=String(Math.round(state.health));ui.healthFill.style.width=state.health+'%';ui.ammo.textContent=(state.reloading?'--':state.ammo)+' / '+CONFIG.mag;ui.hostiles.textContent=String(alive);if(state.gameState==='WIN')ui.status.textContent='SECTOR SECURED';else if(state.gameState==='LOSE')ui.status.textContent='BIOSIGNAL LOST';else if(state.reloading)ui.status.textContent='CELL RECHARGING';else if(state.gameState==='PLAYING')ui.status.textContent=alive===1?'LAST HOSTILE':'LOCKDOWN ACTIVE';else ui.status.textContent='STANDBY';}
function onMouseMove(e){if(document.pointerLockElement!==renderer.domElement||state.gameState!=='PLAYING')return;state.yaw-=e.movementX*.0022;state.pitch=clamp(state.pitch-e.movementY*.0022,-1.35,1.35);updateCamera();}
window.addEventListener('keydown',function(e){keys[e.code]=true;if(e.code==='KeyR'){if(state.gameState==='WIN'||state.gameState==='LOSE')resetGame(true);else reload();}if((e.code==='Enter'||e.code==='Space')&&state.gameState==='READY')startGame();});window.addEventListener('keyup',function(e){keys[e.code]=false;});window.addEventListener('mousemove',onMouseMove);window.addEventListener('mousedown',function(e){if(e.button!==0)return;if(state.gameState==='READY'){startGame();return;}if(state.gameState==='PLAYING'){if(document.pointerLockElement!==renderer.domElement&&renderer.domElement.requestPointerLock){renderer.domElement.requestPointerLock();return;}fire();}});
document.addEventListener('pointerlockchange',function(){state.pointerLocked=document.pointerLockElement===renderer.domElement;});
document.getElementById('start-button').addEventListener('click',function(e){e.stopPropagation();startGame();});document.getElementById('restart-button').addEventListener('click',function(e){e.stopPropagation();resetGame(true);});
window.addEventListener('resize',function(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(Math.ceil(innerWidth*RENDER_SCALE),Math.ceil(innerHeight*RENDER_SCALE),false);});

buildArena();spawnEnemies();updateCamera();updateHud();
var lastFrame=performance.now(),fpsBucketTime=lastFrame,fpsBucketFrames=0;
function loop(){requestAnimationFrame(loop);var now=performance.now(),raw=(now-lastFrame)/1000;lastFrame=now;var dt=Math.min(raw,.05),t=now/1000;state.frameSamples.push(raw*1000);if(state.frameSamples.length>900)state.frameSamples.shift();fpsBucketFrames++;if(now-fpsBucketTime>=1000){state.fpsSamples.push(fpsBucketFrames*1000/(now-fpsBucketTime));if(state.fpsSamples.length>30)state.fpsSamples.shift();fpsBucketFrames=0;fpsBucketTime=now;}updatePlayer(dt);updateEnemies(dt,t);updateBolts(dt);updateEffects(dt,t);renderer.render(scene,camera);}loop();

window.__gauntlet={snapshot:function(){return {gameState:state.gameState,health:state.health,ammo:state.ammo,reloading:state.reloading,yaw:state.yaw,pitch:state.pitch,kills:state.kills,shots:state.shots,hits:state.hits,damageEvents:state.damageEvents,hitEvents:state.hitEvents,deathEvents:state.deathEvents,muzzleEvents:state.muzzleEvents,reloadEvents:state.reloadEvents,lastDamageAt:state.lastDamageAt,lastHitAt:state.lastHitAt,pointerLocked:state.pointerLocked,player:{x:camera.position.x,y:camera.position.y,z:camera.position.z},alive:enemies.filter(function(e){return e.alive;}).length,enemies:enemies.map(function(e){return{id:e.id,alive:e.alive,hp:e.hp,x:e.mesh.position.x,y:e.mesh.position.y,z:e.mesh.position.z};}),bolts:bolts.length,frameSamples:state.frameSamples.slice(),fpsSamples:state.fpsSamples.slice(),hud:{health:ui.health.textContent,ammo:ui.ammo.textContent,hostiles:ui.hostiles.textContent,status:ui.status.textContent},effects:{hitVisible:ui.hitmarker.classList.contains('show'),damageVisible:ui.damage.classList.contains('show'),muzzleVisible:ui.muzzle.classList.contains('show')},bounds:{x:CONFIG.arenaX,z:CONFIG.arenaZ}};},version:'gauntlet-arena-1.0'};
})();
