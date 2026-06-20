/**
 * 渲染表现层 —— 天体可视对象工厂
 *
 * 依据 BodySpec 创建 Three.js 对象：
 * - 恒星：自发光球 + 加性光晕 sprite + 点光源（照亮行星）；
 * - 行星：受光标准材质 + 程序化彩色/凹凸纹理；
 * - 星空：程序化分布的点云背景。
 * 工厂只负责「造物」，位置更新由 SimulationController 每帧驱动。
 */
import * as THREE from 'three';
import { PRNG } from '@/core/prng';
import type { BodySpec } from '@/gameplay/presets';
import { generatePlanetTexture, generateStarTexture, generateGlowTexture } from './proceduralTexture';

export interface StarObjects {
  group: THREE.Group;
  light: THREE.PointLight;
}

/** 创建恒星：自发光球 + 光晕 + 点光源 */
export function createStar(spec: BodySpec): StarObjects {
  const group = new THREE.Group();

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(spec.visualRadius, 48, 48),
    new THREE.MeshBasicMaterial({ map: generateStarTexture(spec.color, spec.seed), color: spec.color }),
  );
  group.add(surface);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: generateGlowTexture(spec.color),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  glow.scale.setScalar(spec.visualRadius * 6);
  group.add(glow);

  // decay = 0：光照不随距离衰减，保证远轨行星也被均匀照亮（体验优先）
  const light = new THREE.PointLight(spec.color, 2.4, 0, 0);
  group.add(light);

  return { group, light };
}

/** 创建岩质行星：受光标准材质 + 程序化纹理 */
export function createPlanet(spec: BodySpec): THREE.Mesh {
  const { map, bump } = generatePlanetTexture(spec.color, spec.seed);
  const material = new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.015,
    roughness: 0.95,
    metalness: 0,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(spec.visualRadius, 48, 48), material);
}

/** 创建程序化星空背景 */
export function createStarfield(count = 2600, radius = 800, seed = 9001): THREE.Points {
  const prng = new PRNG(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // 均匀分布于球壳
    const u = prng.next() * 2 - 1;
    const theta = prng.next() * Math.PI * 2;
    const r = radius * (0.85 + prng.next() * 0.15);
    const s = Math.sqrt(1 - u * u);
    const idx = i * 3;
    positions[idx] = r * s * Math.cos(theta);
    positions[idx + 1] = r * u;
    positions[idx + 2] = r * s * Math.sin(theta);

    const b = 0.6 + prng.next() * 0.4;
    colors[idx] = b;
    colors[idx + 1] = b;
    colors[idx + 2] = Math.min(1, b + 0.1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.4,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}
