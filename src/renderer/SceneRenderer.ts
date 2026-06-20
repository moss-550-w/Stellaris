/**
 * 渲染表现层 —— Three.js 场景渲染器
 *
 * 职责收敛为：场景/相机/渲染器生命周期、自由相机(OrbitControls)、自适应尺寸、主渲染循环。
 * 天体对象的增删与逐帧位置更新交由上层 (SimulationController) 通过 scene 与 onFrame 回调驱动。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type FrameCallback = (deltaSeconds: number) => void;

export class SceneRenderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly container: HTMLElement;
  private readonly clock = new THREE.Clock();
  private rafId = 0;
  private onFrame: FrameCallback | null = null;
  private readonly handleResize = (): void => this.onResize();

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060c); // 深空底色

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.01, 5000);
    this.camera.position.set(4, 3, 7);

    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 200;
    this.controls.target.set(0, 0, 0);

    this.onResize();
    window.addEventListener('resize', this.handleResize);
  }

  /** 暴露画布元素，供上层挂载交互（如 raycaster 拾取） */
  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** 注册逐帧回调（渲染前调用，用于更新天体位置） */
  setOnFrame(cb: FrameCallback): void {
    this.onFrame = cb;
  }

  start(): void {
    const loop = (): void => {
      this.rafId = requestAnimationFrame(loop);
      const dt = this.clock.getDelta();
      this.onFrame?.(dt);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  private onResize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
