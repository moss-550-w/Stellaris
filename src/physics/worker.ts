/**
 * 物理仿真层 —— Web Worker 入口（阶段一：单恒星系统）
 *
 * 职责：
 * - 持有天体状态，按固定步长执行 velocity Verlet 全 N 体积分；
 * - accumulator 主循环：依据感知时间将真实流逝时间换算为模拟年推进量；
 * - 高倍率（>1000×）自动放大步长并限制步数，触发「细节省略」；
 * - 每个物理 tick 产出一份快照（位置 + 速度），以 Transferable 零拷贝回传主线程。
 */
import type { PhysicsCommand, PhysicsOutbound, PhysicsSnapshot, BodyInitData } from './types';
import { STRIDE } from './types';
import { FIXED_DT_YEARS, MAX_STEPS_PER_TICK } from './constants';
import { computeAccelerations, verletStep } from './integrator';
import { realSecondsToSimYears, HIGH_SPEED_THRESHOLD } from '@/core/time';

// 规避 DOM 与 WebWorker lib 的全局类型冲突：对 worker 全局做最小化类型断言
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<PhysicsCommand>) => void) | null;
  postMessage(message: PhysicsOutbound, transfer?: Transferable[]): void;
};

interface SimState {
  count: number;
  masses: Float64Array;
  positions: Float64Array;
  velocities: Float64Array;
  accOld: Float64Array;
  accNew: Float64Array;
  running: boolean;
  timeScale: number;
  simYears: number;
  tick: number;
  lastReal: number;
  timer: number | null;
}

let state: SimState | null = null;

/** 主循环间隔（毫秒），约等于 60Hz */
const TICK_MS = 16;

function init(data: BodyInitData): void {
  const { count } = data;
  const n = count * STRIDE;
  // init 数据经 Transferable 转移，所有权已归 Worker，直接持有
  const positions = data.positions;
  const velocities = data.velocities;
  const masses = data.masses;
  const accOld = new Float64Array(n);
  const accNew = new Float64Array(n);
  computeAccelerations(positions, masses, count, accOld);

  state = {
    count,
    masses,
    positions,
    velocities,
    accOld,
    accNew,
    running: false,
    timeScale: 1,
    simYears: 0,
    tick: 0,
    lastReal: 0,
    timer: null,
  };
  emitSnapshot(false); // 初始帧，渲染端立即就位
}

function emitSnapshot(detailOmitted: boolean): void {
  if (!state) return;
  const n = state.count * STRIDE;
  // 双缓冲思想：每帧产出独立的传输缓冲，Float64 计算结果收窄为 Float32 传输
  const positions = new Float32Array(n);
  const velocities = new Float32Array(n);
  positions.set(state.positions);
  velocities.set(state.velocities);

  const snapshot: PhysicsSnapshot = {
    kind: 'snapshot',
    tick: state.tick,
    simYears: state.simYears,
    bodyCount: state.count,
    positions,
    velocities,
    detailOmitted,
  };
  // 转移 buffer 所有权，零拷贝
  ctx.postMessage(snapshot, [positions.buffer, velocities.buffer]);
}

function loop(): void {
  if (!state || !state.running) return;

  const now = performance.now();
  let realDt = (now - state.lastReal) / 1000;
  state.lastReal = now;
  if (realDt > 0.1) realDt = 0.1; // 卡顿/切后台保护，避免一次推进过多

  const advanceYears = realSecondsToSimYears(realDt, state.timeScale);

  let dt = FIXED_DT_YEARS;
  let steps = Math.round(advanceYears / dt);
  let detailOmitted = false;

  if (steps > MAX_STEPS_PER_TICK) {
    detailOmitted = true;
    if (state.timeScale > HIGH_SPEED_THRESHOLD) {
      // 高速：放大单步步长，固定步数上限（牺牲精度换取稳定与性能）
      dt = advanceYears / MAX_STEPS_PER_TICK;
    }
    steps = MAX_STEPS_PER_TICK;
  }

  for (let s = 0; s < steps; s++) {
    verletStep(state.positions, state.velocities, state.masses, state.count, dt, state.accOld, state.accNew);
  }
  state.simYears += steps * dt;
  state.tick += steps;

  emitSnapshot(detailOmitted);
  state.timer = self.setTimeout(loop, TICK_MS);
}

function startLoop(): void {
  if (!state || state.running) return;
  state.running = true;
  state.lastReal = performance.now();
  loop();
}

function stopLoop(): void {
  if (!state) return;
  state.running = false;
  if (state.timer !== null) {
    self.clearTimeout(state.timer);
    state.timer = null;
  }
}

ctx.onmessage = (e: MessageEvent<PhysicsCommand>): void => {
  const cmd = e.data;
  switch (cmd.type) {
    case 'ping':
      ctx.postMessage({ kind: 'pong' });
      break;
    case 'init':
      init(cmd.data);
      break;
    case 'start':
      startLoop();
      break;
    case 'pause':
      stopLoop();
      break;
    case 'setTimeScale':
      if (state) state.timeScale = cmd.scale;
      break;
  }
};
