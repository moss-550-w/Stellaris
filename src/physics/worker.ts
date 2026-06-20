/**
 * 物理仿真层 —— Web Worker 入口（阶段二：可玩沙盒）
 *
 * 职责：
 * - 持有权威 World，按精度档执行 accumulator 主循环；
 * - 处理动态编辑（增删改/加载预设）与碰撞演化；
 * - 内聚撤销/重做（完整 WorldState 栈，上限 20），消除主线程异步时序问题；
 * - 响应轨道预测请求；
 * - 每个物理 tick 以 Transferable 零拷贝回传快照（id + 位置 + 速度）。
 */
import type { PhysicsCommand, PhysicsOutbound, SnapshotMessage, WorldState } from './types';
import { STRIDE } from './types';
import { FIXED_DT_YEARS, MAX_STEPS_PER_TICK } from './constants';
import { realSecondsToSimYears, HIGH_SPEED_THRESHOLD } from '@/core/time';
import { World, predictTrajectory } from './world';
import { computeEnergy, computeAngularMomentum } from './diagnostics';

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<PhysicsCommand>) => void) | null;
  postMessage(message: PhysicsOutbound, transfer?: Transferable[]): void;
};

const world = new World();
let running = false;
let timeScale = 1;
let tick = 0;
let lastReal = 0;
let timer: number | null = null;
/** 不足一个固定步长的模拟年余量，跨 tick 累积（修复低速档归零暂停） */
let pendingYears = 0;

const HISTORY_LIMIT = 20;
const undoStack: WorldState[] = [];
const redoStack: WorldState[] = [];

const TICK_MS = 16;
const PREDICT_DT = FIXED_DT_YEARS;

// —— 守恒量诊断（V2.0 阶段七，仅实验精度档）——
// 基线在「进入实验档 / 加载 / 结构变化」时重建，drift 自该基线起算。
let energyBaseline: number | null = null;
let angularBaseline: number | null = null;
let diagLoopCounter = 0;
/** 低频发送间隔（loop 迭代数）；16ms×15≈0.25s，HUD 平滑且 O(N²) 计算开销可忽略 */
const DIAG_EVERY_LOOPS = 15;

/** 结构变化后置空基线 → 下次发送时按当前状态重建 */
function invalidateDiagnostics(): void {
  energyBaseline = null;
  angularBaseline = null;
}

/** 计算并回传守恒量与相对基线漂移 */
function emitDiagnostics(): void {
  const energy = computeEnergy(world.positions, world.velocities, world.masses, world.count);
  const angular = computeAngularMomentum(world.positions, world.velocities, world.masses, world.count);
  if (energyBaseline === null || angularBaseline === null) {
    energyBaseline = energy;
    angularBaseline = angular;
  }
  const eRef = Math.abs(energyBaseline) > 1e-12 ? Math.abs(energyBaseline) : 1;
  const aRef = Math.abs(angularBaseline) > 1e-12 ? Math.abs(angularBaseline) : 1;
  ctx.postMessage({
    kind: 'diagnostics',
    simYears: world.simYears,
    energy,
    angularMomentum: angular,
    energyDrift: (energy - energyBaseline) / eRef,
    angularDrift: (angular - angularBaseline) / aRef,
  });
}

function pushHistory(): void {
  undoStack.push(world.serialize());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
}

function emitBodies(): void {
  ctx.postMessage({
    kind: 'bodies',
    metas: world.metas(),
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  });
}

function emitSnapshot(detailOmitted: boolean): void {
  const count = world.count;
  const n = count * STRIDE;
  const ids = new Int32Array(count);
  ids.set(world.ids.subarray(0, count));
  const positions = new Float32Array(n);
  positions.set(world.positions.subarray(0, n));
  const velocities = new Float32Array(n);
  velocities.set(world.velocities.subarray(0, n));
  const fuels = new Float32Array(count);
  for (let k = 0; k < count; k++) fuels[k] = world.fuels[k];

  const snapshot: SnapshotMessage = {
    kind: 'snapshot',
    tick,
    simYears: world.simYears,
    count,
    mode: world.mode,
    detailOmitted,
    ids,
    positions,
    velocities,
    fuels,
  };
  ctx.postMessage(snapshot, [ids.buffer, positions.buffer, velocities.buffer, fuels.buffer]);
}

/** 编辑/碰撞/撤销后刷新渲染端（集合 + 一帧位置） */
function refresh(): void {
  invalidateDiagnostics(); // 结构/状态已变，守恒基线作废
  emitBodies();
  emitSnapshot(false);
}

function loop(): void {
  if (!running) return;

  const now = performance.now();
  let realDt = (now - lastReal) / 1000;
  lastReal = now;
  if (realDt > 0.1) realDt = 0.1;

  // 累加本 tick 应推进的模拟年。低速档单 tick 不足一个固定步长时，
  // 余量跨 tick 累积，凑够一步再积分——否则 round/floor 归零会表现为「暂停」。
  pendingYears += realSecondsToSimYears(realDt, timeScale);

  let dt = FIXED_DT_YEARS;
  let steps = Math.floor(pendingYears / dt);
  let detailOmitted = false;

  if (steps > MAX_STEPS_PER_TICK) {
    detailOmitted = true;
    // 高速：用大步长一次性消化全部累积量，保护状态稳定；
    // 非高速截断：丢弃超额量（不滞后膨胀），对齐既有降速语义。
    if (timeScale > HIGH_SPEED_THRESHOLD) dt = pendingYears / MAX_STEPS_PER_TICK;
    steps = MAX_STEPS_PER_TICK;
    pendingYears = 0;
  } else {
    pendingYears -= steps * dt; // 仅保留不足一步的余量到下一 tick
  }

  for (let s = 0; s < steps; s++) {
    world.step(dt);
  }
  const advanced = steps * dt;
  world.simYears += advanced;
  tick += steps;

  // 演化步进（低频，按演化倍率推进恒星年龄）；阶段跃迁可能改变外观/类型
  const evoEvents = world.evolveStep(advanced * world.evolutionScale);
  if (evoEvents.length > 0) {
    invalidateDiagnostics(); // 质量/类型已变，守恒基线作废
    emitBodies(); // 外观/类型已变，先更新 mesh 映射
    ctx.postMessage({ kind: 'evolution', events: evoEvents });
  }

  // 每 tick 检测一次碰撞（粒度足够，避免逐子步开销）
  const events = world.handleCollisions();
  if (events.length > 0) {
    invalidateDiagnostics(); // 天体集合已变，守恒基线作废
    emitBodies(); // 集合已变，先更新 mesh 映射
    ctx.postMessage({ kind: 'collision', events });
  }

  emitSnapshot(detailOmitted);

  // 实验精度档：低频回传守恒量诊断（HUD + 报告采样）
  if (world.mode === 'precise') {
    if (++diagLoopCounter >= DIAG_EVERY_LOOPS) {
      diagLoopCounter = 0;
      emitDiagnostics();
    }
  }

  timer = self.setTimeout(loop, TICK_MS);
}

function startLoop(): void {
  if (running || world.count === 0) return;
  running = true;
  lastReal = performance.now();
  pendingYears = 0; // 启动/恢复时清陈旧余量，避免暂停间隔后突跳
  loop();
}

function stopLoop(): void {
  running = false;
  if (timer !== null) {
    self.clearTimeout(timer);
    timer = null;
  }
}

ctx.onmessage = (e: MessageEvent<PhysicsCommand>): void => {
  const cmd = e.data;
  switch (cmd.type) {
    case 'ping':
      ctx.postMessage({ kind: 'pong' });
      break;

    case 'load':
      // 加载视为可撤销操作（若已有内容）
      if (world.count > 0) pushHistory();
      world.load(cmd.state);
      tick = 0;
      refresh();
      break;

    case 'start':
      startLoop();
      break;

    case 'pause':
      stopLoop();
      break;

    case 'setTimeScale':
      timeScale = cmd.scale;
      break;

    case 'setMode':
      world.setMode(cmd.mode);
      if (cmd.mode === 'precise') {
        // 进入实验档：重建基线并立即回传一帧（暂停时 HUD 也有初值）
        invalidateDiagnostics();
        emitDiagnostics();
      }
      break;

    case 'setEvolutionScale':
      world.evolutionScale = cmd.scale;
      break;

    case 'setShipControl':
      world.setShipControl(cmd.id, cmd.thrustMode);
      emitBodies(); // 回显推力模式给 UI
      break;

    case 'addBody':
      pushHistory();
      world.addBody(cmd.body);
      refresh();
      break;

    case 'removeBody':
      pushHistory();
      world.removeById(cmd.id);
      refresh();
      break;

    case 'editBody':
      pushHistory();
      world.editBody(cmd.id, cmd.patch);
      refresh();
      break;

    case 'undo':
      if (undoStack.length > 0) {
        redoStack.push(world.serialize());
        const prev = undoStack.pop() as WorldState;
        world.load(prev);
        refresh();
      }
      break;

    case 'redo':
      if (redoStack.length > 0) {
        undoStack.push(world.serialize());
        const next = redoStack.pop() as WorldState;
        world.load(next);
        refresh();
      }
      break;

    case 'predict': {
      const points = predictTrajectory(world, cmd.id, cmd.years, cmd.samples, PREDICT_DT);
      ctx.postMessage({ kind: 'prediction', id: cmd.id, points }, [points.buffer]);
      break;
    }
  }
};
