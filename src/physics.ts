export interface Point { x: number; y: number }
export interface Collider extends Point { px: number; py: number; vx: number; vy: number; radius: number }
export interface Particle extends Point { vx: number; vy: number; ox: number; oy: number; radius: number; phase: number }
export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function closestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Soft cluster: local springs retain cohesion while individual nodes deform on contact. */
export class Energy {
  particles: Particle[] = [];
  width = 1;
  height = 1;
  flow = 1;
  strength = 1;
  time = 0;
  resize(width: number, height: number) {
    if (this.particles.length) for (const p of this.particles) { p.x *= width / this.width; p.y *= height / this.height; }
    this.width = width; this.height = height;
    if (!this.particles.length) this.reset();
  }
  reset() {
    const scale = clamp(Math.min(this.width, this.height) / 550, .65, 1.35);
    this.particles = Array.from({ length: 18 }, (_, i) => {
      const a = i * 2.399963, r = (i < 6 ? 52 : 26) * scale;
      const ox = Math.cos(a) * r * (1 + .2 * Math.sin(a * 3)), oy = Math.sin(a) * r * .8;
      return { x: this.width / 2 + ox, y: this.height / 2 + oy, ox, oy, vx: 0, vy: 0, radius: (i < 6 ? 20 + (i % 3) * 3 : 11 + (i % 3) * 2) * scale, phase: a };
    });
    this.time = 0;
  }
  step(dt: number, colliders: Collider[]) {
    dt = clamp(dt, 0, 1 / 30);
    const steps = Math.max(1, Math.ceil(dt * 120));
    for (let i = 0; i < steps; i++) this.integrate(dt / steps, colliders);
  }
  private integrate(dt: number, colliders: Collider[]) {
    this.time += dt;
    const n = this.particles.length;
    const cx = this.particles.reduce((a, p) => a + p.x, 0) / n;
    const cy = this.particles.reduce((a, p) => a + p.y, 0) / n;
    for (const p of this.particles) {
      const wobble = this.flow * (Math.sin(this.time * .8 + p.phase) * 12);
      let ax = (cx + p.ox + Math.cos(p.phase) * wobble - p.x) * 14;
      let ay = (cy + p.oy + Math.sin(p.phase) * wobble - p.y) * 14;
      ax += Math.sin(this.time * .41) * 9 * this.flow;
      ay += Math.cos(this.time * .37) * 7 * this.flow;
      // Share the strongest contact, so a palm with many landmarks does not multiply force.
      let contactX = 0, contactY = 0, best = 0;
      for (const c of colliders) {
        const nearest = closestOnSegment(p, { x: c.px, y: c.py }, c);
        let dx = p.x - nearest.x, dy = p.y - nearest.y;
        let d = Math.hypot(dx, dy);
        const reach = p.radius * 1.6 + c.radius;
        if (d >= reach) continue;
        if (d < .001) { dx = c.vx || 1; dy = c.vy; d = Math.hypot(dx, dy); }
        const weight = 1 - Math.min(d / reach, 1);
        if (weight <= best) continue;
        best = weight;
        contactX = (dx / d * 1300 + clamp(c.vx, -1600, 1600) * 12) * weight;
        contactY = (dy / d * 1300 + clamp(c.vy, -1600, 1600) * 12) * weight;
      }
      ax += contactX * this.strength; ay += contactY * this.strength;
      p.vx = (p.vx + ax * dt) * Math.exp(-1.6 * dt);
      p.vy = (p.vy + ay * dt) * Math.exp(-1.6 * dt);
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 1000) { p.vx *= 1000 / speed; p.vy *= 1000 / speed; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const margin = p.radius * 2;
      if (p.x < margin) { p.x = margin; p.vx = Math.abs(p.vx) * .5; }
      if (p.x > this.width - margin) { p.x = this.width - margin; p.vx = -Math.abs(p.vx) * .5; }
      if (p.y < margin) { p.y = margin; p.vy = Math.abs(p.vy) * .5; }
      if (p.y > this.height - margin) { p.y = this.height - margin; p.vy = -Math.abs(p.vy) * .5; }
    }
  }
}

/** Matches object-fit:contain and the video's horizontal mirror exactly. */
export function mapCameraPoint(p: Point, vw: number, vh: number, sw: number, sh: number): Point {
  const scale = Math.min(sw / vw, sh / vh);
  return { x: (sw - vw * scale) / 2 + (1 - p.x) * vw * scale, y: (sh - vh * scale) / 2 + p.y * vh * scale };
}
