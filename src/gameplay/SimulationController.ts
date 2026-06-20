/**
 * 玩法交互层 —— 仿真编排控制器
 *
 * 统筹渲染表现层(SceneRenderer)、物理仿真层(PhysicsBridge)与感知时间状态：
 * - 由预设构建场景对象并初始化 Worker；
 * - 每渲染帧基于「最新快照 + 速度」做一阶外推，消除 Worker 通信延迟与帧率差；
 * - 维护轨迹线、FPS 与对 UI 的响应式状态。
 */
import * as THREE from 'three';
import { reactive } from 'vue';
import { SceneRenderer } from '@/renderer/SceneRenderer';
import { createStar, createPlanet, createStarfield } from '@/renderer/CelestialFactory';
import { PhysicsBridge } from '@/physics/bridge';
import type { PhysicsOutbound, PhysicsSnapshot } from '@/physics/types';
import { STRIDE } from '@/physics/types';
import { SOLAR_PRESET, buildInitData, type BodySpec } from './presets';
import { TIME_SCALES, DEFAULT_SCALE_INDEX, realSecondsToSimYears } from '@/core/time';

export interface SimUIState {
  systemName: string;
  simYears: number;
  scaleIndex: number;
  timeScale: number;
  detailOmitted: boolean;
  connected: boolean;
  fps: number;
}

const TRAIL_MAX_POINTS = 220;
/** 外推用的真实时间上限（秒），防止切后台后位置飞出 */
const MAX_EXTRAPOLATE_SECONDS = 0.05;

export class SimulationController {
  readonly ui: SimUIState;

  private readonly renderer: SceneRenderer;
  private readonly bridge: PhysicsBridge;
  private readonly specs: BodySpec[];
  private readonly bodies: THREE.Object3D[] = [];

  // 轨迹线（仅行星，索引对齐 specs[1..]）
  private readonly trailGeoms: THREE.BufferGeometry[] = [];
  private readonly trailData: Float32Array[] = [];
  private readonly trailCounts: number[] = [];

  private latest: PhysicsSnapshot | null = null;
  private latestRecvReal = 0;

  // FPS 统计
  private fpsFrames = 0;
  private fpsElapsed = 0;

  constructor(container: HTMLElement, ui?: SimUIState) {
    this.specs = SOLAR_PRESET.bodies;
    this.ui =
      ui ??
      reactive<SimUIState>({
        systemName: SOLAR_PRESET.name,
        simYears: 0,
        scaleIndex: DEFAULT_SCALE_INDEX,
        timeScale: TIME_SCALES[DEFAULT_SCALE_INDEX],
        detailOmitted: false,
        connected: false,
        fps: 0,
      });
    this.ui.systemName = SOLAR_PRESET.name;

    this.renderer = new SceneRenderer(container);
    this.buildScene();

    this.bridge = new PhysicsBridge((msg) => this.onMessage(msg));
    const init = buildInitData(SOLAR_PRESET);
    this.bridge.send({ type: 'init', data: init }, [
      init.masses.buffer,
      init.positions.buffer,
      init.velocities.buffer,
    ]);
    this.bridge.send({ type: 'ping' });

    this.renderer.setOnFrame((dt) => this.onFrame(dt));
    this.renderer.start();

    // 默认以 1× 开始运行
    this.setScaleIndex(DEFAULT_SCALE_INDEX);
  }

  private buildScene(): void {
    const scene = this.renderer.scene;
    scene.add(createStarfield());
    scene.add(new THREE.AmbientLight(0x223044, 0.6)); // 极弱补光，避免暗面纯黑

    this.specs.forEach((spec, i) => {
      if (spec.type === 'star') {
        const star = createStar(spec);
        scene.add(star.group);
        this.bodies[i] = star.group;
      } else {
        const planet = createPlanet(spec);
        scene.add(planet);
        this.bodies[i] = planet;
        this.initTrail(spec);
      }
    });
  }

  private initTrail(spec: BodySpec): void {
    const data = new Float32Array(TRAIL_MAX_POINTS * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
    geometry.setDrawRange(0, 0);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.renderer.scene.add(line);
    this.trailGeoms.push(geometry);
    this.trailData.push(data);
    this.trailCounts.push(0);
  }

  private onMessage(msg: PhysicsOutbound): void {
    if (msg.kind === 'pong') {
      this.ui.connected = true;
      return;
    }
    // snapshot
    this.latest = msg;
    this.latestRecvReal = performance.now();
    this.ui.simYears = msg.simYears;
    this.ui.detailOmitted = msg.detailOmitted;
    this.pushTrails(msg);
  }

  /** 以快照原始位置推进轨迹（稳定、无外推抖动） */
  private pushTrails(snap: PhysicsSnapshot): void {
    let trailIdx = 0;
    for (let i = 0; i < this.specs.length; i++) {
      if (this.specs[i].type === 'star') continue;
      const base = i * STRIDE;
      this.appendTrailPoint(
        trailIdx,
        snap.positions[base],
        snap.positions[base + 1],
        snap.positions[base + 2],
      );
      trailIdx++;
    }
  }

  private appendTrailPoint(t: number, x: number, y: number, z: number): void {
    const data = this.trailData[t];
    let count = this.trailCounts[t];
    if (count >= TRAIL_MAX_POINTS) {
      data.copyWithin(0, 3); // 整体左移一个点
      count = TRAIL_MAX_POINTS - 1;
    }
    const o = count * 3;
    data[o] = x;
    data[o + 1] = y;
    data[o + 2] = z;
    count++;
    this.trailCounts[t] = count;
    const geom = this.trailGeoms[t];
    geom.setDrawRange(0, count);
    (geom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private onFrame(dt: number): void {
    this.updateFps(dt);
    if (!this.latest) return;

    const snap = this.latest;
    let elapsedReal = (performance.now() - this.latestRecvReal) / 1000;
    if (elapsedReal > MAX_EXTRAPOLATE_SECONDS) elapsedReal = MAX_EXTRAPOLATE_SECONDS;
    const elapsedSim = this.ui.timeScale > 0 ? realSecondsToSimYears(elapsedReal, this.ui.timeScale) : 0;

    for (let i = 0; i < this.bodies.length; i++) {
      const obj = this.bodies[i];
      if (!obj) continue;
      const base = i * STRIDE;
      // 一阶外推：pos + vel * Δt_sim
      obj.position.set(
        snap.positions[base] + snap.velocities[base] * elapsedSim,
        snap.positions[base + 1] + snap.velocities[base + 1] * elapsedSim,
        snap.positions[base + 2] + snap.velocities[base + 2] * elapsedSim,
      );
    }
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

  /** 切换调速档位（0 档暂停物理循环） */
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

  dispose(): void {
    this.bridge.dispose();
    this.renderer.dispose();
  }
}
