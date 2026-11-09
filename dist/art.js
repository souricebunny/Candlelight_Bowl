import * as THREE from './vendor/three.module.min.js';

function surface(size, density = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * density;
  const ctx = canvas.getContext('2d');
  ctx.scale(density, density);
  return [canvas, ctx];
}

function texture(canvas) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function disc(ctx, x, y, radius, fill) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function glow() {
  const [canvas, ctx] = surface(128, 2);
  const halo = ctx.createRadialGradient(64, 64, 0, 64, 64, 63);
  halo.addColorStop(0, '#ffbc605a');
  halo.addColorStop(.27, '#ffaf4436');
  halo.addColorStop(1, '#ff983000');
  disc(ctx, 64, 64, 63, halo);
  return texture(canvas);
}

export function candle() {
  const [canvas, ctx] = surface(256, 4);
  ctx.shadowColor = '#241005ba';
  ctx.shadowBlur = 68;
  ctx.shadowOffsetY = 32;
  disc(ctx, 128, 131, 99, '#b77935');
  ctx.shadowColor = 'transparent';
  const wax = ctx.createRadialGradient(111, 108, 4, 128, 128, 97);
  wax.addColorStop(0, '#ffe5a5');
  wax.addColorStop(.45, '#ffcf7a');
  wax.addColorStop(.87, '#eeb369');
  wax.addColorStop(.94, '#ffdc9c');
  wax.addColorStop(.975, '#fff0c4');
  wax.addColorStop(1, '#c48646');
  disc(ctx, 128, 125, 97, wax);
  const melt = ctx.createRadialGradient(128, 125, 2, 128, 125, 38);
  melt.addColorStop(0, '#ffc55c');
  melt.addColorStop(.82, '#f6a94580');
  melt.addColorStop(1, '#ffc46c00');
  disc(ctx, 128, 125, 38, melt);
  ctx.fillStyle = '#694025';
  ctx.fillRect(125, 121, 7, 12);
  ctx.strokeStyle = '#fff3c480';
  ctx.lineWidth = .7;
  ctx.beginPath();
  ctx.arc(128, 125, 91, Math.PI * 1.08, Math.PI * 1.83);
  ctx.stroke();
  ctx.strokeStyle = '#9b5b3338';
  ctx.beginPath();
  ctx.arc(128, 125, 34, .15, Math.PI * .85);
  ctx.stroke();
  return texture(canvas);
}

export function flame() {
  const [canvas, ctx] = surface(128, 4);
  const halo = ctx.createRadialGradient(64, 67, 2, 64, 67, 55);
  halo.addColorStop(0, '#fffac7');
  halo.addColorStop(.23, '#ffdf6db0');
  halo.addColorStop(1, '#ff992000');
  disc(ctx, 64, 67, 55, halo);
  const light = ctx.createLinearGradient(0, 33, 0, 87);
  light.addColorStop(0, '#ffd47c');
  light.addColorStop(.65, '#fffde8');
  light.addColorStop(1, '#fff5ae');
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(71, 35);
  ctx.bezierCurveTo(71, 56, 90, 73, 69, 86);
  ctx.bezierCurveTo(50, 93, 41, 74, 55, 58);
  ctx.quadraticCurveTo(66, 45, 71, 35);
  ctx.fill();
  return texture(canvas);
}

export function flower([base, middle, edge, vein, core], count, seed, density = 2) {
  const [canvas, ctx] = surface(256, density);
  ctx.translate(128, 128);
  ctx.shadowColor = '#210f0a88';
  ctx.shadowBlur = 9 * density;
  ctx.shadowOffsetY = 4 * density;
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI * 2 / count + Math.sin(i * 9 + seed) * .11);
    const length = 99 + Math.sin(i * 13 + seed) * 12;
    const width = count === 5 ? 49 : 34;
    const color = ctx.createLinearGradient(0, 0, 0, -length);
    color.addColorStop(0, base);
    color.addColorStop(.35, middle);
    color.addColorStop(.87, edge);
    color.addColorStop(1, middle);
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-width * .5, -22, -width * 1.25, -length * .66, -width * .72, -length * .9);
    ctx.bezierCurveTo(-width * .3, -length * 1.05, width * .77, -length * 1.14, width * .91, -length * .78);
    ctx.bezierCurveTo(width, -length * .45, width * .35, -14, 0, 4);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = vein;
    for (let j = -7; j <= 7; j++) {
      ctx.globalAlpha = .14 + .14 * Math.abs(Math.sin(j * 7 + i));
      ctx.lineWidth = j === 0 ? 1 : .55;
      ctx.beginPath();
      ctx.moveTo(j * .65, -4);
      ctx.quadraticCurveTo(j * 2.7 + 3, -length * .58, j * width * .13, -length);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }
  disc(ctx, 0, 0, count === 5 ? 6 : 12, core);
  for (let i = 0; i < 26; i++) {
    const angle = i * 2.4;
    const radius = Math.sqrt(i / 2) * (count === 5 ? 1.4 : 2.7);
    disc(ctx, Math.cos(angle) * radius, Math.sin(angle) * radius, .9, i % 3 ? edge : '#ffe4a1');
  }
  return texture(canvas);
}
