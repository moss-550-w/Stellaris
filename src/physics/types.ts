/**
 * 物理仿真层 —— 主线程 ↔ Worker 通信协议
 * 所有跨线程消息均为可结构化克隆/转移的纯数据，禁止携带函数或类实例。
 */

/** 每个天体在缓冲中占用的分量数 (x, y, z) */
export const STRIDE = 3;

/** 主线程 → 物理 Worker 的指令 */
export type PhysicsCommand =
  | { type: 'init'; bodyCount: number; seed: number }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'setTimeScale'; scale: number }
  | { type: 'ping' };

/** 物理快照：一帧的天体状态，渲染层据此做一阶外推插值显示 */
export interface PhysicsSnapshot {
  kind: 'snapshot';
  /** 物理步数 */
  tick: number;
  /** 模拟时间（感知时间秒） */
  simTime: number;
  bodyCount: number;
  /** 位置缓冲，长度 = bodyCount * STRIDE */
  positions: Float32Array;
  /** 速度缓冲，长度 = bodyCount * STRIDE */
  velocities: Float32Array;
}

/** 连通性应答 */
export interface PhysicsPong {
  kind: 'pong';
}

/** 物理 Worker → 主线程的输出 */
export type PhysicsOutbound = PhysicsSnapshot | PhysicsPong;
