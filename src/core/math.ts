/**
 * 基础内核层 —— 通用数学工具
 * 仅放置无副作用的纯函数与常量，供物理、渲染、玩法各层复用。
 */

export const TAU = Math.PI * 2;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

/** 万有引力常数（占位，单位制在物理层标定后再定，避免魔法值散落） */
export const GRAVITATIONAL_CONSTANT = 6.6743e-11;

/** 将 v 夹在 [min, max] 区间内 */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 反线性插值：返回 v 在 [a, b] 中的归一化位置 */
export function inverseLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

/** 平滑阶梯（Hermite 插值），用于过渡动画与渐变 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp(inverseLerp(edge0, edge1, x), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 角度转弧度 */
export function degToRad(deg: number): number {
  return deg * DEG2RAD;
}

/** 弧度转角度 */
export function radToDeg(rad: number): number {
  return rad * RAD2DEG;
}
