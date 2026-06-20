/**
 * 玩法交互层 —— 成就 / 挑战系统
 *
 * 设计原则（CLAUDE.md）：
 * - 精确目标：每个挑战为可判定的明确条件；
 * - 完全透明：实时输出进度(0~1)与「中断原因」，UI 直接展示；
 * - 判定基准：以「平衡标准模式(Verlet)」为准（要求 mode === 'standard'）。
 *
 * 评估在主线程基于最新快照 + 元数据进行，无副作用（纯函数式 evaluate）。
 */
import type { BodyType, IntegrationMode } from '@/physics/types';
import { habitableZone, inHabitableZone } from './habitableZone';

/** 单个天体的评估视图（位置/速度来自快照，质量/类型来自 meta） */
export interface BodyView {
  id: number;
  type: BodyType;
  mass: number;
  x: number;
  y: number;
  z: number;
  speed: number;
}

export interface ChallengeContext {
  bodies: BodyView[];
  mode: IntegrationMode;
  simYears: number;
}

export interface ChallengeResult {
  /** 进度 0~1 */
  progress: number;
  /** 是否达成 */
  done: boolean;
  /** 中断原因 / 当前状态描述（透明展示） */
  reason: string;
}

export interface Challenge {
  key: string;
  name: string;
  goal: string;
  evaluate: (ctx: ChallengeContext) => ChallengeResult;
}

function countByType(bodies: BodyView[], type: BodyType): number {
  return bodies.filter((b) => b.type === type).length;
}

/** 要求标准模式，否则返回中断原因 */
function requireStandard(ctx: ChallengeContext): ChallengeResult | null {
  if (ctx.mode !== 'standard') {
    return { progress: 0, done: false, reason: '需切换至「标准」精度模式以判定' };
  }
  return null;
}

const CHALLENGES: Challenge[] = [
  {
    key: 'binary-habitable',
    name: '宜居双星',
    goal: '恰好 3 个天体：建立双星系统，并使行星位于宜居带',
    evaluate: (ctx) => {
      const blocked = requireStandard(ctx);
      if (blocked) return blocked;

      const total = ctx.bodies.length;
      if (total !== 3) {
        return { progress: 0, done: false, reason: `需恰好 3 个天体（当前 ${total}）` };
      }
      const stars = ctx.bodies.filter((b) => b.type === 'star');
      const planets = ctx.bodies.filter((b) => b.type === 'rocky' || b.type === 'gas');
      if (stars.length !== 2) {
        return { progress: 0.33, done: false, reason: `需 2 颗恒星（当前 ${stars.length}）` };
      }
      if (planets.length !== 1) {
        return { progress: 0.5, done: false, reason: '需恰好 1 颗行星' };
      }
      // 双星质心
      const m = stars[0].mass + stars[1].mass;
      const cx = (stars[0].x * stars[0].mass + stars[1].x * stars[1].mass) / m;
      const cz = (stars[0].z * stars[0].mass + stars[1].z * stars[1].mass) / m;
      const p = planets[0];
      const r = Math.hypot(p.x - cx, p.z - cz);
      const zone = habitableZone(m);
      if (inHabitableZone(r, zone)) {
        return { progress: 1, done: true, reason: `达成！行星距质心 ${r.toFixed(2)} AU，位于宜居带` };
      }
      const target = (zone.inner + zone.outer) / 2;
      const closeness = 1 - Math.min(1, Math.abs(r - target) / target);
      return {
        progress: 0.6 + closeness * 0.35,
        done: false,
        reason: `行星 ${r.toFixed(2)} AU，宜居带 [${zone.inner.toFixed(2)}, ${zone.outer.toFixed(2)}]`,
      };
    },
  },
  {
    key: 'three-body-survive',
    name: '三体共舞',
    goal: '让 3 颗恒星共存超过 5 模拟年（不发生碰撞合并）',
    evaluate: (ctx) => {
      const blocked = requireStandard(ctx);
      if (blocked) return blocked;
      const stars = countByType(ctx.bodies, 'star');
      if (stars < 3) {
        return { progress: Math.min(1, stars / 3) * 0.3, done: false, reason: `需 3 颗恒星（当前 ${stars}）` };
      }
      const t = Math.min(1, ctx.simYears / 5);
      if (ctx.simYears >= 5 && stars >= 3) {
        return { progress: 1, done: true, reason: `达成！3 星共存 ${ctx.simYears.toFixed(1)} 年` };
      }
      return { progress: 0.3 + t * 0.7, done: false, reason: `已共存 ${ctx.simYears.toFixed(1)} / 5 年` };
    },
  },
  {
    key: 'feed-blackhole',
    name: '黑洞盛宴',
    goal: '用黑洞吞噬至少 3 个天体（场景天体数随吞噬减少）',
    evaluate: (ctx) => {
      const bh = countByType(ctx.bodies, 'blackhole');
      if (bh === 0) {
        return { progress: 0, done: false, reason: '场景中需有 1 个黑洞' };
      }
      // 以黑洞质量增长间接反映吞噬数（黑洞初始 radius 用于参考，这里用相对阈值）
      const heaviest = ctx.bodies.filter((b) => b.type === 'blackhole').sort((a, b) => b.mass - a.mass)[0];
      const swallowed = Math.max(0, Math.round((heaviest.mass - 1) / 0.5));
      const done = swallowed >= 3;
      return {
        progress: Math.min(1, swallowed / 3),
        done,
        reason: done ? `达成！黑洞已吞噬约 ${swallowed} 个天体` : `已吞噬约 ${swallowed} / 3 个（靠拢黑洞投喂）`,
      };
    },
  },
];

export function listChallenges(): Challenge[] {
  return CHALLENGES;
}

export function getChallenge(key: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.key === key);
}
