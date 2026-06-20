/**
 * 物理常量 —— 采用天文单位制（AU · 年 · 太阳质量）
 *
 * 该单位制下引力常数 G = 4π²，使地球（1 AU、绕 1 太阳质量）的圆轨道周期恰为 1 年，
 * 数值舒适且避免 SI 制下的极端大小指数。
 */

/** 引力常数（天文单位制） */
export const G = 4 * Math.PI * Math.PI;

/** 物理积分固定步长（模拟年）。1/365 ≈ 1 天，对内太阳系尺度轨道足够精确。 */
export const FIXED_DT_YEARS = 1 / 365;

/** 单帧最大积分步数，防止高倍率下的「死亡螺旋」 */
export const MAX_STEPS_PER_TICK = 64;

/** 引力软化长度（AU），避免近距离 1/r² 奇点导致数值爆炸 */
export const SOFTENING = 1e-4;
