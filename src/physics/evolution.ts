/**
 * 物理仿真层 —— 天体演化引擎（V2.0 阶段五）
 *
 * 设计原则：
 * - 阶段是 (质量, 年龄) 的**纯函数**——确定性，撤销/重做与序列化天然安全；
 * - 演化时标映射到「感知时间」尺度（演化年龄按 simYears × evolutionScale 推进），
 *   不做亿年级真实积分，保证体验优先；
 * - 仅恒星演化；岩质/气态/黑洞为 'none'（黑洞为恒星演化终点，载入后保持）。
 *
 * 简化天体物理（面向科普，非严格数值）：
 * - 主序寿命 ∝ M / L ∝ M^(-2.5)（质量越大寿命越短）；以 1 太阳质量主序寿命标定为基准时长。
 * - 终点按质量：低质量 → 白矮星；中等 → 中子星（经超新星）；大质量 → 黑洞（经超新星）。
 */
import type { EvolutionStage, BodyType } from './types';

/** 1 太阳质量恒星的主序「演化基准时长」（演化年）。
 *  注意：这是演化时钟单位，配合 evolutionScale 映射到可感知时间，并非真实 100 亿年。 */
export const SOLAR_MAIN_SEQUENCE_LIFE = 1000;

/** 红巨星阶段占主序寿命的比例 */
const RED_GIANT_FRACTION = 0.1;

/** 终点质量阈值（太阳质量） */
const WHITE_DWARF_MAX = 1.4; // 钱德拉塞卡极限附近
const NEUTRON_STAR_MAX = 3.0; // 超过则坍缩为黑洞

/** 恒星主序寿命（演化年）：∝ M^(-2.5) */
export function mainSequenceLife(mass: number): number {
  return SOLAR_MAIN_SEQUENCE_LIFE * Math.pow(Math.max(mass, 1e-3), -2.5);
}

/** 红巨星阶段持续时长（演化年） */
export function redGiantLife(mass: number): number {
  return mainSequenceLife(mass) * RED_GIANT_FRACTION;
}

/** 恒星的最终遗骸阶段（按质量） */
export function remnantStage(mass: number): EvolutionStage {
  if (mass <= WHITE_DWARF_MAX) return 'white_dwarf';
  if (mass <= NEUTRON_STAR_MAX) return 'neutron_star';
  return 'black_hole';
}

/**
 * 由质量与年龄推断当前阶段（纯函数）。仅对恒星有效。
 * supernova 为瞬态——由调用方在「跨越红巨星结束点」时单独触发一次闪现，不在此返回。
 */
export function stageFor(mass: number, age: number): EvolutionStage {
  const ms = mainSequenceLife(mass);
  const rg = redGiantLife(mass);
  if (age < ms) return 'main_sequence';
  if (age < ms + rg) return 'red_giant';
  return remnantStage(mass);
}

/** 剩余至下一次跃迁的演化年（−1 表示已到终点、稳定） */
export function remainingLife(mass: number, age: number, stage: EvolutionStage): number {
  const ms = mainSequenceLife(mass);
  const rg = redGiantLife(mass);
  switch (stage) {
    case 'main_sequence':
      return Math.max(0, ms - age);
    case 'red_giant':
      return Math.max(0, ms + rg - age);
    default:
      return -1; // 遗骸阶段稳定
  }
}

/** 是否大质量恒星（终点前会经历超新星闪现） */
export function goesSupernova(mass: number): boolean {
  return mass > WHITE_DWARF_MAX;
}

export interface StageAppearance {
  /** 半径相对主序基准半径的缩放 */
  radiusScale: number;
  /** 颜色（0xRRGGBB），undefined 表示沿用天体自身颜色 */
  color?: number;
  /** 跃迁后应变为的天体类型（用于黑洞终点） */
  type?: BodyType;
}

/**
 * 各阶段的外观参数（渲染据此切换）：
 * - 红巨星：膨胀变红；白矮星：缩小变白热；中子星：极小、青白；黑洞：转为 blackhole 类型。
 */
export function appearanceFor(stage: EvolutionStage): StageAppearance {
  switch (stage) {
    case 'main_sequence':
      return { radiusScale: 1 };
    case 'red_giant':
      return { radiusScale: 2.6, color: 0xff6a3c };
    case 'supernova':
      return { radiusScale: 3.2, color: 0xfff0c0 };
    case 'white_dwarf':
      return { radiusScale: 0.45, color: 0xdfe8ff };
    case 'neutron_star':
      return { radiusScale: 0.28, color: 0xbfe0ff };
    case 'black_hole':
      return { radiusScale: 0.5, color: 0x000000, type: 'blackhole' };
    default:
      return { radiusScale: 1 };
  }
}
