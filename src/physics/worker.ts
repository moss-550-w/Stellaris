/**
 * 物理仿真层 —— Web Worker 入口（阶段零骨架）
 *
 * 当前仅搭建：消息分发、双缓冲数据结构、主循环框架。
 * 真正的积分器（标准模式 Verlet / 流畅模式半隐式欧拉）在阶段一、二填充。
 */
import type { PhysicsCommand, PhysicsOutbound, PhysicsSnapshot } from './types';
import { STRIDE } from './types';

// 规避 DOM 与 WebWorker lib 的全局类型冲突：对 worker 全局做最小化类型断言
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<PhysicsCommand>) => void) | null;
  postMessage(message: PhysicsOutbound): void;
};

interface SimState {
  running: boolean;
  bodyCount: number;
  timeScale: number;
  tick: number;
  simTime: number;
  /** 双缓冲：一个用于计算，一个用于传输，每帧交换 */
  buffers: [Float32Array, Float32Array];
  velBuffers: [Float32Array, Float32Array];
  computeIndex: 0 | 1;
  timer: number | null;
}

const state: SimState = {
  running: false,
  bodyCount: 0,
  timeScale: 1,
  tick: 0,
  simTime: 0,
  buffers: [new Float32Array(0), new Float32Array(0)],
  velBuffers: [new Float32Array(0), new Float32Array(0)],
  computeIndex: 0,
  timer: null,
};

// 占位主循环步长（毫秒）。阶段一接入感知时间系统后由 timeScale 驱动真实步长。
const STEP_MS = 16;

function init(bodyCount: number): void {
  state.bodyCount = bodyCount;
  const len = bodyCount * STRIDE;
  state.buffers = [new Float32Array(len), new Float32Array(len)];
  state.velBuffers = [new Float32Array(len), new Float32Array(len)];
  state.computeIndex = 0;
  state.tick = 0;
  state.simTime = 0;
}

function step(): void {
  // —— 阶段零占位：未来在此对 computeIndex 缓冲执行 N 体积分 ——
  state.tick += 1;
  state.simTime += (STEP_MS / 1000) * state.timeScale;

  // 双缓冲切换：刚写好的缓冲作为传输缓冲发出
  const transferIndex = state.computeIndex;
  state.computeIndex = (state.computeIndex ^ 1) as 0 | 1;

  const snapshot: PhysicsSnapshot = {
    kind: 'snapshot',
    tick: state.tick,
    simTime: state.simTime,
    bodyCount: state.bodyCount,
    // 阶段零发送副本；阶段一改为可转移所有权 (Transferable) 的真双缓冲 + 渲染端归还
    positions: state.buffers[transferIndex].slice(),
    velocities: state.velBuffers[transferIndex].slice(),
  };
  ctx.postMessage(snapshot);
}

function startLoop(): void {
  if (state.timer !== null) return;
  state.running = true;
  const tickFn = (): void => {
    if (!state.running) return;
    step();
    state.timer = self.setTimeout(tickFn, STEP_MS);
  };
  state.timer = self.setTimeout(tickFn, STEP_MS);
}

function stopLoop(): void {
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
      init(cmd.bodyCount);
      break;
    case 'start':
      startLoop();
      break;
    case 'pause':
      stopLoop();
      break;
    case 'setTimeScale':
      state.timeScale = cmd.scale;
      break;
  }
};
