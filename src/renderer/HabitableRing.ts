/**
 * 渲染表现层 —— 宜居带可视环
 *
 * 在 XZ 平面绘制一个绿色半透明环带，标示选中恒星的宜居带范围。
 * 置于 RANGE_SPHERE 透明层，跟随恒星位置。
 */
import * as THREE from 'three';
import { RenderOrder } from './renderLayers';

export class HabitableRing {
  readonly mesh: THREE.Mesh;
  private inner = 0;
  private outer = 0;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.4, 96),
      new THREE.MeshBasicMaterial({
        color: 0x49d18a,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.mesh.rotation.x = -Math.PI / 2; // 躺平到 XZ 平面
    this.mesh.renderOrder = RenderOrder.RANGE_SPHERE;
    this.mesh.visible = false;
  }

  show(inner: number, outer: number, center: THREE.Vector3): void {
    if (inner !== this.inner || outer !== this.outer) {
      this.inner = inner;
      this.outer = outer;
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.RingGeometry(inner, outer, 96);
    }
    this.mesh.position.copy(center);
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }
}
