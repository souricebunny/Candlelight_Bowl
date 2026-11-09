export const bowl = { x: .488, y: .528, radius: .35 };
const size = 128;
const maxFlow = .04;

// One continuous current field drives the water and all floating objects.
export class Currents {
  pixels = new Uint8Array(size * size * 4);
  time = 0;
  wakes = [];

  brush(x, y, dx, dy, duration) {
    const speed = Math.hypot(dx, dy) / Math.max(duration, 1 / 60);
    const strength = Math.min(speed * .22, .12);
    const distance = Math.hypot(dx, dy);
    if (!distance) return;
    // Track the entire cursor stroke so fast passes cannot skip an object.
    this.wakes.push({
      x: x - dx, y: y - dy, dx, dy, lengthSquared: distance * distance,
      vx: dx / distance * strength, vy: dy / distance * strength, age: 0,
    });
    if (this.wakes.length > 8) this.wakes.shift();
  }

  sample(x, y) {
    const dx = x - bowl.x;
    const dy = y - bowl.y;
    const distance = Math.hypot(dx, dy);
    const edge = Math.max(0, 1 - (distance / bowl.radius) ** 4);
    const circulation = .014 + .004 * Math.sin(this.time * .13);
    let vx = -dy * circulation;
    let vy = dx * circulation;
    let turn = circulation;
    for (const wake of this.wakes) {
      const along = Math.max(0, Math.min(1,
        ((x - wake.x) * wake.dx + (y - wake.y) * wake.dy) / wake.lengthSquared));
      const offsetX = x - wake.x - along * wake.dx;
      const offsetY = y - wake.y - along * wake.dy;
      const radiusSquared = offsetX * offsetX + offsetY * offsetY;
      const influence = Math.exp(-radiusSquared / .0045) * Math.exp(-wake.age / .65);
      turn += (offsetX * wake.vy - offsetY * wake.vx) * influence * 45;
      vx += wake.vx * influence;
      vy += wake.vy * influence;
    }
    const speed = Math.hypot(vx, vy);
    const limit = Math.min(1, .16 / (speed || 1)) * edge;
    vx *= limit;
    vy *= limit;
    const phase = dx * 13 + dy * 10 - this.time * .55;
    const height = Math.sin(phase) * .00065 * edge;
    return { vx, vy, height, tilt: Math.cos(phase) * .008 * edge, turn: Math.max(-.65, Math.min(.65, turn)) * edge };
  }

  step() {
    this.time += 1 / 60;
    this.wakes = this.wakes.filter(wake => {
      wake.age += 1 / 60;
      return wake.age < 4;
    });
    this.updatePixels();
  }

  updatePixels() {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const flow = this.sample(x / (size - 1), y / (size - 1));
        const index = (y * size + x) * 4;
        this.pixels[index] = 128 + Math.round(Math.max(-1, Math.min(1, flow.vx / maxFlow)) * 127);
        this.pixels[index + 1] = 128 + Math.round(Math.max(-1, Math.min(1, flow.vy / maxFlow)) * 127);
        this.pixels[index + 2] = 0;
        this.pixels[index + 3] = 255;
      }
    }
  }

  reset() { this.wakes = []; this.updatePixels(); }
  get size() { return size; }
}
