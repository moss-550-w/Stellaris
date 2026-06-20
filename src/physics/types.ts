/**
 * 物理仿真层 —— 主线程 ↔ Worker 通信协议（阶段二：动态沙盒）
 *
 * 关键变更：天体集合可动态增删（编辑/碰撞），引入稳定 id 体系。
 * 渲染端按 id 维护 mesh 映射，由 BodiesMessage 增删、SnapshotMessage 更新位置。
 * 所有跨线程消息均为可结构化克隆/转移的纯数据。
 */

/** 每个天体在缓冲中占用的分量数 (x, y, z) */
export const STRIDE = 3;

export type BodyType = 'star' | 'rocky' | 'gas';

/** 积分精度档：fluid = 流畅(半隐式欧拉)，standard = 标准(velocity Verlet) */
export type IntegrationMode = 'fluid' | 'standard';

/** 新增天体规格（不含 id，由 Worker 分配） */
export interface NewBody {
  type: BodyType;
  mass: number;
  /** 视觉=碰撞半径（AU，体验优先：所见即所撞） */
  radius: number;
  color: number;
  seed: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/** 完整序列化天体 */
export interface SerializedBody extends NewBody {
  id: number;
}

/** 天体渲染元数据（不含位置/速度） */
export interface BodyMeta {
  id: number;
  type: BodyType;
  mass: number;
  radius: number;
  color: number;
  seed: number;
}

/** 可编辑字段补丁 */
export type BodyPatch = Partial<Omit<SerializedBody, 'id' | 'seed'>>;

/** 完整世界状态（撤销/重做与存档的单位） */
export interface WorldState {
  bodies: SerializedBody[];
  simYears: number;
  nextId: number;
  rngState: number;
}

/** 碰撞事件（供特效/提示） */
export interface CollisionEvent {
  kind: 'merge' | 'tear' | 'destroy' | 'supernova';
  x: number;
  y: number;
  z: number;
  radius: number;
  color: number;
}

// —— 主线程 → Worker ——
export type PhysicsCommand =
  | { type: 'load'; state: WorldState }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'setTimeScale'; scale: number }
  | { type: 'setMode'; mode: IntegrationMode }
  | { type: 'addBody'; body: NewBody }
  | { type: 'removeBody'; id: number }
  | { type: 'editBody'; id: number; patch: BodyPatch }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'predict'; id: number; years: number; samples: number }
  | { type: 'ping' };

// —— Worker → 主线程 ——

/** 天体集合变更（init / 编辑 / 碰撞 / 撤销后发送） */
export interface BodiesMessage {
  kind: 'bodies';
  metas: BodyMeta[];
  canUndo: boolean;
  canRedo: boolean;
}

/** 逐帧状态快照 */
export interface SnapshotMessage {
  kind: 'snapshot';
  tick: number;
  simYears: number;
  count: number;
  mode: IntegrationMode;
  detailOmitted: boolean;
  ids: Int32Array;
  positions: Float32Array; // count * STRIDE
  velocities: Float32Array; // count * STRIDE
}

export interface CollisionMessage {
  kind: 'collision';
  events: CollisionEvent[];
}

export interface PredictionMessage {
  kind: 'prediction';
  id: number;
  points: Float32Array; // n * STRIDE
}

export interface PongMessage {
  kind: 'pong';
}

export type PhysicsOutbound =
  | BodiesMessage
  | SnapshotMessage
  | CollisionMessage
  | PredictionMessage
  | PongMessage;
