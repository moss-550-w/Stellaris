/**
 * 渲染表现层 —— Three.js 场景渲染器（阶段零骨架）
 *
 * 当前仅初始化场景/相机/渲染器与渲染循环，呈现深空黑屏画布。
 * 天体网格、材质、粒子、后处理等在阶段一起逐步接入。
 */
import * as THREE from 'three';

export class SceneRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly container: HTMLElement;
  private rafId = 0;
  private readonly handleResize = (): void => this.onResize();

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000008); // 深空底色

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1_000_000);
    this.camera.position.set(0, 0, 50);

    container.appendChild(this.renderer.domElement);
    this.onResize();
    window.addEventListener('resize', this.handleResize);
  }

  start(): void {
    const loop = (): void => {
      this.rafId = requestAnimationFrame(loop);
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
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
