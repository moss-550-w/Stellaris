/**
 * 渲染表现层 —— 天体可视对象工厂（meta 驱动）
 *
 * 依据 BodyMeta 创建 Three.js 对象（半径 = meta.radius，与碰撞一致）：
 * - 恒星：自发光球 + 加性光晕 + 点光源；
 * - 岩质：受光标准材质 + 程序化彩色/凹凸纹理 + 薄大气光晕；
 * - 气态：受光条带纹理 + 较厚大气光晕；
 * - 黑洞：纯黑球（视界）+ 吸积盘环 + 暗色光晕；不发光。
 * 所有半透明附属（光晕/吸积盘）显式设置 renderOrder（ATMOSPHERE 层）。
 */
import * as THREE from 'three';
import { PRNG } from '@/core/prng';
import type { BodyMeta } from '@/physics/types';
import {
  generatePlanetTexture,
  generateStarTexture,
  generateGasTexture,
  generateGlowTexture,
  generateAccretionTexture,
} from './proceduralTexture';
import { RenderOrder } from './renderLayers';

export interface BuiltBody {
  object: THREE.Object3D;
  /** 恒星点光源（其它类型为 null） */
  light: THREE.PointLight | null;
}

/** 大气光晕 sprite（加性混合，置于 ATMOSPHERE 层） */
function makeHalo(color: number, scale: number, opacity: number): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: generateGlowTexture(color),
      color,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity,
    }),
  );
  sprite.scale.setScalar(scale);
  sprite.renderOrder = RenderOrder.ATMOSPHERE;
  return sprite;
}

function createStar(meta: BodyMeta): BuiltBody {
  const group = new THREE.Group();
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(meta.radius, 48, 48),
    new THREE.MeshBasicMaterial({ map: generateStarTexture(meta.color, meta.seed), color: meta.color }),
  );
  surface.userData.id = meta.id;
  group.add(surface);

  group.add(makeHalo(meta.color, meta.radius * 6, 1));
  const light = new THREE.PointLight(meta.color, 2.4, 0, 0); // decay=0：远轨均匀照亮
  group.add(light);
  return { object: group, light };
}

function createPlanet(meta: BodyMeta): BuiltBody {
  const group = new THREE.Group();
  const isGas = meta.type === 'gas';
  const map = isGas
    ? generateGasTexture(meta.color, meta.seed)
    : generatePlanetTexture(meta.color, meta.seed).map;

  const material = new THREE.MeshStandardMaterial({
    map,
    roughness: isGas ? 0.7 : 0.95,
    metalness: 0,
    emissive: new THREE.Color(meta.color),
    emissiveIntensity: isGas ? 0.12 : 0.03,
  });
  if (!isGas) {
    const { bump } = generatePlanetTexture(meta.color, meta.seed);
    material.bumpMap = bump;
    material.bumpScale = 0.015;
  }
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(meta.radius, 48, 48), material);
  mesh.userData.id = meta.id;
  group.add(mesh);

  // 大气光晕：气态更厚
  group.add(makeHalo(meta.color, meta.radius * (isGas ? 3.2 : 2.2), isGas ? 0.5 : 0.3));
  return { object: group, light: null };
}

function createBlackHole(meta: BodyMeta): BuiltBody {
  const group = new THREE.Group();

  // 视界：纯黑球，不受光、不写发光
  const horizon = new THREE.Mesh(
    new THREE.SphereGeometry(meta.radius, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  horizon.userData.id = meta.id;
  group.add(horizon);

  // 吸积盘：环面，加性混合，置于 ATMOSPHERE 层
  const disk = new THREE.Mesh(
    new THREE.TorusGeometry(meta.radius * 2.4, meta.radius * 0.9, 2, 64),
    new THREE.MeshBasicMaterial({
      map: generateAccretionTexture(meta.seed),
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      transparent: true,
    }),
  );
  disk.rotation.x = Math.PI / 2.2;
  disk.renderOrder = RenderOrder.ATMOSPHERE;
  disk.scale.set(1, 1, 0.18); // 压扁成盘
  group.add(disk);

  // 暗紫光晕，弱
  group.add(makeHalo(0x6a4fa0, meta.radius * 7, 0.35));
  return { object: group, light: null };
}

/** 创建天体顶层对象，统一打上 userData.id 供拾取 */
export function createBody(meta: BodyMeta): BuiltBody {
  let built: BuiltBody;
  switch (meta.type) {
    case 'star':
      built = createStar(meta);
      break;
    case 'blackhole':
      built = createBlackHole(meta);
      break;
    default:
      built = createPlanet(meta);
  }
  built.object.userData.id = meta.id;
  return built;
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
  const points = new THREE.Points(geometry, material);
  points.renderOrder = RenderOrder.STARFIELD;
  return points;
}
