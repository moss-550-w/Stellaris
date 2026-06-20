/**
 * 玩法交互层 —— 仿真编排控制器（阶段三：视觉与玩法）
 *
 * 统筹渲染表现层、物理仿真层与交互状态：
 * - 按 id 增量同步 mesh/trail（处理增删/碰撞/编辑/撤销）；
 * - 每帧基于「最新快照 + 速度」一阶外推；
 * - raycaster 点击拾取 → 选中、轨道预测、能量计；
 * - 引力透镜参数计算、宜居带环、成就/挑战评估；
 * - 碰撞特效、FPS、画质分档、对 UI 的响应式状态。
 */
import * as THREE from 'three';
import { SceneRenderer } from '@/renderer/SceneRenderer';
import { createBody, createStarfield } from '@/renderer/CelestialFactory';
import { CollisionEffects } from '@/renderer/effects';
import { HabitableRing } from '@/renderer/HabitableRing';
import { RenderOrder } from '@/renderer/renderLayers';
import { PhysicsBridge } from '@/physics/bridge';
import type {
  BodyMeta,
  BodyPatch,
  IntegrationMode,
  PhysicsOutbound,
  SnapshotMessage,
  SerializedBody,
  WorldState,
} from '@/physics/types';
import { STRIDE } from '@/physics/types';
import { PRESETS, buildPreset, makeDefaultBody } from './presets';
import { TIME_SCALES, DEFAULT_SCALE_INDEX, realSecondsToSimYears } from '@/core/time';
import { habitableZone } from './habitableZone';
import { EnergyMeter, type EnergyReading } from './energyMeter';
import { getChallenge, type BodyView, type ChallengeResult } from './challenges';
import { QUALITY_PROFILES, type QualityLevel } from '@/store/settings';

/** 引力透镜：正对黑洞夹角阈值（度），小于此角启用全屏偏折 */
const LENS_FULL_ANGLE_DEG = 15;

export interface SelectedInfo {
  id: number;
  type: string;
  mass: number;
  radius: number;
  color: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
}

export interface SimUIState {
  presetKey: string;
  simYears: number;
  scaleIndex: number;
  timeScale: number;
  detailOmitted: boolean;
  connected: boolean;
  fps: number;
  mode: IntegrationMode;
  count: number;
  canUndo: boolean;
  canRedo: boolean;
  selectedId: number | null;
  selected: SelectedInfo | null;
  quality: QualityLevel;
  energy: EnergyReading | null;
  challengeKey: string | null;
  challenge: ChallengeResult | null;
}

const TRAIL_MAX_POINTS = 220;
const MAX_EXTRAPOLATE_SECONDS = 0.05;
const PREDICT_YEARS = 2.5;
const PREDICT_SAMPLES = 120;
const PREDICT_INTERVAL = 0.5; // 秒

interface Trail {
  line: THREE.Line;
  data: Float32Array;
  count: number;
}

export class SimulationController {
  readonly ui: SimUIState;

  private readonly renderer: SceneRenderer;
  private readonly bridge: PhysicsBridge;
  private readonly effects: CollisionEffects;
  private readonly habitableRing: HabitableRing;
  private readonly energyMeter = new EnergyMeter();

  private readonly metaMap = new Map<number, BodyMeta>();
  private readonly meshMap = new Map<number, THREE.Object3D>();
  private readonly trailMap = new Map<number, Trail>();

  private latest: SnapshotMessage | null = null;
  private latestRecvReal = 0;
  private readonly idIndex = new Map<number, number>();

  private selection: THREE.Mesh;
  private predictionLine: THREE.Line;
  private predictAccum = 0;

  // 复用临时对象，避免每帧分配
  private readonly tmpProj = new THREE.Vector3();
  private readonly tmpLensCenter = new THREE.Vector2(0.5, 0.5);

  private nextSeed = 1000;
  private fpsFrames = 0;
  private fpsElapsed = 0;

  private readonly onPointerDown = (e: PointerEvent): void => this.handlePointerDown(e);
  private readonly onPointerUp = (e: PointerEvent): void => this.handlePointerUp(e);
  private downX = 0;
  private downY = 0;

  constructor(container: HTMLElement, ui: SimUIState) {
    this.ui = ui;
    this.renderer = new SceneRenderer(container);
    this.effects = new CollisionEffects(this.renderer.scene);

    this.renderer.scene.add(createStarfield(QUALITY_PROFILES[this.ui.quality].starCount));
    this.renderer.scene.add(new THREE.AmbientLight(0x223044, 0.6));
    this.renderer.setQuality(this.ui.quality);

    // 宜居带环
    this.habitableRing = new HabitableRing();
    this.renderer.scene.add(this.habitableRing.mesh);

    // 选中指示器（线框球，跟随选中天体）
    this.selection = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x88ccff, wireframe: true, transparent: true, opacity: 0.5 }),
    );
    this.selection.visible = false;
    this.selection.renderOrder = RenderOrder.RANGE_SPHERE;
    this.renderer.scene.add(this.selection);

    // 轨道预测线
    this.predictionLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0x88ccff, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.7 }),
    );
    this.predictionLine.visible = false;
    this.predictionLine.renderOrder = RenderOrder.ORBIT_LINE;
    this.renderer.scene.add(this.predictionLine);

    this.bridge = new PhysicsBridge((msg) => this.onMessage(msg));
    this.bridge.send({ type: 'ping' });
    this.loadPreset(this.ui.presetKey || PRESETS[0].key);

    this.renderer.setOnFrame((dt) => this.onFrame(dt));
    this.renderer.start();

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);

    this.setScaleIndex(DEFAULT_SCALE_INDEX);
  }

  // —— 消息处理 ——

  private onMessage(msg: PhysicsOutbound): void {
    switch (msg.kind) {
      case 'pong':
        this.ui.connected = true;
        break;
      case 'bodies':
        this.syncBodies(msg.metas);
        this.ui.canUndo = msg.canUndo;
        this.ui.canRedo = msg.canRedo;
        this.ui.count = msg.metas.length;
        break;
      case 'snapshot':
        this.onSnapshot(msg);
        break;
      case 'collision':
        for (const ev of msg.events) this.effects.spawn(ev);
        break;
      case 'prediction':
        this.onPrediction(msg.id, msg.points);
        break;
    }
  }

  private onSnapshot(snap: SnapshotMessage): void {
    this.latest = snap;
    this.latestRecvReal = performance.now();
    this.ui.simYears = snap.simYears;
    this.ui.detailOmitted = snap.detailOmitted;
    this.ui.mode = snap.mode;
    this.ui.count = snap.count;

    this.idIndex.clear();
    for (let k = 0; k < snap.count; k++) {
      this.idIndex.set(snap.ids[k], k);
      this.pushTrail(snap.ids[k], snap.positions, k * STRIDE);
    }
  }

  /** 按 id 增量同步可视对象：新增创建、消失移除、外观变更重建 */
  private syncBodies(metas: BodyMeta[]): void {
    const alive = new Set<number>();
    for (const meta of metas) {
      alive.add(meta.id);
      const prev = this.metaMap.get(meta.id);
      this.metaMap.set(meta.id, meta);

      if (!this.meshMap.has(meta.id)) {
        this.addMesh(meta);
      } else if (prev && (prev.radius !== meta.radius || prev.color !== meta.color || prev.type !== meta.type)) {
        // 外观变更：重建 mesh
        this.removeMesh(meta.id, false);
        this.addMesh(meta);
      }
    }
    // 移除已消失天体
    for (const id of [...this.meshMap.keys()]) {
      if (!alive.has(id)) this.removeMesh(id, true);
    }
    // 选中天体已不存在则取消选中
    if (this.ui.selectedId !== null && !alive.has(this.ui.selectedId)) {
      this.selectBody(null);
    }
  }

  private addMesh(meta: BodyMeta): void {
    const { object } = createBody(meta);
    object.userData.id = meta.id;
    this.renderer.scene.add(object);
    this.meshMap.set(meta.id, object);
    this.initTrail(meta);
  }

  private removeMesh(id: number, removeTrail: boolean): void {
    const obj = this.meshMap.get(id);
    if (obj) {
      this.renderer.scene.remove(obj);
      this.meshMap.delete(id);
    }
    if (removeTrail) {
      const trail = this.trailMap.get(id);
      if (trail) {
        this.renderer.scene.remove(trail.line);
        this.trailMap.delete(id);
      }
      this.metaMap.delete(id);
    }
  }

  // —— 轨迹 ——

  private initTrail(meta: BodyMeta): void {
    if (this.trailMap.has(meta.id)) return;
    const data = new Float32Array(TRAIL_MAX_POINTS * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
    geometry.setDrawRange(0, 0);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: meta.color, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    line.renderOrder = RenderOrder.ORBIT_LINE;
    this.renderer.scene.add(line);
    this.trailMap.set(meta.id, { line, data, count: 0 });
  }

  private pushTrail(id: number, positions: Float32Array, offset: number): void {
    const trail = this.trailMap.get(id);
    if (!trail) return;
    let count = trail.count;
    if (count >= TRAIL_MAX_POINTS) {
      trail.data.copyWithin(0, 3);
      count = TRAIL_MAX_POINTS - 1;
    }
    const o = count * 3;
    trail.data[o] = positions[offset];
    trail.data[o + 1] = positions[offset + 1];
    trail.data[o + 2] = positions[offset + 2];
    trail.count = count + 1;
    trail.line.geometry.setDrawRange(0, trail.count);
    (trail.line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  // —— 逐帧 ——

  private onFrame(dt: number): void {
    this.updateFps(dt);
    this.effects.update(dt);

    if (this.latest) {
      const snap = this.latest;
      let elapsedReal = (performance.now() - this.latestRecvReal) / 1000;
      if (elapsedReal > MAX_EXTRAPOLATE_SECONDS) elapsedReal = MAX_EXTRAPOLATE_SECONDS;
      const elapsedSim = this.ui.timeScale > 0 ? realSecondsToSimYears(elapsedReal, this.ui.timeScale) : 0;

      for (const [id, obj] of this.meshMap) {
        const k = this.idIndex.get(id);
        if (k === undefined) continue;
        const base = k * STRIDE;
        obj.position.set(
          snap.positions[base] + snap.velocities[base] * elapsedSim,
          snap.positions[base + 1] + snap.velocities[base + 1] * elapsedSim,
          snap.positions[base + 2] + snap.velocities[base + 2] * elapsedSim,
        );
      }
      this.updateSelectionInfo(snap, elapsedSim);
      this.updateEnergy(snap, dt);
      this.updateHabitableRing(snap, elapsedSim);
      this.updateChallenge(snap, elapsedSim);
    }

    this.updateLens(dt);

    // 周期性刷新选中天体的轨道预测
    if (this.ui.selectedId !== null && this.ui.timeScale > 0) {
      this.predictAccum += dt;
      if (this.predictAccum >= PREDICT_INTERVAL) {
        this.predictAccum = 0;
        this.requestPrediction(this.ui.selectedId);
      }
    }
  }

  /** 引力弹弓能量计：追踪选中天体速率与增益 */
  private updateEnergy(snap: SnapshotMessage, dt: number): void {
    const id = this.ui.selectedId;
    if (id === null) {
      this.ui.energy = null;
      return;
    }
    const k = this.idIndex.get(id);
    if (k === undefined) return;
    const base = k * STRIDE;
    const vx = snap.velocities[base];
    const vy = snap.velocities[base + 1];
    const vz = snap.velocities[base + 2];
    this.ui.energy = this.energyMeter.update(id, Math.sqrt(vx * vx + vy * vy + vz * vz), dt);
  }

  /** 宜居带环：选中天体为恒星时显示其宜居带 */
  private updateHabitableRing(snap: SnapshotMessage, elapsedSim: number): void {
    const id = this.ui.selectedId;
    const meta = id !== null ? this.metaMap.get(id) : undefined;
    if (!meta || meta.type !== 'star') {
      this.habitableRing.hide();
      return;
    }
    const k = this.idIndex.get(id as number);
    if (k === undefined) return;
    const base = k * STRIDE;
    const zone = habitableZone(meta.mass);
    this.tmpProj.set(
      snap.positions[base] + snap.velocities[base] * elapsedSim,
      snap.positions[base + 1] + snap.velocities[base + 1] * elapsedSim,
      snap.positions[base + 2] + snap.velocities[base + 2] * elapsedSim,
    );
    this.habitableRing.show(zone.inner, zone.outer, this.tmpProj);
  }

  /** 引力透镜：取最近黑洞，按相机视线与「相机→黑洞」夹角决定全屏/局部强度 */
  private updateLens(_dt: number): void {
    let bhId: number | null = null;
    for (const [id, meta] of this.metaMap) {
      if (meta.type === 'blackhole' && this.meshMap.has(id)) {
        bhId = id;
        break;
      }
    }
    if (bhId === null) {
      this.renderer.setLens({ active: false, centerUv: this.tmpLensCenter, radius: 0, strength: 0 });
      return;
    }
    const obj = this.meshMap.get(bhId);
    const meta = this.metaMap.get(bhId);
    if (!obj || !meta) return;

    const cam = this.renderer.camera;
    const worldPos = obj.position;
    // 相机视线方向 vs 相机→黑洞方向 的夹角
    const toBh = this.tmpProj.copy(worldPos).sub(cam.position).normalize();
    const forward = new THREE.Vector3();
    cam.getWorldDirection(forward);
    const angleDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(toBh.dot(forward), -1, 1)));

    // 投影到屏幕 UV
    const proj = new THREE.Vector3().copy(worldPos).project(cam);
    if (proj.z > 1) {
      // 在相机背后
      this.renderer.setLens({ active: false, centerUv: this.tmpLensCenter, radius: 0, strength: 0 });
      return;
    }
    const centerUv = this.tmpLensCenter.set((proj.x + 1) / 2, (proj.y + 1) / 2);

    // 夹角 < 15° 全强度，否则随夹角线性衰减至 0（约 45° 截止）—— 屏幕空间近似
    const full = angleDeg < LENS_FULL_ANGLE_DEG;
    const falloff = full ? 1 : Math.max(0, 1 - (angleDeg - LENS_FULL_ANGLE_DEG) / 30);
    const dist = cam.position.distanceTo(worldPos);
    const radius = THREE.MathUtils.clamp((meta.radius * 9) / Math.max(dist, 0.5), 0.08, 0.6);

    this.renderer.setLens({
      active: falloff > 0.01,
      centerUv,
      radius,
      strength: 0.06 * falloff,
    });
  }

  /** 成就/挑战评估（标准模式基准），实时输出进度与中断原因 */
  private updateChallenge(snap: SnapshotMessage, elapsedSim: number): void {
    const key = this.ui.challengeKey;
    if (key === null) {
      this.ui.challenge = null;
      return;
    }
    const challenge = getChallenge(key);
    if (!challenge) return;

    const views: BodyView[] = [];
    for (const [id, meta] of this.metaMap) {
      const k = this.idIndex.get(id);
      if (k === undefined) continue;
      const base = k * STRIDE;
      const vx = snap.velocities[base];
      const vy = snap.velocities[base + 1];
      const vz = snap.velocities[base + 2];
      views.push({
        id,
        type: meta.type,
        mass: meta.mass,
        x: snap.positions[base] + vx * elapsedSim,
        y: snap.positions[base + 1] + vy * elapsedSim,
        z: snap.positions[base + 2] + vz * elapsedSim,
        speed: Math.sqrt(vx * vx + vy * vy + vz * vz),
      });
    }
    this.ui.challenge = challenge.evaluate({ bodies: views, mode: snap.mode, simYears: snap.simYears });
  }

  private updateSelectionInfo(snap: SnapshotMessage, elapsedSim: number): void {
    const id = this.ui.selectedId;
    if (id === null) return;
    const k = this.idIndex.get(id);
    const meta = this.metaMap.get(id);
    if (k === undefined || !meta) return;
    const base = k * STRIDE;
    const x = snap.positions[base] + snap.velocities[base] * elapsedSim;
    const y = snap.positions[base + 1] + snap.velocities[base + 1] * elapsedSim;
    const z = snap.positions[base + 2] + snap.velocities[base + 2] * elapsedSim;
    const vx = snap.velocities[base];
    const vy = snap.velocities[base + 1];
    const vz = snap.velocities[base + 2];

    this.selection.visible = true;
    this.selection.position.set(x, y, z);
    this.selection.scale.setScalar(meta.radius * 1.5);

    this.ui.selected = {
      id,
      type: meta.type,
      mass: meta.mass,
      radius: meta.radius,
      color: meta.color,
      x, y, z, vx, vy, vz,
      speed: Math.sqrt(vx * vx + vy * vy + vz * vz),
    };
  }

  private updateFps(dt: number): void {
    this.fpsFrames++;
    this.fpsElapsed += dt;
    if (this.fpsElapsed >= 0.5) {
      this.ui.fps = Math.round(this.fpsFrames / this.fpsElapsed);
      this.fpsFrames = 0;
      this.fpsElapsed = 0;
    }
  }

  // —— 拾取 ——

  private handlePointerDown(e: PointerEvent): void {
    this.downX = e.clientX;
    this.downY = e.clientY;
  }

  private handlePointerUp(e: PointerEvent): void {
    // 区分点击与拖拽（相机旋转）
    if (Math.abs(e.clientX - this.downX) > 5 || Math.abs(e.clientY - this.downY) > 5) return;

    const el = this.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.renderer.camera);
    const hits = raycaster.intersectObjects([...this.meshMap.values()], true);
    if (hits.length === 0) {
      this.selectBody(null);
      return;
    }
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && obj.userData.id === undefined) obj = obj.parent;
    this.selectBody(obj ? (obj.userData.id as number) : null);
  }

  // —— 对外接口 ——

  selectBody(id: number | null): void {
    this.ui.selectedId = id;
    this.energyMeter.track(id);
    if (id === null) {
      this.ui.selected = null;
      this.ui.energy = null;
      this.selection.visible = false;
      this.predictionLine.visible = false;
      this.habitableRing.hide();
      return;
    }
    this.requestPrediction(id);
  }

  private requestPrediction(id: number): void {
    this.bridge.send({ type: 'predict', id, years: PREDICT_YEARS, samples: PREDICT_SAMPLES });
  }

  private onPrediction(id: number, points: Float32Array): void {
    if (id !== this.ui.selectedId || points.length < 6) {
      return;
    }
    this.predictionLine.geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    this.predictionLine.computeLineDistances();
    this.predictionLine.visible = true;
  }

  loadPreset(key: string): void {
    this.ui.presetKey = key;
    this.selectBody(null);
    this.bridge.send({ type: 'load', state: buildPreset(key) });
    if (this.ui.timeScale > 0) this.bridge.send({ type: 'start' });
  }

  setScaleIndex(index: number): void {
    const scale = TIME_SCALES[index];
    this.ui.scaleIndex = index;
    this.ui.timeScale = scale;
    if (scale <= 0) {
      this.bridge.send({ type: 'pause' });
    } else {
      this.bridge.send({ type: 'setTimeScale', scale });
      this.bridge.send({ type: 'start' });
    }
  }

  setMode(mode: IntegrationMode): void {
    this.ui.mode = mode;
    this.bridge.send({ type: 'setMode', mode });
  }

  setQuality(level: QualityLevel): void {
    this.ui.quality = level;
    this.renderer.setQuality(level);
  }

  setChallenge(key: string | null): void {
    this.ui.challengeKey = key;
    this.ui.challenge = null;
  }

  addBody(): void {
    this.bridge.send({ type: 'addBody', body: makeDefaultBody(this.nextSeed++) });
  }

  removeSelected(): void {
    if (this.ui.selectedId === null) return;
    this.bridge.send({ type: 'removeBody', id: this.ui.selectedId });
    this.selectBody(null);
  }

  editSelected(patch: BodyPatch): void {
    if (this.ui.selectedId === null) return;
    this.bridge.send({ type: 'editBody', id: this.ui.selectedId, patch });
  }

  undo(): void {
    this.bridge.send({ type: 'undo' });
  }

  redo(): void {
    this.bridge.send({ type: 'redo' });
  }

  /** 由最新快照 + 元数据重建完整世界状态，用于存档/导出 */
  getWorldState(): WorldState | null {
    const snap = this.latest;
    if (!snap) return null;
    const bodies: SerializedBody[] = [];
    let maxId = 0;
    for (let k = 0; k < snap.count; k++) {
      const id = snap.ids[k];
      const meta = this.metaMap.get(id);
      if (!meta) continue;
      const base = k * STRIDE;
      bodies.push({
        id,
        type: meta.type,
        mass: meta.mass,
        radius: meta.radius,
        color: meta.color,
        seed: meta.seed,
        x: snap.positions[base],
        y: snap.positions[base + 1],
        z: snap.positions[base + 2],
        vx: snap.velocities[base],
        vy: snap.velocities[base + 1],
        vz: snap.velocities[base + 2],
      });
      if (id > maxId) maxId = id;
    }
    return { bodies, simYears: snap.simYears, nextId: maxId + 1, rngState: 0x9e3779b9 };
  }

  /** 加载外部世界状态（存档/导入） */
  loadState(state: WorldState, presetKey?: string): void {
    if (presetKey) this.ui.presetKey = presetKey;
    this.selectBody(null);
    this.bridge.send({ type: 'load', state });
    if (this.ui.timeScale > 0) this.bridge.send({ type: 'start' });
  }

  /** 抓取当前画面为 PNG dataURL（下一帧渲染后回调） */
  captureScreenshot(): Promise<string> {
    return this.renderer.capture();
  }

  dispose(): void {
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointerup', this.onPointerUp);
    this.bridge.dispose();
    this.renderer.dispose();
  }
}
