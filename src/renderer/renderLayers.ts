/**
 * 渲染表现层 —— 显式透明排序层级
 *
 * CLAUDE.md 约定的半透明渲染顺序（renderOrder 由小到大）：
 * 背景星空 → 轨道线 → 范围球 → 大气光晕 → 粒子/特效 → UI 光效。
 * 所有半透明对象必须显式指定 renderOrder，避免深度错误。
 */
export const RenderOrder = {
  STARFIELD: 0,
  ORBIT_LINE: 10,
  RANGE_SPHERE: 20,
  ATMOSPHERE: 30,
  PARTICLE: 40,
  UI_EFFECT: 50,
} as const;
