/**
 * 玩法交互层 —— 场景预设
 *
 * 预设以函数产出天体列表，再统一分配 id 组装为 WorldState（撤销/存档单位）。
 * 半径既是视觉半径也是碰撞半径（体验优先：所见即所撞）。
 */
import { G } from '@/physics/constants';
import type { NewBody, WorldState } from '@/physics/types';

export interface PresetDef {
  key: string;
  name: string;
  build: () => NewBody[];
}

/** 圆轨道：绕原点中心质量 centralMass、半径 r、相位 angle 放置 */
function circularOrbit(
  body: Omit<NewBody, 'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz'>,
  r: number,
  angle: number,
  centralMass: number,
): NewBody {
  const cx = Math.cos(angle);
  const sz = Math.sin(angle);
  const v = Math.sqrt((G * centralMass) / r);
  return {
    ...body,
    x: r * cx,
    y: 0,
    z: r * sz,
    vx: -sz * v,
    vy: 0,
    vz: cx * v,
  };
}

const GOLDEN = 2.39996323;

function singleStar(): NewBody[] {
  const star: NewBody = {
    type: 'star', mass: 1, radius: 0.35, color: 0xfff1cf, seed: 1,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
  };
  const planets: Array<[number, number, number, number]> = [
    // [radius, visualRadius, color, seed]
    [0.9, 0.06, 0x9c8e7a, 11],
    [1.5, 0.11, 0x5b86b5, 23],
    [2.3, 0.09, 0xc1654a, 37],
    [3.4, 0.13, 0xc2b184, 53],
  ];
  return [
    star,
    ...planets.map(([r, vr, color, seed], i) =>
      circularOrbit({ type: 'rocky', mass: 3e-6 + i * 2e-7, radius: vr, color, seed }, r, i * GOLDEN, 1),
    ),
  ];
}

function binary(): NewBody[] {
  const d = 0.6;
  const m = 0.8;
  const total = 2 * m;
  const s = 0.5 * Math.sqrt((G * total) / d); // 各星绕质心速度
  const starA: NewBody = {
    type: 'star', mass: m, radius: 0.26, color: 0xffd9a0, seed: 2,
    x: d / 2, y: 0, z: 0, vx: 0, vy: 0, vz: s,
  };
  const starB: NewBody = {
    type: 'star', mass: m, radius: 0.26, color: 0xa9c8ff, seed: 3,
    x: -d / 2, y: 0, z: 0, vx: 0, vy: 0, vz: -s,
  };
  // 环双星行星
  const p1 = circularOrbit({ type: 'rocky', mass: 4e-6, radius: 0.1, color: 0x76c08a, seed: 24 }, 2.2, 0.4, total);
  const p2 = circularOrbit({ type: 'gas', mass: 2e-5, radius: 0.18, color: 0xd8b070, seed: 41 }, 3.3, 3.5, total);
  return [starA, starB, p1, p2];
}

function triangle(): NewBody[] {
  // 三星等边编舞（Lagrange 平衡解，旋转三角形，稳定且美观）
  const m = 0.7;
  const R = 0.8;
  const v = Math.sqrt((G * m) / (Math.sqrt(3) * R));
  const colors = [0xffb0a0, 0xa0ffb8, 0xa0c0ff];
  const out: NewBody[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const cx = Math.cos(a);
    const sz = Math.sin(a);
    out.push({
      type: 'star', mass: m, radius: 0.22, color: colors[i], seed: 60 + i,
      x: R * cx, y: 0, z: R * sz,
      vx: -sz * v, vy: 0, vz: cx * v,
    });
  }
  return out;
}

function blackholeSystem(): NewBody[] {
  const bh: NewBody = {
    type: 'blackhole', mass: 2, radius: 0.18, color: 0x000000, seed: 70,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
  };
  // 几颗近距天体绕黑洞，便于观察吸积/吞噬与引力透镜
  const orbiters = [
    circularOrbit({ type: 'star', mass: 0.5, radius: 0.16, color: 0xffd0a0, seed: 71 }, 1.4, 0.0, 2),
    circularOrbit({ type: 'rocky', mass: 4e-6, radius: 0.09, color: 0x88aadd, seed: 72 }, 2.1, 2.0, 2),
    circularOrbit({ type: 'gas', mass: 3e-5, radius: 0.16, color: 0xd8b070, seed: 73 }, 3.0, 4.1, 2),
  ];
  return [bh, ...orbiters];
}

export const PRESETS: PresetDef[] = [
  { key: 'single', name: '单恒星系统', build: singleStar },
  { key: 'binary', name: '双星系统', build: binary },
  { key: 'triangle', name: '三星编舞', build: triangle },
  { key: 'blackhole', name: '黑洞系统', build: blackholeSystem },
];

/** 为天体列表分配稳定 id，组装为 WorldState */
export function toWorldState(bodies: NewBody[], startId = 1): WorldState {
  const serialized = bodies.map((b, i) => ({ ...b, id: startId + i }));
  return {
    bodies: serialized,
    simYears: 0,
    nextId: startId + bodies.length,
    rngState: 0x9e3779b9,
  };
}

export function buildPreset(key: string): WorldState {
  const def = PRESETS.find((p) => p.key === key) ?? PRESETS[0];
  return toWorldState(def.build());
}

/** 生成一个默认新天体（绕中心 1 太阳质量近圆轨道，便于「添加」后即可见运动） */
export function makeDefaultBody(seed: number): NewBody {
  const r = 1.2 + (seed % 5) * 0.4;
  const angle = (seed % 360) * (Math.PI / 180);
  return circularOrbit(
    { type: 'rocky', mass: 5e-6, radius: 0.1, color: 0x8fb3e0, seed },
    r,
    angle,
    1,
  );
}

/**
 * 发射一艘航天器（V2.0 阶段六）：mass≈0 测试粒子，置于内侧近圆轨道，
 * 自带燃料与推力，玩家可顺/逆行推进做引力弹弓。centralMass 取场景主导质量。
 */
export function makeSpacecraft(seed: number, centralMass = 1): NewBody {
  const r = 0.7 + (seed % 4) * 0.25;
  const angle = (seed * 1.7) % (Math.PI * 2);
  const ship = circularOrbit(
    { type: 'spacecraft', mass: 0, radius: 0.04, color: 0x7fe9ff, seed },
    r,
    angle,
    centralMass,
  );
  ship.maxThrust = 6; // AU/年²：满油可得约 maxThrust × 0.6 ≈ 3.6 AU/年 总 Δv
  return ship;
}
