import test from 'node:test';
import assert from 'node:assert/strict';
import { Energy, mapCameraPoint, closestOnSegment } from '../src/physics.ts';

test('camera coordinates mirror and align with letterboxed video', () => {
  const corner = mapCameraPoint({x:0,y:0}, 640,480,1000,500);
  assert.ok(Math.abs(corner.x - 833.3333333333334) < 1e-9 && Math.abs(corner.y) < 1e-9);
  const middle = mapCameraPoint({x:.5,y:.5},640,480,1000,500);
  assert.equal(middle.x,500); assert.equal(middle.y,250);
  const portrait = mapCameraPoint({x:.5,y:.5},640,480,400,800);
  assert.deepEqual(portrait,{x:200,y:400});
});
test('swept contact catches a fast movement through the material', () => {
  assert.deepEqual(closestOnSegment({x:500,y:300},{x:200,y:300},{x:800,y:300}),{x:500,y:300});
  const energy = new Energy(); energy.resize(1000,600); energy.flow=0;
  const before = energy.particles.reduce((s,p)=>s+p.x,0)/18;
  energy.step(1/30,[{x:800,y:300,px:200,py:300,vx:1600,vy:0,radius:30}]);
  assert.ok(energy.particles.reduce((s,p)=>s+p.x,0)/18 > before);
});
test('long-running simulation stays finite and within the field', () => {
  const energy = new Energy(); energy.resize(800,600); energy.flow=2; energy.strength=2;
  for(let i=0;i<7200;i++) energy.step(1/60, i<300 ? [{x:450,y:300,px:300,py:300,vx:1800,vy:1200,radius:65}] : []);
  for (const p of energy.particles) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.vx));
    assert.ok(p.x >= 0 && p.x <= 800 && p.y >= 0 && p.y <= 600);
  }
  const cx = energy.particles.reduce((s,p)=>s+p.x,0)/18;
  const cy = energy.particles.reduce((s,p)=>s+p.y,0)/18;
  assert.ok(energy.particles.every(p=>Math.hypot(p.x-cx-p.ox,p.y-cy-p.oy)<25), 'deformed particles regroup');
});
