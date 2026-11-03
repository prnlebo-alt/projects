'use strict';
/* Scripted REAL-pointer test: dispatches synthetic pointerdown/move/up through
 * the game's own cv.addEventListener handlers (same code path as a real
 * touch/mouse drag), not by poking internal state. Drives level 1 (plain
 * direct hit) and level 8 (the designated tower-collapse level) to a win. */
const path = require('path');
const {build} = require('./harness.js');

function drag(h, from, to, steps) {
  const cv = h.els.c;
  cv.dispatch('pointerdown', {pointerId: 1, clientX: from.x, clientY: from.y});
  for (let i = 1; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * (i / steps), y = from.y + (to.y - from.y) * (i / steps);
    cv.dispatch('pointermove', {pointerId: 1, clientX: x, clientY: y});
  }
  cv.dispatch('pointerup', {pointerId: 1, clientX: to.x, clientY: to.y, type: 'pointerup'});
}

function runUntilResolved(h, maxTicks) {
  for (let i = 0; i < maxTicks; i++) {
    h.run('update(1/120);');
    const s = h.get('S');
    if (s.state === 'won' || s.state === 'lost') return s.state;
  }
  return 'timeout';
}

// Between shots, wait for the ball to resolve (+ a settle margin) rather than
// running a long fixed loop: level 8's first bin moves, so over-advancing
// time here would desync the next shot's aim from the bin's actual position.
function waitForNextShot(h, settleTicks) {
  for (let i = 0; i < 1200; i++) { h.run('update(1/120);'); if (!h.get('S.ball')) break; }
  for (let i = 0; i < settleTicks; i++) h.run('update(1/120);');
}

function testLevel1() {
  const h = build(path.join(__dirname, '..', 'index.html'));
  h.run("scene = 'play'; loadLevel(0);");
  // anchor is (130,300); el=24deg, t=0.7 (re-found after the Pull constants retune)
  const anchor = h.get('pull.anchor');
  const elRad = 24 * Math.PI / 180, pullPx = 0.7 * h.get('pull.maxPull');
  const handle = {x: anchor.x - Math.cos(elRad) * pullPx, y: anchor.y + Math.sin(elRad) * pullPx};
  drag(h, anchor, handle, 12);
  const state = runUntilResolved(h, 1200);
  const dumps = h.get('S.dumps');
  return {level: 1, state, filled: dumps.every(d => d.filled), usedBags: h.get('S.used')};
}

function testLevel8Win() {
  const h = build(path.join(__dirname, '..', 'index.html'));
  h.run("scene = 'play'; loadLevel(7);");
  const anchor = h.get('pull.anchor');
  const maxPull = h.get('pull.maxPull');
  // shot 1: el=6,t=.7 -> direct hit on the static bin next to the tower (re-found after the Pull constants retune)
  let elRad = 6 * Math.PI / 180, pullPx = 0.7 * maxPull;
  let handle = {x: anchor.x - Math.cos(elRad) * pullPx, y: anchor.y + Math.sin(elRad) * pullPx};
  drag(h, anchor, handle, 12);
  waitForNextShot(h, 120);
  // shot 2: el=6,t=.8 -> direct hit on the remaining (moving) bin
  elRad = 6 * Math.PI / 180; pullPx = 0.8 * maxPull;
  handle = {x: anchor.x - Math.cos(elRad) * pullPx, y: anchor.y + Math.sin(elRad) * pullPx};
  drag(h, anchor, handle, 12);
  const state = runUntilResolved(h, 1200);
  const dumps = h.get('S.dumps');
  return {level: 8, state, filled: dumps.every(d => d.filled), usedBags: h.get('S.used')};
}

function testAbilitySplit() {
  // Real pointer drag + a real mid-flight tap (same cv pointerdown handler a
  // touch would hit) to trigger the bag-split ability on level 1's bag.
  // Shot re-found (el10/t0.75) after the Pull constants retune.
  const h = build(path.join(__dirname, '..', 'index.html'));
  h.run("scene = 'play'; loadLevel(0);");
  const anchor = h.get('pull.anchor');
  const elRad = 10 * Math.PI / 180, pullPx = 0.75 * h.get('pull.maxPull');
  const handle = {x: anchor.x - Math.cos(elRad) * pullPx, y: anchor.y + Math.sin(elRad) * pullPx};
  drag(h, anchor, handle, 12);
  for (let i = 0; i < 10; i++) h.run('update(1/120);'); // let the bag get airborne before tapping
  const preTapBalls = h.get('S.balls').length, preTapType = h.get('S.balls')[0].type;
  h.els.c.dispatch('pointerdown', {pointerId: 2, clientX: anchor.x, clientY: anchor.y});
  const postTapBalls = h.get('S.balls');
  const splitOccurred = preTapBalls === 1 && preTapType === 'bag' && postTapBalls.length === 3 && postTapBalls.every(b => b.type === 'bag' && b.tapped);
  const state = runUntilResolved(h, 1200);
  const dumps = h.get('S.dumps');
  return {ability: 'bag-split', splitOccurred, state, filled: dumps.every(d => d.filled), usedBags: h.get('S.used')};
}

function testCollapseMechanismDirectly() {
  // Confirms the collapse-onto-bin scoring path specifically (not just a direct hit):
  // a real pointer-driven shot that knocks the level-8 tower into bin2.
  const h = build(path.join(__dirname, '..', 'index.html'));
  h.run("scene = 'play'; loadLevel(7);");
  h.run('globalThis.__collapseLog = []; const __orig = scoreDump; scoreDump = function(d,x,y){ __collapseLog.push({bx:d.bx}); return __orig(d,x,y); };');
  const anchor = h.get('pull.anchor');
  const elRad = 6 * Math.PI / 180, pullPx = 1.0 * h.get('pull.maxPull');
  const handle = {x: anchor.x - Math.cos(elRad) * pullPx, y: anchor.y + Math.sin(elRad) * pullPx};
  drag(h, anchor, handle, 12);
  runUntilResolved(h, 1300);
  return {collapseLog: h.get('__collapseLog'), bin2filled: h.get('S.dumps')[1].filled};
}

const r1 = testLevel1();
console.log('Level 1 (direct hit, real pointer drag):', JSON.stringify(r1));
const r8 = testLevel8Win();
console.log('Level 8 (two real pointer drags):', JSON.stringify(r8));
const rc = testCollapseMechanismDirectly();
console.log('Level 8 collapse-mechanism check (real pointer drag aimed at the tower):', JSON.stringify(rc));
const ra = testAbilitySplit();
console.log('Ability check (real mid-flight tap splits a bag into 3, real pointer drag):', JSON.stringify(ra));

const ok1 = r1.state === 'won' && r1.filled;
const ok8 = r8.state === 'won' && r8.filled;
const okc = rc.collapseLog.length > 0 && rc.bin2filled;
const oka = ra.splitOccurred && ra.state === 'won' && ra.filled;
console.log('\nlevel1 win:', ok1, '| level8 win:', ok8, '| collapse-onto-bin mechanism fired:', okc, '| bag-split ability fired + level 1 still won:', oka);
process.exit(ok1 && ok8 && okc && oka ? 0 : 1);
