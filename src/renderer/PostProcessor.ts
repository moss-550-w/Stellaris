/**
 * 渲染表现层 —— 合并后处理器
 *
 * 单通道方案：场景 → RenderTarget → 全屏四边形(post.frag) → 屏幕。
 * 一次全屏绘制完成 引力透镜畸变 + bloom + ACES 色调映射 + 暗角，替代多 Pass。
 */
import * as THREE from 'three';
import vertexShader from './shaders/fullscreen.vert';
import fragmentShader from './shaders/post.frag';
import type { QualityLevel } from '@/store/settings';

export interface LensParams {
  active: boolean;
  centerUv: THREE.Vector2;
  radius: number;
  strength: number;
}

const BLOOM_BY_QUALITY: Record<QualityLevel, number> = { low: 0.0, medium: 0.6, high: 1.0 };

export class PostProcessor {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private bloomScale = 1;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType, // HDR，便于 bloom 阈值提取
    });

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        tScene: { value: this.target.texture },
        uResolution: { value: new THREE.Vector2(size.x, size.y) },
        uBloomStrength: { value: 1.0 },
        uBloomThreshold: { value: 1.0 },
        uVignette: { value: 0.9 },
        uLensActive: { value: 0 },
        uLensCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uLensRadius: { value: 0.25 },
        uLensStrength: { value: 0.0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  setQuality(level: QualityLevel): void {
    this.bloomScale = BLOOM_BY_QUALITY[level];
    this.material.uniforms.uBloomStrength.value = this.bloomScale;
  }

  setLens(p: LensParams): void {
    const u = this.material.uniforms;
    u.uLensActive.value = p.active ? 1 : 0;
    if (p.active) {
      u.uLensCenter.value.copy(p.centerUv);
      u.uLensRadius.value = p.radius;
      u.uLensStrength.value = p.strength;
    }
  }

  setSize(w: number, h: number): void {
    const dpr = this.renderer.getPixelRatio();
    const bw = Math.floor(w * dpr);
    const bh = Math.floor(h * dpr);
    this.target.setSize(bw, bh);
    this.material.uniforms.uResolution.value.set(bw, bh);
  }

  /** 渲染场景并应用后处理输出到屏幕 */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.setRenderTarget(this.target);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}
