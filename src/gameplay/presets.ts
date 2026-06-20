/**
 * 玩法交互层 —— 场景预设
 *
 * BodySpec 同时承载「物理初值」与「渲染元数据」：
 * - 物理只需要 mass / 位置 / 速度（由 orbitRadius 推导圆轨道初速）；
 * - 渲染元数据（visualRadius / color / type）仅主线程使用，不进入 Worker。
 *
 * visualRadius 为视觉夸张半径，与引力计算（质点）完全无关，服务「体验优先」。
 */
import { G } from '@/physics/constants';
import { STRIDE, type BodyInitData } from '@/physics/types';

export type BodyType = 'star' | 'rocky' | 'gas';

export interface BodySpec {
  name: string;
  type: BodyType;
  /** 质量（太阳质量制） */
  mass: number;
  /** 轨道半径（AU），0 表示中心天体 */
  orbitRadius: number;
  /** 渲染半径（AU，视觉夸张） */
  visualRadius: number;
  /** 基色 */
  color: number;
  /** 程序化纹理种子 */
  seed: number;
}

export interface SystemPreset {
  name: string;
  bodies: BodySpec[];
}

/** 单恒星系统：1 恒星 + 4 岩质行星，轨道间距拉开以利视觉分离 */
export const SOLAR_PRESET: SystemPreset = {
  name: '单恒星系统',
  bodies: [
    { name: '恒星', type: 'star', mass: 1, orbitRadius: 0, visualRadius: 0.35, color: 0xfff1cf, seed: 1 },
    { name: '灰岩星', type: 'rocky', mass: 1.65e-7, orbitRadius: 0.9, visualRadius: 0.06, color: 0x9c8e7a, seed: 11 },
    { name: '碧蓝星', type: 'rocky', mass: 3.0e-6, orbitRadius: 1.5, visualRadius: 0.11, color: 0x5b86b5, seed: 23 },
    { name: '赤岩星', type: 'rocky', mass: 6.4e-7, orbitRadius: 2.3, visualRadius: 0.09, color: 0xc1654a, seed: 37 },
    { name: '苍黄星', type: 'rocky', mass: 9.0e-7, orbitRadius: 3.4, visualRadius: 0.13, color: 0xc2b184, seed: 53 },
  ],
};

/** 黄金角，用于把行星初始相位均匀错开，避免连成一线 */
const GOLDEN_ANGLE = 2.39996323;

/**
 * 由预设推导物理初值。中心天体取 bodies[0]，行星按圆轨道速度 v = √(G·M/r) 放置于 XZ 平面。
 */
export function buildInitData(preset: SystemPreset): BodyInitData {
  const specs = preset.bodies;
  const count = specs.length;
  const masses = new Float64Array(count);
  const positions = new Float64Array(count * STRIDE);
  const velocities = new Float64Array(count * STRIDE);

  const centralMass = specs[0].mass;

  for (let i = 0; i < count; i++) {
    const s = specs[i];
    masses[i] = s.mass;
    const base = i * STRIDE;

    if (s.orbitRadius > 0) {
      const r = s.orbitRadius;
      const ang = i * GOLDEN_ANGLE;
      const cx = Math.cos(ang);
      const sz = Math.sin(ang);
      const v = Math.sqrt((G * centralMass) / r);

      // 位置沿半径方向，速度垂直于半径（绕 +Y 轴公转）
      positions[base] = r * cx;
      positions[base + 2] = r * sz;
      velocities[base] = -sz * v;
      velocities[base + 2] = cx * v;
    }
  }

  return { count, masses, positions, velocities };
}
