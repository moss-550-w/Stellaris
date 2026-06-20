/**
 * 物理仿真层 —— 主线程 ↔ Worker 通信协议（阶段二：动态沙盒）
 *
 * 关键变更：天体集合可动态增删（编辑/碰撞），引入稳定 id 体系。
 * 渲染端按 id 维护 mesh 映射，由 BodiesMessage 增删、SnapshotMessage 更新位置。
 * 所有跨线程消息均为可结构化克隆/转移的纯数据。
 */

/** 每个天体在缓冲中占用的分量数 (x, y, z) */
export const STRIDE = 3;

export type BodyType = 'star' | 'rocky' | 'gas' | 'blackhole' | 'spacecraft';

/** 积分精度档：fluid = 流畅(半隐式欧拉)，standard = 标准(velocity Verlet) */
export type IntegrationMode = 'fluid' | 'standard';

/**
 * 航天器推力模式（V2.0 阶段六）：
 * off = 不推进；prograde = 顺行加速（沿速度方向）；retrograde = 逆行减速（反速度方向）。
 */
export type ThrustMode = 'off' | 'prograde' | 'retrograde';

/**
 * 演化阶段（V2.0 阶段五）。
 * 恒星：main_sequence → red_giant → {white_dwarf | neutron_star | black_hole}；
 * supernova 为瞬态闪现阶段；none 表示非恒星（不演化）。
 */
export type EvolutionStage =
  | 'none'
  | 'main_sequence'
  | 'red_giant'
  | 'supernova'
  | 'white_dwarf'
  | 'neutron_star'
  | 'black_hole';

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
  /** 演化年龄（演化时钟，年）。可选——旧存档/新建默认 0 */
  age?: number;
  /** 演化阶段。可选——旧存档默认按类型推断 */
  stage?: EvolutionStage;
  /** 主序基准半径（演化各阶段以此为基缩放）。可选——默认等于 radius */
  baseRadius?: number;
  // —— 航天器字段（V2.0 阶段六），仅 spacecraft 使用 ——
  /** 剩余燃料（以 Δv 预算计，AU/年）。可选——默认 0 */
  fuel?: number;
  /** 推力加速度大小（AU/年²）。可选——默认 0 */
  maxThrust?: number;
  /** 当前推力模式。可选——默认 'off' */
  thrustMode?: ThrustMode;
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
  /** 演化阶段（渲染按此切换外观） */
  stage: EvolutionStage;
  /** 演化年龄（年） */
  age: number;
  /** 剩余寿命（年，−1 表示稳定/不再演化），供信息卡展示 */
  remainingLife: number;
  // —— 航天器（V2.0 阶段六）——
  /** 剩余燃料（Δv 预算，AU/年）；非航天器为 0 */
  fuel: number;
  /** 满燃料量（用于 UI 进度条）；非航天器为 0 */
  fuelCapacity: number;
  /** 当前推力模式 */
  thrustMode: ThrustMode;
}

/** 可编辑字段补丁 */
export type BodyPatch = Partial<Omit<SerializedBody, 'id' | 'seed'>>;

/** 完整世界状态（撤销/重做与存档的单位） */
export interface WorldState {
  bodies: SerializedBody[];
  simYears: number;
  nextId: number;
  rngState: number;
  /** 演化倍率（独立于物理 timeScale）。可选——旧存档默认 1 */
  evolutionScale?: number;
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

/** 演化阶段跃迁事件（供特效/提示），V2.0 阶段五 */
export interface EvolutionEvent {
  id: number;
  from: EvolutionStage;
  to: EvolutionStage;
  /** 是否伴随超新星爆发（大质量恒星走向遗骸时），用于触发爆发特效 */
  supernova: boolean;
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
  | { type: 'setEvolutionScale'; scale: number }
  | { type: 'setShipControl'; id: number; thrustMode: ThrustMode }
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
  /** 各天体剩余燃料（count，非航天器为 0），供 UI 实时燃料条 */
  fuels: Float32Array;
}

export interface CollisionMessage {
  kind: 'collision';
  events: CollisionEvent[];
}

export interface EvolutionMessage {
  kind: 'evolution';
  events: EvolutionEvent[];
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
  | EvolutionMessage
  | PredictionMessage
  | PongMessage;
