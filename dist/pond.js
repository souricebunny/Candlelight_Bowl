import { showIntro } from './intro.js?v=gallery-intro';
import * as THREE from './vendor/three.module.min.js';
import { candle, flame, flower, glow } from './art.js?v=sharp-objects';
import { Currents, bowl } from './waves.js?v=cursor-glide';
import { createLiquidObject } from './liquid-object.js?v=cursor-glide';

const container = document.querySelector('#scene');
const motionButton = document.querySelector('#motion');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const currents = new Currents();
currents.updatePixels();
const cream = ['#bc935f', '#dfc6a1', '#fff1d6', '#fff5de', '#b28650'];
const pink = ['#902749', '#bc3974', '#df77a7', '#ffc0d0', '#a33c47'];
const rose = ['#831a2d', '#ba284c', '#dc5977', '#ff98a5', '#8d3529'];
const gold = ['#9c5119', '#d08028', '#f3bc56', '#ffe39a', '#a65c21'];
const objects = [];
const wax = candle();
const fire = flame();
const halo = glow();
const plate = document.querySelector('#plate');
const maxSceneSize = 4096;

function physicalSize(limit = maxSceneSize) {
  return Math.max(1, Math.min(limit, Math.round(container.getBoundingClientRect().width * devicePixelRatio)));
}

function add(map, x, y, width, isCandle = false) {
  objects.push({ map, x, y, homeX: x, homeY: y, width, isCandle,
    phase: objects.length * 2.399, angle: 0, vx: 0, vy: 0 });
}

const candles = [[.485,.749],[.306,.637],[.662,.662],[.471,.544],[.695,.454],[.322,.411],[.49,.307]];
candles.forEach(([x, y], i) => add(wax, x, y, .103 + (i % 3) * .003, true));
const blossoms = [
  [.40,.667,.124,pink],[.567,.698,.113,cream],[.58,.583,.134,rose],
  [.271,.516,.119,pink],[.371,.527,.117,cream],[.557,.443,.13,pink],
  [.414,.392,.116,rose],[.613,.339,.103,cream],[.713,.549,.107,rose],
  [.541,.789,.055,gold],[.379,.752,.06,gold],[.298,.718,.042,cream],
  [.675,.745,.066,gold],[.734,.625,.057,gold],[.594,.525,.045,gold],
  [.233,.592,.048,cream],[.223,.447,.052,gold],[.317,.335,.056,gold],
  [.394,.284,.053,gold],[.56,.252,.065,gold],[.68,.361,.067,gold],
  [.739,.39,.043,cream],[.795,.49,.049,gold],[.758,.573,.04,cream],
  [.576,.335,.043,rose],[.345,.577,.042,gold],[.616,.471,.041,gold],
  [.393,.462,.035,cream],[.453,.245,.038,cream],
];
blossoms.forEach(([x, y, width, palette], i) => {
  const map = flower(palette, palette === gold ? 8 : 5, i + 5, width >= .1 ? 4 : 2);
  add(map, x, y, width);
});

function drawStill(canvas, size) {
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.scale(size, size);
  ctx.drawImage(plate, 0, 0, 1, 1);
  function draw(map, object, width, angle) {
    ctx.save();
    ctx.translate(object.x, 1 - object.y);
    ctx.rotate(angle);
    ctx.drawImage(map.image, -width / 2, -width / 2, width, width);
    ctx.restore();
  }
  for (const object of objects) {
    if (object.isCandle) draw(halo, object, object.width * 2.5, 0);
  }
  for (const object of objects) {
    draw(object.map, object, object.width, object.phase);
    if (object.isCandle) draw(fire, object, object.width * .67, -.15);
  }
}

function initialize(fallback, refreshStill) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  } catch {
    return;
  }
  renderer.setClearColor(0, 0);
  const gl = renderer.getContext();
  const viewportLimit = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const gpuLimit = Math.min(maxSceneSize, renderer.capabilities.maxTextureSize,
    gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), viewportLimit[0], viewportLimit[1]);
  renderer.domElement.hidden = true;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, .1, 10);
  camera.position.z = 5;
  camera.layers.enableAll();

  const textureCanvas = document.createElement('canvas');
  const textureContext = textureCanvas.getContext('2d', { alpha: false });
  const plateMap = new THREE.CanvasTexture(textureCanvas);
  plateMap.colorSpace = THREE.SRGBColorSpace;
  function updateTexture() {
    const size = physicalSize(gpuLimit);
    if (textureCanvas.width !== size || textureCanvas.height !== size) {
      plateMap.dispose();
      textureCanvas.width = textureCanvas.height = size;
    }
    textureContext.drawImage(plate, 0, 0, size, size);
    plateMap.needsUpdate = true;
  }
  plate.addEventListener('load', () => {
    updateTexture();
    if (!running && !renderer.domElement.hidden) draw(time);
  });
  const waveMap = new THREE.DataTexture(currents.pixels, currents.size, currents.size, THREE.RGBAFormat);
  waveMap.minFilter = waveMap.magFilter = THREE.LinearFilter;
  waveMap.needsUpdate = true;
  const liquid = createLiquidObject(renderer, waveMap);
  if (liquid) renderer.domElement.dataset.liquid = '';
  const water = new THREE.ShaderMaterial({
    uniforms: {
      plateMap: { value: plateMap }, waveMap: { value: waveMap }, time: { value: 0 },
      center: { value: new THREE.Vector2(bowl.x, bowl.y) }, radius: { value: bowl.radius },
    },
    vertexShader: `
      varying vec2 point;
      void main() {
        point = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 point;
      uniform sampler2D plateMap, waveMap;
      uniform vec2 center;
      uniform float radius, time;

      float lightSpot(vec2 p, vec2 location, float spread) {
        vec2 delta = (p - location) * vec2(1., 1.38);
        return exp(-dot(delta, delta) / spread);
      }

      void main() {
        float d = length(point - center);
        float mask = 1. - smoothstep(radius - .022, radius, d);
        vec2 slope = (texture2D(waveMap, point).rg - vec2(128. / 255.)) * 2.;
        vec2 idle = vec2(sin(point.y * 68. + time * .35 + point.x * 25.),
                         cos(point.x * 62. - time * .3 + point.y * 31.));
        vec2 shift = (slope * .0018 + idle * .00025) * mask;
        vec3 color = texture2D(plateMap, point + shift).rgb;
        vec2 shimmer = point + shift * 1.8;
        float sparkle = 0.;
        for (int i = 0; i < 11; i++) {
          float n = float(i);
          float theta = .28 + n * .263;
          vec2 loc = center + vec2(cos(theta), sin(theta)) * (.30 + .016 * sin(n * 9.1));
          float flicker = .65 + .35 * sin(time * .65 + n * 4.2);
          sparkle += (lightSpot(shimmer, loc, .000047) * .41 + lightSpot(shimmer, loc, .00036) * .087) * flicker;
        }
        float ridge = dot(slope, vec2(.36, .63));
        color += mask * (vec3(1., .66, .28) * sparkle + vec3(.10, .07, .03) * ridge);
        gl_FragColor = vec4(max(vec3(0.), color), 1.);
        #include <colorspace_fragment>
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const surface = new THREE.Mesh(geometry, water);
  surface.position.set(.5, .5, 0);
  scene.add(surface);

  function mesh(map, parent, depth, width) {
    const layer = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      map, transparent: true, depthWrite: false,
    }));
    layer.position.z = depth;
    layer.scale.set(width, width, 1);
    parent.add(layer);
    return layer;
  }

  for (const object of objects) {
    object.group = new THREE.Group();
    scene.add(object.group);
    if (object.isCandle) object.halo = mesh(halo, object.group, .12, object.width * 2.5);
    object.body = mesh(object.map, object.group, object.isCandle ? .25 : .20, object.width);
    object.body.rotation.z = object.phase;
    object.body.layers.set(1);
    if (object.isCandle) {
      object.fire = mesh(fire, object.group, .30, object.width * .67);
      object.fire.layers.set(1);
    }
  }

  function simulate(time) {
    for (const object of objects) {
      const flow = currents.sample(object.x, object.y);
      const response = object.isCandle ? .10 : .18;
      const targetX = flow.vx + (object.homeX - object.x) * .14;
      const targetY = flow.vy + (object.homeY - object.y) * .14;
      object.vx += (targetX - object.vx) * response;
      object.vy += (targetY - object.vy) * response;
      object.x += object.vx / 60;
      object.y += object.vy / 60;
      object.angle += flow.turn / 60 * (object.isCandle ? .2 : .5);
    }
    for (let i = 0; i < objects.length; i++) {
      const a = objects[i];
      for (let j = i + 1; j < objects.length; j++) {
        const b = objects[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const gap = (a.width + b.width) * .36;
        if (distance > 0 && distance < gap) {
          const push = (gap - distance) * .04 / distance;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }
    for (const object of objects) {
      const dx = object.x - bowl.x;
      const dy = object.y - bowl.y;
      const distance = Math.hypot(dx, dy);
      const limit = bowl.radius - object.width * .39;
      if (distance > limit) {
        object.x = bowl.x + dx * limit / distance;
        object.y = bowl.y + dy * limit / distance;
        object.vx *= .55;
        object.vy *= .55;
      }
    }
  }

  function draw(time) {
    water.uniforms.time.value = time;
    for (const object of objects) {
      const flow = currents.sample(object.x, object.y);
      object.group.position.set(object.x, object.y + flow.height, 0);
      object.group.rotation.set(flow.tilt, -flow.tilt * .7, object.angle);
      if (object.fire) {
        const flicker = .97 + .025 * Math.sin(time * 3 + object.phase)
          + .012 * Math.sin(time * 5 + object.phase);
        object.fire.rotation.z = flow.vx * 3 + .025 * Math.sin(time * 1.1 + object.phase);
        object.fire.scale.setScalar(object.width * .67 * flicker);
        object.halo.material.opacity = .84 + .03 * flicker;
      }
    }
    if (liquid) {
      // Refract the water first, then draw floating surfaces at native resolution.
      camera.layers.set(0);
      liquid.draw(scene, camera, time);
      camera.layers.set(1);
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = true;
      camera.layers.enableAll();
    } else {
      renderer.render(scene, camera);
    }
  }

  let running = false;
  let time = 0;
  let last = 0;
  let accumulator = 0;
  let frame = 0;
  let resumeAfterContextLoss = false;
  const tick = (timestamp) => {
    if (last) accumulator += Math.min((timestamp - last) / 1000, .05);
    last = timestamp;
    while (accumulator >= 1 / 60) {
      time += 1 / 60;
      currents.step();
      simulate(time);
      accumulator -= 1 / 60;
    }
    waveMap.needsUpdate = true;
    draw(time);
    frame = requestAnimationFrame(tick);
  };
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    last = 0;
    if (running && !document.hidden) frame = requestAnimationFrame(tick);
  });
  function setRunning(value) {
    if (value === running) return;
    running = value;
    if (running) {
      renderer.domElement.hidden = false;
      fallback.hidden = true;
    }
    motionButton.textContent = running ? 'Pause motion' : 'Play motion';
    if (running) {
      last = 0;
      if (!document.hidden) frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
      leaveWater();
    }
  }

  let renderSize = 0;
  function resizeRenderer() {
    if (gl.isContextLost()) return;
    const size = physicalSize(gpuLimit);
    if (size === renderSize) return;
    renderSize = size;
    renderer.setSize(size, size, false);
    updateTexture();
    liquid?.resize();
    if (!renderer.domElement.hidden) draw(time);
  }
  resizeRenderer();
  observeDisplay(resizeRenderer);
  let previous = null;
  function waterPoint(event) {
    const bounds = container.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = 1 - (event.clientY - bounds.top) / bounds.height;
    return Math.hypot(x - bowl.x, y - bowl.y) < bowl.radius ? { x, y } : null;
  }
  function leaveWater() {
    previous = null;
  }
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!running || !event.isPrimary || event.button !== 0) return;
    const point = waterPoint(event);
    if (!point) return;
    previous = { ...point, time: event.timeStamp };
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!running || !event.isPrimary) return;
    const point = waterPoint(event);
    if (!point) return leaveWater();
    if (!previous) {
      previous = { ...point, time: event.timeStamp };
      return;
    }
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    // Ignore tap jitter. A deliberate stroke creates a broad, gentle current.
    if (Math.hypot(dx, dy) < .004) return;
    currents.brush(point.x, point.y, dx, dy, (event.timeStamp - previous.time) / 1000);
    previous = { ...point, time: event.timeStamp };
  }, { passive: true });
  renderer.domElement.addEventListener('pointerleave', leaveWater);
  renderer.domElement.addEventListener('pointercancel', leaveWater);
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'mouse') leaveWater();
  });
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    resumeAfterContextLoss = running;
    setRunning(false);
    renderer.domElement.hidden = true;
    fallback.hidden = false;
    refreshStill(true);
    motionButton.disabled = true;
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    currents.reset();
    renderSize = 0;
    resizeRenderer();
    motionButton.disabled = false;
    setRunning(resumeAfterContextLoss && !reduced.matches);
  });
  motionButton.disabled = false;
  motionButton.textContent = 'Play motion';
  motionButton.addEventListener('click', () => setRunning(!running));
  reduced.addEventListener('change', (event) => setRunning(!event.matches));
  setRunning(!reduced.matches);
}

function observeDisplay(update) {
  new ResizeObserver(update).observe(container);
  function watchDensity() {
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => {
      update();
      watchDensity();
    }, { once: true });
  }
  watchDensity();
}

function start() {
  const fallback = document.createElement('canvas');
  let lastSource;
  function refreshStill(force = false) {
    if (fallback.hidden) return;
    const size = physicalSize();
    if (!force && fallback.width === size && plate.currentSrc === lastSource) return;
    drawStill(fallback, size);
    lastSource = plate.currentSrc;
  }
  refreshStill();
  container.append(fallback);
  observeDisplay(refreshStill);

  plate.addEventListener('load', () => refreshStill());
  initialize(fallback, refreshStill);
  requestAnimationFrame(showIntro);
}

plate.addEventListener('error', () => {
  if (plate.hasAttribute('srcset')) {
    plate.removeAttribute('srcset');
    plate.src = './plate-dark-1536.jpg';
  }
});
if (plate.complete && plate.naturalWidth) start();
else plate.addEventListener('load', start, { once: true });
