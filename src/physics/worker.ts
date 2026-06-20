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

const HISTORY_LIMIT = 20;
const undoStack: WorldState[] = [];
const redoStack: WorldState[] = [];

const TICK_MS = 16;
const PREDICT_DT = FIXED_DT_YEARS;

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
  };
  ctx.postMessage(snapshot, [ids.buffer, positions.buffer, velocities.buffer]);
}

/** 编辑/碰撞/撤销后刷新渲染端（集合 + 一帧位置） */
function refresh(): void {
  emitBodies();
  emitSnapshot(false);
}

function loop(): void {
  if (!running) return;

  const now = performance.now();
  let realDt = (now - lastReal) / 1000;
  lastReal = now;
  if (realDt > 0.1) realDt = 0.1;

  const advanceYears = realSecondsToSimYears(realDt, timeScale);

  let dt = FIXED_DT_YEARS;
  let steps = Math.round(advanceYears / dt);
  let detailOmitted = false;

  if (steps > MAX_STEPS_PER_TICK) {
    detailOmitted = true;
    if (timeScale > HIGH_SPEED_THRESHOLD) dt = advanceYears / MAX_STEPS_PER_TICK;
    steps = MAX_STEPS_PER_TICK;
  }

  for (let s = 0; s < steps; s++) {
    world.step(dt);
  }
  world.simYears += steps * dt;
  tick += steps;

  // 每 tick 检测一次碰撞（粒度足够，避免逐子步开销）
  const events = world.handleCollisions();
  if (events.length > 0) {
    emitBodies(); // 集合已变，先更新 mesh 映射
    ctx.postMessage({ kind: 'collision', events });
  }

  emitSnapshot(detailOmitted);
  timer = self.setTimeout(loop, TICK_MS);
}

function startLoop(): void {
  if (running || world.count === 0) return;
  running = true;
  lastReal = performance.now();
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
