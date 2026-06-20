/**
 * 玩法交互层 —— 宜居带计算
 *
 * 简化模型：宜居带半径正比于 √(恒星光度)，光度近似正比于质量^3.5（主序质光关系）。
 * 以太阳(1 太阳质量)宜居带 ≈ [0.95, 1.37] AU 标定。
 */
const SUN_INNER = 0.95;
const SUN_OUTER = 1.37;

export interface HabitableZone {
  inner: number;
  outer: number;
}

/** 由恒星质量估算宜居带（AU） */
export function habitableZone(starMass: number): HabitableZone {
  const luminosity = Math.pow(Math.max(starMass, 1e-6), 3.5);
  const scale = Math.sqrt(luminosity);
  return { inner: SUN_INNER * scale, outer: SUN_OUTER * scale };
}

/** 判断半径 r 是否落在宜居带内 */
export function inHabitableZone(r: number, zone: HabitableZone): boolean {
  return r >= zone.inner && r <= zone.outer;
}
