/**
 * 物理仿真层 —— 世界状态（动态天体集合）
 *
 * 权威状态源：所有天体的物理量与渲染元数据均以此为准，撤销/重做与存档皆基于其序列化。
 * 存储采用「扁平 Float64 缓冲 + 平行元数据数组」，积分热路径零分配；
 * 增删用 swap-remove（O(1)，顺序无关因有稳定 id）。
 */
import { PRNG } from '@/core/prng';
import { computeAccelerations, verletStep, semiImplicitEulerStep } from './integrator';
import { classifyCollision } from './collision';
import {
  stageFor,
  remainingLife,
  appearanceFor,
  goesSupernova,
} from './evolution';
import type {
  BodyMeta,
  BodyPatch,
  BodyType,
  CollisionEvent,
  EvolutionEvent,
  EvolutionStage,
  IntegrationMode,
  NewBody,
  SerializedBody,
  ThrustMode,
  WorldState,
} from './types';
import { STRIDE } from './types';

/** 初始阶段：恒星从主序起，其它类型不演化 */
function initialStage(type: BodyType): EvolutionStage {
  return type === 'star' ? 'main_sequence' : 'none';
}

const INITIAL_CAPACITY = 64;

/** 航天器满油全推力可持续燃烧时长（演化年），决定总 Δv = maxThrust × 此值 */
const FULL_BURN_YEARS = 0.6;

/** 按质量加权混合两个颜色（0xRRGGBB） */
function mixColor(c1: number, w1: number, c2: number, w2: number): number {
  const t = w2 / (w1 + w2);
  const r = Math.round(((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t);
  const g = Math.round(((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t);
  const b = Math.round((c1 & 255) * (1 - t) + (c2 & 255) * t);
  return (r << 16) | (g << 8) | b;
}

/** 体积守恒合成半径：r = (r1³ + r2³)^(1/3) */
function combinedRadius(r1: number, r2: number): number {
  return Math.cbrt(r1 * r1 * r1 + r2 * r2 * r2);
}

export class World {
  positions: Float64Array;
  velocities: Float64Array;
  masses: Float64Array;
  radii: Float64Array;
  ids: Int32Array;
  types: BodyType[] = [];
  colors: number[] = [];
  seeds: number[] = [];
  // 演化状态（平行数组，V2.0 阶段五）
  ages: number[] = [];
  stages: EvolutionStage[] = [];
  baseRadii: number[] = [];
  // 航天器状态（平行数组，V2.0 阶段六）。非航天器：fuel=0、maxThrust=0、thrustMode='off'
  fuels: number[] = [];
  fuelCapacities: number[] = [];
  maxThrusts: number[] = [];
  thrustModes: ThrustMode[] = [];

  count = 0;
  capacity: number;
  nextId = 1;
  simYears = 0;
  mode: IntegrationMode = 'fluid';
  evolutionScale = 1;
  readonly rng = new PRNG(0x9e3779b9);

  private accOld: Float64Array;
  private accNew: Float64Array;

  constructor() {
    this.capacity = INITIAL_CAPACITY;
    const c3 = this.capacity * STRIDE;
    this.positions = new Float64Array(c3);
    this.velocities = new Float64Array(c3);
    this.masses = new Float64Array(this.capacity);
    this.radii = new Float64Array(this.capacity);
    this.ids = new Int32Array(this.capacity);
    this.accOld = new Float64Array(c3);
    this.accNew = new Float64Array(c3);
  }

  private ensureCapacity(n: number): void {
    if (n <= this.capacity) return;
    let cap = this.capacity;
    while (cap < n) cap *= 2;
    const c3 = cap * STRIDE;
    const grow3 = (src: Float64Array): Float64Array => {
      const dst = new Float64Array(c3);
      dst.set(src);
      return dst;
    };
    this.positions = grow3(this.positions);
    this.velocities = grow3(this.velocities);
    this.accOld = grow3(this.accOld);
    this.accNew = grow3(this.accNew);
    const grow1 = (src: Float64Array): Float64Array => {
      const dst = new Float64Array(cap);
      dst.set(src);
      return dst;
    };
    this.masses = grow1(this.masses);
    this.radii = grow1(this.radii);
    const ids = new Int32Array(cap);
    ids.set(this.ids);
    this.ids = ids;
    this.capacity = cap;
  }

  indexOf(id: number): number {
    for (let i = 0; i < this.count; i++) if (this.ids[i] === id) return i;
    return -1;
  }

  addBody(b: NewBody): number {
    this.ensureCapacity(this.count + 1);
    const i = this.count;
    const o = i * STRIDE;
    this.positions[o] = b.x;
    this.positions[o + 1] = b.y;
    this.positions[o + 2] = b.z;
    this.velocities[o] = b.vx;
    this.velocities[o + 1] = b.vy;
    this.velocities[o + 2] = b.vz;
    this.masses[i] = b.mass;
    this.radii[i] = b.radius;
    const id = this.nextId++;
    this.ids[i] = id;
    this.types[i] = b.type;
    this.colors[i] = b.color;
    this.seeds[i] = b.seed;
    this.ages[i] = b.age ?? 0;
    this.stages[i] = b.stage ?? initialStage(b.type);
    this.baseRadii[i] = b.baseRadius ?? b.radius;
    this.maxThrusts[i] = b.maxThrust ?? 0;
    this.fuelCapacities[i] = (b.maxThrust ?? 0) * FULL_BURN_YEARS;
    this.fuels[i] = b.fuel ?? this.fuelCapacities[i];
    this.thrustModes[i] = b.thrustMode ?? 'off';
    this.count++;
    this.recomputeAcc();
    return id;
  }

  removeById(id: number): boolean {
    const i = this.indexOf(id);
    if (i < 0) return false;
    this.removeAt(i);
    this.recomputeAcc();
    return true;
  }

  private removeAt(i: number): void {
    const last = this.count - 1;
    if (i !== last) {
      const oi = i * STRIDE;
      const ol = last * STRIDE;
      for (let k = 0; k < STRIDE; k++) {
        this.positions[oi + k] = this.positions[ol + k];
        this.velocities[oi + k] = this.velocities[ol + k];
      }
      this.masses[i] = this.masses[last];
      this.radii[i] = this.radii[last];
      this.ids[i] = this.ids[last];
      this.types[i] = this.types[last];
      this.colors[i] = this.colors[last];
      this.seeds[i] = this.seeds[last];
      this.ages[i] = this.ages[last];
      this.stages[i] = this.stages[last];
      this.baseRadii[i] = this.baseRadii[last];
      this.fuels[i] = this.fuels[last];
      this.fuelCapacities[i] = this.fuelCapacities[last];
      this.maxThrusts[i] = this.maxThrusts[last];
      this.thrustModes[i] = this.thrustModes[last];
    }
    this.count = last;
    this.types.length = last;
    this.colors.length = last;
    this.seeds.length = last;
    this.ages.length = last;
    this.stages.length = last;
    this.baseRadii.length = last;
    this.fuels.length = last;
    this.fuelCapacities.length = last;
    this.maxThrusts.length = last;
    this.thrustModes.length = last;
  }

  editBody(id: number, patch: BodyPatch): boolean {
    const i = this.indexOf(id);
    if (i < 0) return false;
    const o = i * STRIDE;
    if (patch.x !== undefined) this.positions[o] = patch.x;
    if (patch.y !== undefined) this.positions[o + 1] = patch.y;
    if (patch.z !== undefined) this.positions[o + 2] = patch.z;
    if (patch.vx !== undefined) this.velocities[o] = patch.vx;
    if (patch.vy !== undefined) this.velocities[o + 1] = patch.vy;
    if (patch.vz !== undefined) this.velocities[o + 2] = patch.vz;
    if (patch.mass !== undefined) this.masses[i] = patch.mass;
    if (patch.radius !== undefined) {
      this.radii[i] = patch.radius;
      this.baseRadii[i] = patch.radius; // 手动改半径即重设演化基准
    }
    if (patch.type !== undefined) {
      this.types[i] = patch.type;
      // 切换为/离开恒星时重置演化状态
      this.stages[i] = initialStage(patch.type);
      this.ages[i] = 0;
    }
    if (patch.color !== undefined) this.colors[i] = patch.color;
    this.recomputeAcc();
    return true;
  }

  recomputeAcc(): void {
    computeAccelerations(this.positions, this.masses, this.count, this.accOld);
  }

  /** 推进一个物理步（按当前精度档选择积分器），随后施加航天器推力冲量 */
  step(dt: number): void {
    if (this.mode === 'standard') {
      verletStep(this.positions, this.velocities, this.masses, this.count, dt, this.accOld, this.accNew);
    } else {
      semiImplicitEulerStep(this.positions, this.velocities, this.masses, this.count, dt, this.accOld);
    }
    this.applyThrust(dt);
  }

  /**
   * 航天器推力：在引力步进之后以冲量方式施加（与 Verlet 引力积分解耦）。
   * prograde 沿当前速度方向、retrograde 反向；Δv = maxThrust × throttle × dt，燃料按 Δv 等量消耗。
   * 航天器 mass≈0 为测试粒子，推力不影响其它天体。
   */
  private applyThrust(dt: number): void {
    for (let i = 0; i < this.count; i++) {
      const mode = this.thrustModes[i];
      if (mode === 'off') continue;
      if (this.fuels[i] <= 0) {
        this.thrustModes[i] = 'off';
        continue;
      }
      const o = i * STRIDE;
      const vx = this.velocities[o];
      const vy = this.velocities[o + 1];
      const vz = this.velocities[o + 2];
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (speed < 1e-9) continue; // 速度为零无方向可循

      let dv = this.maxThrusts[i] * dt;
      if (dv > this.fuels[i]) dv = this.fuels[i]; // 燃料不足，烧到耗尽
      this.fuels[i] -= dv;

      const sign = mode === 'prograde' ? 1 : -1;
      const k = (sign * dv) / speed;
      this.velocities[o] = vx + vx * k;
      this.velocities[o + 1] = vy + vy * k;
      this.velocities[o + 2] = vz + vz * k;

      if (this.fuels[i] <= 0) this.thrustModes[i] = 'off';
    }
  }

  /** 设置航天器推力模式 */
  setShipControl(id: number, mode: ThrustMode): boolean {
    const i = this.indexOf(id);
    if (i < 0 || this.types[i] !== 'spacecraft') return false;
    this.thrustModes[i] = this.fuels[i] > 0 ? mode : 'off';
    return true;
  }

  setMode(mode: IntegrationMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.recomputeAcc(); // 切档后重置 Verlet 所需的当前加速度
  }

  /**
   * 演化步进：按 dtYears（已乘演化倍率）推进每颗恒星年龄，检测阶段跃迁并应用外观。
   * 阶段跃迁为**原子**操作（直接落定到目标阶段），不引入瞬态 body 状态，
   * 从而对碰撞 swap-remove 索引变化天然安全。超新星通过事件 supernova 标记触发爆发特效。
   * 返回本步发生的跃迁事件。
   */
  evolveStep(dtYears: number): EvolutionEvent[] {
    if (dtYears <= 0) return [];
    const events: EvolutionEvent[] = [];

    for (let i = 0; i < this.count; i++) {
      const stage = this.stages[i];
      // 非恒星、或已到稳定遗骸阶段：不推进
      if (stage !== 'main_sequence' && stage !== 'red_giant') continue;

      this.ages[i] += dtYears;
      const next = stageFor(this.masses[i], this.ages[i]);
      if (next === stage) continue;

      const isRemnant = next === 'white_dwarf' || next === 'neutron_star' || next === 'black_hole';
      const supernova = isRemnant && goesSupernova(this.masses[i]);
      this.applyStage(i, next);
      events.push(this.makeEvent(i, stage, next, supernova));
    }
    return events;
  }

  /** 应用阶段外观（半径/颜色/类型） */
  private applyStage(i: number, stage: EvolutionStage): void {
    const look = appearanceFor(stage);
    this.stages[i] = stage;
    this.radii[i] = this.baseRadii[i] * look.radiusScale;
    if (look.color !== undefined) this.colors[i] = look.color;
    if (look.type !== undefined) this.types[i] = look.type;
  }

  private makeEvent(i: number, from: EvolutionStage, to: EvolutionStage, supernova: boolean): EvolutionEvent {
    const o = i * STRIDE;
    return {
      id: this.ids[i],
      from,
      to,
      supernova,
      x: this.positions[o],
      y: this.positions[o + 1],
      z: this.positions[o + 2],
      radius: this.radii[i],
      color: this.colors[i],
    };
  }

  /**
   * 检测并处理碰撞。每次调用至多处理一对（处理后集合结构改变，下个 tick 继续），
   * 保证双重循环索引安全且行为稳定。
   */
  handleCollisions(): CollisionEvent[] {
    for (let i = 0; i < this.count; i++) {
      const oi = i * STRIDE;
      for (let j = i + 1; j < this.count; j++) {
        const oj = j * STRIDE;
        const dx = this.positions[oj] - this.positions[oi];
        const dy = this.positions[oj + 1] - this.positions[oi + 1];
        const dz = this.positions[oj + 2] - this.positions[oi + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const contact = this.radii[i] + this.radii[j];
        if (dist >= contact) continue;

        const dvx = this.velocities[oj] - this.velocities[oi];
        const dvy = this.velocities[oj + 1] - this.velocities[oi + 1];
        const dvz = this.velocities[oj + 2] - this.velocities[oi + 2];
        const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
        const totalMass = this.masses[i] + this.masses[j];
        const outcome = classifyCollision(relSpeed, totalMass, contact, this.types[i], this.types[j]);

        const event = this.resolveCollision(i, j, outcome);
        this.recomputeAcc();
        return [event];
      }
    }
    return [];
  }

  private resolveCollision(i: number, j: number, outcome: 'merge' | 'tear' | 'destroy'): CollisionEvent {
    // 令 a = 质量较大者，b = 较小者
    let a = i;
    let b = j;
    if (this.masses[b] > this.masses[a]) [a, b] = [b, a];
    const oa = a * STRIDE;
    const ob = b * STRIDE;
    const ma = this.masses[a];
    const mb = this.masses[b];
    const cx = this.positions[ob];
    const cy = this.positions[ob + 1];
    const cz = this.positions[ob + 2];
    const starInvolved = this.types[i] === 'star' || this.types[j] === 'star';

    if (outcome === 'merge') {
      const m = ma + mb;
      // 动量守恒
      for (let k = 0; k < STRIDE; k++) {
        this.velocities[oa + k] = (this.velocities[oa + k] * ma + this.velocities[ob + k] * mb) / m;
        this.positions[oa + k] = (this.positions[oa + k] * ma + this.positions[ob + k] * mb) / m;
      }
      this.masses[a] = m;
      this.radii[a] = combinedRadius(this.radii[a], this.radii[b]);
      this.colors[a] = mixColor(this.colors[a], ma, this.colors[b], mb);
      // 类型优先级：黑洞 > 恒星 > 其它
      if (this.types[a] === 'blackhole' || this.types[b] === 'blackhole') this.types[a] = 'blackhole';
      else if (this.types[b] === 'star') this.types[a] = 'star';
      this.removeAt(b);
      return { kind: 'merge', x: cx, y: cy, z: cz, radius: this.radii[a], color: this.colors[a] };
    }

    if (outcome === 'tear') {
      // 中速撕裂：较大者吸收较小者 70% 质量，其余化为尘埃（阶段三补碎片场）
      const absorbed = mb * 0.7;
      const m = ma + absorbed;
      for (let k = 0; k < STRIDE; k++) {
        this.velocities[oa + k] = (this.velocities[oa + k] * ma + this.velocities[ob + k] * absorbed) / m;
      }
      const smallRadius = this.radii[b];
      const smallColor = this.colors[b];
      this.masses[a] = m;
      this.radii[a] = combinedRadius(this.radii[a], smallRadius * 0.7);
      this.removeAt(b);
      return { kind: 'tear', x: cx, y: cy, z: cz, radius: smallRadius, color: smallColor };
    }

    // destroy：两者皆毁；恒星参与则为超新星
    const color = mixColor(this.colors[a], ma, this.colors[b], mb);
    const radius = Math.max(this.radii[a], this.radii[b]) * 1.5;
    // 先删大索引，保证 swap-remove 安全
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    this.removeAt(hi);
    this.removeAt(lo);
    return {
      kind: starInvolved ? 'supernova' : 'destroy',
      x: cx,
      y: cy,
      z: cz,
      radius,
      color: starInvolved ? 0xfff0c0 : color,
    };
  }

  load(state: WorldState): void {
    this.ensureCapacity(Math.max(state.bodies.length, INITIAL_CAPACITY));
    this.count = 0;
    this.types.length = 0;
    this.colors.length = 0;
    this.seeds.length = 0;
    this.ages.length = 0;
    this.stages.length = 0;
    this.baseRadii.length = 0;
    this.fuels.length = 0;
    this.fuelCapacities.length = 0;
    this.maxThrusts.length = 0;
    this.thrustModes.length = 0;
    for (const b of state.bodies) {
      const i = this.count;
      const o = i * STRIDE;
      this.positions[o] = b.x;
      this.positions[o + 1] = b.y;
      this.positions[o + 2] = b.z;
      this.velocities[o] = b.vx;
      this.velocities[o + 1] = b.vy;
      this.velocities[o + 2] = b.vz;
      this.masses[i] = b.mass;
      this.radii[i] = b.radius;
      this.ids[i] = b.id;
      this.types[i] = b.type;
      this.colors[i] = b.color;
      this.seeds[i] = b.seed;
      // 演化字段：旧存档（V1.0，无这些字段）补默认，向下兼容
      this.ages[i] = b.age ?? 0;
      this.stages[i] = b.stage ?? initialStage(b.type);
      this.baseRadii[i] = b.baseRadius ?? b.radius;
      // 航天器字段（V2.0 阶段六）：旧存档无 → 默认 0/off
      this.maxThrusts[i] = b.maxThrust ?? 0;
      this.fuelCapacities[i] = (b.maxThrust ?? 0) * FULL_BURN_YEARS;
      this.fuels[i] = b.fuel ?? this.fuelCapacities[i];
      this.thrustModes[i] = b.thrustMode ?? 'off';
      this.count++;
    }
    this.simYears = state.simYears;
    this.nextId = state.nextId;
    this.evolutionScale = state.evolutionScale ?? 1;
    this.rng.setState(state.rngState);
    this.recomputeAcc();
  }

  serialize(): WorldState {
    const bodies: SerializedBody[] = [];
    for (let i = 0; i < this.count; i++) {
      const o = i * STRIDE;
      bodies.push({
        id: this.ids[i],
        type: this.types[i],
        mass: this.masses[i],
        radius: this.radii[i],
        color: this.colors[i],
        seed: this.seeds[i],
        x: this.positions[o],
        y: this.positions[o + 1],
        z: this.positions[o + 2],
        vx: this.velocities[o],
        vy: this.velocities[o + 1],
        vz: this.velocities[o + 2],
        age: this.ages[i],
        stage: this.stages[i],
        baseRadius: this.baseRadii[i],
        fuel: this.fuels[i],
        maxThrust: this.maxThrusts[i],
        thrustMode: this.thrustModes[i],
      });
    }
    return {
      bodies,
      simYears: this.simYears,
      nextId: this.nextId,
      rngState: this.rng.getState(),
      evolutionScale: this.evolutionScale,
    };
  }

  metas(): BodyMeta[] {
    const out: BodyMeta[] = [];
    for (let i = 0; i < this.count; i++) {
      const stage = this.stages[i];
      out.push({
        id: this.ids[i],
        type: this.types[i],
        mass: this.masses[i],
        radius: this.radii[i],
        color: this.colors[i],
        seed: this.seeds[i],
        stage,
        age: this.ages[i],
        remainingLife: remainingLife(this.masses[i], this.ages[i], stage),
        fuel: this.fuels[i],
        fuelCapacity: this.fuelCapacities[i],
        thrustMode: this.thrustModes[i],
      });
    }
    return out;
  }
}

/**
 * 轨道预测：在当前状态副本上前瞻积分，采样目标天体未来轨迹（忽略碰撞，短期足够准）。
 */
export function predictTrajectory(src: World, id: number, years: number, samples: number, dt: number): Float32Array {
  const targetIdx = src.indexOf(id);
  if (targetIdx < 0) return new Float32Array(0);

  const count = src.count;
  const positions = src.positions.slice(0, count * STRIDE);
  const velocities = src.velocities.slice(0, count * STRIDE);
  const masses = src.masses.slice(0, count);
  const accOld = new Float64Array(count * STRIDE);
  const accNew = new Float64Array(count * STRIDE);
  computeAccelerations(positions, masses, count, accOld);

  const total = Math.max(1, Math.round(years / dt));
  const every = Math.max(1, Math.floor(total / samples));
  const out: number[] = [];
  const to = targetIdx * STRIDE;

  for (let step = 0; step < total; step++) {
    verletStep(positions, velocities, masses, count, dt, accOld, accNew);
    if (step % every === 0) {
      out.push(positions[to], positions[to + 1], positions[to + 2]);
    }
  }
  return new Float32Array(out);
}
