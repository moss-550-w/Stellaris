/**
 * 渲染表现层 —— 天体可视对象工厂（meta 驱动）
 *
 * 依据 BodyMeta 创建 Three.js 对象（半径 = meta.radius，与碰撞一致）：
 * - 恒星：自发光球 + 加性光晕 sprite + 点光源；
 * - 行星/气态：受光标准材质 + 程序化彩色/凹凸纹理；
 * - 星空：程序化点云背景。
 */
import * as THREE from 'three';
import { PRNG } from '@/core/prng';
import type { BodyMeta } from '@/physics/types';
import { generatePlanetTexture, generateStarTexture, generateGlowTexture } from './proceduralTexture';

export interface StarObjects {
  group: THREE.Group;
  light: THREE.PointLight;
}

export function createStar(meta: BodyMeta): StarObjects {
  const group = new THREE.Group();

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(meta.radius, 48, 48),
    new THREE.MeshBasicMaterial({ map: generateStarTexture(meta.color, meta.seed), color: meta.color }),
  );
  surface.userData.id = meta.id;
  group.add(surface);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: generateGlowTexture(meta.color),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  glow.scale.setScalar(meta.radius * 6);
  group.add(glow);

  // decay = 0：光照不随距离衰减，保证远轨行星也被均匀照亮（体验优先）
  const light = new THREE.PointLight(meta.color, 2.4, 0, 0);
  group.add(light);

  return { group, light };
}

export function createPlanet(meta: BodyMeta): THREE.Mesh {
  const { map, bump } = generatePlanetTexture(meta.color, meta.seed);
  const material = new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.015,
    roughness: meta.type === 'gas' ? 0.7 : 0.95,
    metalness: 0,
    emissive: new THREE.Color(meta.color),
    emissiveIntensity: meta.type === 'gas' ? 0.12 : 0.03,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(meta.radius, 48, 48), material);
  mesh.userData.id = meta.id;
  return mesh;
}

/** 创建天体顶层对象（恒星返回 group，其它返回 mesh），统一打上 userData.id 供拾取 */
export function createBody(meta: BodyMeta): { object: THREE.Object3D; light: THREE.PointLight | null } {
  if (meta.type === 'star') {
    const { group, light } = createStar(meta);
    group.userData.id = meta.id;
    return { object: group, light };
  }
  const mesh = createPlanet(meta);
  return { object: mesh, light: null };
}

export function createStarfield(count = 2600, radius = 800, seed = 9001): THREE.Points {
  const prng = new PRNG(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
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
