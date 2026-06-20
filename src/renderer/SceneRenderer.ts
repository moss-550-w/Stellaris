/**
 * 渲染表现层 —— Three.js 场景渲染器
 *
 * 职责：场景/相机/渲染器生命周期、自由相机(OrbitControls)、自适应尺寸、主渲染循环、
 * 合并后处理(PostProcessor)与画质分档。
 * 天体对象的增删与逐帧位置更新交由上层 (SimulationController) 通过 scene 与 onFrame 回调驱动。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PostProcessor, type LensParams } from './PostProcessor';
import { QUALITY_PROFILES, DEFAULT_QUALITY, type QualityLevel } from '@/store/settings';

export type FrameCallback = (deltaSeconds: number) => void;

export class SceneRenderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly container: HTMLElement;
  private readonly clock = new THREE.Clock();
  private readonly post: PostProcessor;
  private quality: QualityLevel = DEFAULT_QUALITY;
  private usePost = QUALITY_PROFILES[DEFAULT_QUALITY].postProcess;
  private rafId = 0;
  private onFrame: FrameCallback | null = null;
  private pendingCapture: ((dataUrl: string) => void) | null = null;
  private readonly handleResize = (): void => this.onResize();

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    const cap = QUALITY_PROFILES[DEFAULT_QUALITY].pixelRatioCap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));

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

    this.post = new PostProcessor(this.renderer);
    this.post.setQuality(DEFAULT_QUALITY);

    this.onResize();
    window.addEventListener('resize', this.handleResize);
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setOnFrame(cb: FrameCallback): void {
    this.onFrame = cb;
  }

  /** 设置引力透镜参数（由控制器每帧在 onFrame 内更新） */
  setLens(params: LensParams): void {
    this.post.setLens(params);
  }

  setQuality(level: QualityLevel): void {
    this.quality = level;
    const profile = QUALITY_PROFILES[level];
    this.usePost = profile.postProcess;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.pixelRatioCap));
    this.post.setQuality(level);
    this.onResize();
  }

  getQuality(): QualityLevel {
    return this.quality;
  }

  start(): void {
    const loop = (): void => {
      this.rafId = requestAnimationFrame(loop);
      const dt = this.clock.getDelta();
      this.onFrame?.(dt);
      this.controls.update();
      if (this.usePost) {
        this.post.render(this.scene, this.camera);
      } else {
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
      }
      // 截图：在渲染后、drawing buffer 清空前同步读取
      if (this.pendingCapture) {
        const resolve = this.pendingCapture;
        this.pendingCapture = null;
        resolve(this.renderer.domElement.toDataURL('image/png'));
      }
    };
    loop();
  }

  /** 抓取下一帧画面为 PNG dataURL */
  capture(): Promise<string> {
    return new Promise((resolve) => {
      this.pendingCapture = resolve;
    });
  }

  private onResize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.controls.dispose();
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
