// Canvas UI Liquid Object fluid solver and compositing, adapted for Candlelight Bowl.
// Upstream: https://canvasui.dev/r/liquid-object-vanilla.json
// Copyright (c) 2026 David Haz. See vendor/CANVAS-UI-LICENSE.md.
import * as THREE from './vendor/three.module.min.js';
import { bowl } from './waves.js?v=cursor-glide';

const QUAD_VERT = `
out vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMPOSITE_FRAG = `
uniform sampler2D tScene;
uniform sampler2D tField;
uniform vec2 uFieldTexel;
uniform float uDistortion;
uniform float uAberration;
uniform float uGrain;
uniform vec2 uCursor;
uniform float uLensRadius;
uniform float uGlow;
uniform float uAspect;
uniform float uSheen;
uniform float uIridescence;
uniform float uAmbient;
uniform float uTime;
uniform vec2 uCenter;
uniform float uRadius;

in vec2 vUv;
out vec4 fragColor;

vec3 toSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(0.41666)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

vec2 flowAt(vec2 uv) { return (texture(tField, uv).xy - vec2(128.0 / 255.0)) * 16.0; }

void main() {
  float mask = 1.0 - smoothstep(uRadius - 0.045, uRadius, distance(vUv, uCenter));
  vec2 flow = flowAt(vUv);
  vec2 drift = vec2(
    sin(vUv.y * 9.0 + uTime * 0.7) + sin(vUv.y * 21.0 - uTime * 1.1) * 0.6,
    sin(vUv.x * 8.0 - uTime * 0.6) + sin(vUv.x * 17.0 + uTime * 0.9) * 0.6
  );
  vec2 push = mask * (clamp(flow * uDistortion * 0.001, -0.002, 0.002) + drift * uAmbient * 0.0016);

  float lx = length(flowAt(vUv - vec2(uFieldTexel.x, 0.0)));
  float rx = length(flowAt(vUv + vec2(uFieldTexel.x, 0.0)));
  float by = length(flowAt(vUv - vec2(0.0, uFieldTexel.y)));
  float ty = length(flowAt(vUv + vec2(0.0, uFieldTexel.y)));
  vec2 grad = vec2(rx - lx, ty - by);

  vec2 toCursor = (vUv - uCursor) * vec2(uAspect, 1.0);
  float lens = (1.0 - smoothstep(uLensRadius * 0.15, uLensRadius, length(toCursor))) * uGlow * mask;
  vec2 spread = normalize(toCursor + 1e-5) * (lens * uAberration * 0.006) / vec2(uAspect, 1.0);
  vec2 uv = vUv - push;
  vec3 color = vec3(texture(tScene, uv - spread).r,
                    texture(tScene, uv).g,
                    texture(tScene, uv + spread).b);

  vec3 normal = normalize(vec3(-grad * 0.3, 1.0));
  float spec = pow(max(dot(normal, normalize(vec3(-0.4, 0.55, 0.73))), 0.0), 16.0);
  color += spec * uSheen * mask * smoothstep(0.3, 12.0, length(flow));

  float energy = length(flow);
  float rim = length(grad);
  float wave = smoothstep(0.4, 8.0, rim + energy * 0.12) * mask;
  vec3 shimmer = 0.5 + 0.5 * cos(vec3(0.0, 2.094, 4.188) + energy * 0.045 + (grad.x - grad.y) * 0.1 + uTime * 0.6);
  color += shimmer * wave * uIridescence * 0.5;

  color = toSrgb(max(color, 0.0));
  float grainN = fract(sin(dot(gl_FragCoord.xy + vec2(uTime * 127.1, uTime * 311.7), vec2(12.9898, 78.233))) * 43758.5453);
  color += (grainN - 0.5) * uGrain * (0.35 + 0.65 * lens) * 0.14 * mask;
  fragColor = vec4(max(color, 0.0), 1.0);
}
`;

export function createLiquidObject(renderer, currentMap) {
  if (!renderer.extensions.has('EXT_color_buffer_float')) return null;
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  sceneTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const uniforms = {
    tScene: { value: sceneTarget.texture },
    tField: { value: currentMap },
    uFieldTexel: { value: new THREE.Vector2(1 / currentMap.image.width, 1 / currentMap.image.height) },
    uDistortion: { value: .5 }, uAberration: { value: 0 },
    uGrain: { value: .015 }, uCursor: { value: new THREE.Vector2(.5, .5) },
    uLensRadius: { value: .17 }, uGlow: { value: 0 }, uAspect: { value: 1 },
    uSheen: { value: .06 }, uIridescence: { value: .08 }, uAmbient: { value: 0 },
    uTime: { value: 0 }, uCenter: { value: new THREE.Vector2(bowl.x, bowl.y) },
    uRadius: { value: bowl.radius },
  };
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: QUAD_VERT, fragmentShader: COMPOSITE_FRAG,
    uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    resize() {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      sceneTarget.setSize(Math.max(1, size.x), Math.max(1, size.y));
    },
    draw(content, contentCamera, time) {
      renderer.setRenderTarget(sceneTarget);
      renderer.render(content, contentCamera);
      uniforms.uTime.value = time;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    },
  };
}
