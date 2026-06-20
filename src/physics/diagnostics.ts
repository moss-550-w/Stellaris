/**
 * 物理仿真层 —— 守恒量诊断（V2.0 阶段七）
 *
 * 计算系统总能量与总角动量，用于高精度实验档的守恒量监测。
 * 二者在无外力的纯引力系统中应严格守恒；其漂移量是积分器精度的客观度量。
 */
import { G, SOFTENING } from './constants';
import { STRIDE } from './types';

/** 系统总能量 = 动能 + 势能（天文单位制） */
export function computeEnergy(
  positions: Float64Array,
  velocities: Float64Array,
  masses: Float64Array,
  count: number,
): number {
  let ke = 0;
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const v2 = velocities[o] ** 2 + velocities[o + 1] ** 2 + velocities[o + 2] ** 2;
    ke += 0.5 * masses[i] * v2;
  }
  let pe = 0;
  const soft2 = SOFTENING * SOFTENING;
  for (let i = 0; i < count; i++) {
    const oi = i * STRIDE;
    for (let j = i + 1; j < count; j++) {
      const oj = j * STRIDE;
      const dx = positions[oj] - positions[oi];
      const dy = positions[oj + 1] - positions[oi + 1];
      const dz = positions[oj + 2] - positions[oi + 2];
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz + soft2);
      pe -= (G * masses[i] * masses[j]) / r;
    }
  }
  return ke + pe;
}

/** 系统总角动量大小 |Σ mᵢ (rᵢ × vᵢ)| */
export function computeAngularMomentum(
  positions: Float64Array,
  velocities: Float64Array,
  masses: Float64Array,
  count: number,
): number {
  let lx = 0;
  let ly = 0;
  let lz = 0;
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const m = masses[i];
    const x = positions[o];
    const y = positions[o + 1];
    const z = positions[o + 2];
    const vx = velocities[o];
    const vy = velocities[o + 1];
    const vz = velocities[o + 2];
    lx += m * (y * vz - z * vy);
    ly += m * (z * vx - x * vz);
    lz += m * (x * vy - y * vx);
  }
  return Math.sqrt(lx * lx + ly * ly + lz * lz);
}
