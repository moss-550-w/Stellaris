/**
 * 物理仿真层 —— 碰撞判定
 *
 * 三级判定（以相对速度 / 接触面逃逸速度之比为基准）：
 * - 低速合并   ratio < 0.5
 * - 中速撕裂   0.5 ≤ ratio < 1.5
 * - 高速毁灭   ratio ≥ 1.5
 * 材质影响：气态更易合并（阈值上调），恒星参与高速碰撞触发超新星。
 * 另提供洛希极限计算，供撕裂判定与潮汐效应参考。
 */
import { G } from './constants';
import type { BodyType } from './types';

export type CollisionOutcome = 'merge' | 'tear' | 'destroy';

/** 接触面（分离距离 = r1 + r2）处的逃逸速度 */
export function escapeVelocity(totalMass: number, separation: number): number {
  return Math.sqrt((2 * G * totalMass) / separation);
}

/** 材质等效密度系数（非真实密度，仅用于洛希/材质倾向）：黑洞 ≫ 恒星 > 岩质 > 气态 */
export function materialDensity(type: BodyType): number {
  switch (type) {
    case 'blackhole':
      return 8;
    case 'star':
      return 1.4;
    case 'rocky':
      return 1.0;
    case 'gas':
      return 0.4;
    case 'spacecraft':
      return 0.1; // 测试粒子，密度仅作占位
  }
}

/**
 * 刚体洛希极限：卫星在主星潮汐力下解体的临界轨道半径。
 * d = R_primary · 2.44 · (ρ_primary / ρ_satellite)^(1/3)
 */
export function rocheLimit(primaryRadius: number, primaryType: BodyType, satelliteType: BodyType): number {
  const ratio = materialDensity(primaryType) / materialDensity(satelliteType);
  return primaryRadius * 2.44 * Math.cbrt(ratio);
}

/**
 * 依据相对速度与材质判定碰撞结果。
 * @param relSpeed 相对速度大小
 * @param totalMass 两天体质量和
 * @param separation 接触分离距离 (r1 + r2)
 */
export function classifyCollision(
  relSpeed: number,
  totalMass: number,
  separation: number,
  typeA: BodyType,
  typeB: BodyType,
): CollisionOutcome {
  // 黑洞吞噬：接触即合并，无视相对速度
  if (typeA === 'blackhole' || typeB === 'blackhole') return 'merge';

  const vEsc = escapeVelocity(totalMass, separation);
  const ratio = relSpeed / vEsc;

  // 气态参与：更易合并
  const gasInvolved = typeA === 'gas' || typeB === 'gas';
  const mergeThreshold = gasInvolved ? 0.7 : 0.5;
  const destroyThreshold = 1.5;

  if (ratio < mergeThreshold) return 'merge';
  if (ratio < destroyThreshold) return 'tear';
  return 'destroy';
}
