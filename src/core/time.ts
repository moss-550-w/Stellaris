/**
 * 感知时间系统（基础内核层）
 *
 * 基准：1 倍速 = 地球公转约 30 秒（完全隐藏真实物理倍率）。
 * 物理层与渲染层共用同一映射，保证仿真步进与显示外推时钟一致。
 */

/** 1 倍速下，地球公转一圈（= 1 模拟年）对应的真实秒数 */
export const REAL_SECONDS_PER_YEAR_AT_1X = 30;

/** 调速档位（0 = 暂停）：暂停 → 0.1 → 1 → 10 → 100 → 1000 → 10000 */
export const TIME_SCALES = [0, 0.1, 1, 10, 100, 1000, 10000] as const;

/** 默认档位索引（1×） */
export const DEFAULT_SCALE_INDEX = 2;

/** 高速阈值：超过此倍率自动降低物理精度，提示「细节省略」 */
export const HIGH_SPEED_THRESHOLD = 1000;

/** 真实秒 → 模拟年推进量 */
export function realSecondsToSimYears(realSeconds: number, scale: number): number {
  return (realSeconds * scale) / REAL_SECONDS_PER_YEAR_AT_1X;
}

/** 档位的人类可读描述（隐藏真实倍率，仅暴露感知速率） */
export function describeScale(scale: number): string {
  if (scale === 0) return '已暂停';
  const secPerYear = REAL_SECONDS_PER_YEAR_AT_1X / scale;
  if (secPerYear >= 1) return `${scale}× · ${secPerYear.toFixed(1)} 秒/年`;
  return `${scale}× · ${(1 / secPerYear).toFixed(0)} 年/秒`;
}
