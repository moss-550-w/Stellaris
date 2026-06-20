/**
 * 物理仿真层 —— 主线程 ↔ Worker 通信协议
 * 所有跨线程消息均为可结构化克隆/转移的纯数据，禁止携带函数或类实例。
 */

/** 每个天体在缓冲中占用的分量数 (x, y, z) */
export const STRIDE = 3;

/** 天体初始物理数据（一次性传入 Worker，可转移所有权） */
export interface BodyInitData {
  count: number;
  /** 质量，长度 = count（太阳质量制） */
  masses: Float64Array;
  /** 初始位置，长度 = count * STRIDE（AU） */
  positions: Float64Array;
  /** 初始速度，长度 = count * STRIDE（AU/年） */
  velocities: Float64Array;
}

/** 主线程 → 物理 Worker 的指令 */
export type PhysicsCommand =
  | { type: 'init'; data: BodyInitData }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'setTimeScale'; scale: number }
  | { type: 'ping' };

/** 物理快照：一帧的天体状态，渲染层据此做一阶外推插值显示 */
export interface PhysicsSnapshot {
  kind: 'snapshot';
  /** 累计物理步数 */
  tick: number;
  /** 模拟时间（年） */
  simYears: number;
  bodyCount: number;
  /** 位置缓冲，长度 = bodyCount * STRIDE（AU） */
  positions: Float32Array;
  /** 速度缓冲，长度 = bodyCount * STRIDE（AU/年），用于渲染端外推 */
  velocities: Float32Array;
  /** 高倍率下是否降低了物理精度 */
  detailOmitted: boolean;
}

/** 连通性应答 */
export interface PhysicsPong {
  kind: 'pong';
}

/** 物理 Worker → 主线程的输出 */
export type PhysicsOutbound = PhysicsSnapshot | PhysicsPong;
