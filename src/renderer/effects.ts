/**
 * 渲染表现层 —— 碰撞特效
 *
 * 阶段二用加性混合 sprite 做一次性闪光：合并/撕裂为短促光球，毁灭/超新星为更大更久的爆发。
 * 完整碎片场与冲击波留待阶段三视觉打磨。
 */
import * as THREE from 'three';
import type { CollisionEvent } from '@/physics/types';
import { generateGlowTexture } from './proceduralTexture';

interface Flash {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  baseScale: number;
}

export class CollisionEffects {
  private readonly group = new THREE.Group();
  private readonly texture: THREE.Texture;
  private readonly active: Flash[] = [];

  constructor(scene: THREE.Scene) {
    this.texture = generateGlowTexture(0xffffff);
    scene.add(this.group);
  }

  spawn(ev: CollisionEvent): void {
    const big = ev.kind === 'destroy' || ev.kind === 'supernova';
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.texture,
        color: ev.color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    sprite.position.set(ev.x, ev.y, ev.z);
    const baseScale = ev.radius * (big ? 18 : 6);
    sprite.scale.setScalar(baseScale * 0.3);
    this.group.add(sprite);
    this.active.push({ sprite, age: 0, life: big ? 1.1 : 0.5, baseScale });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i];
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) {
        this.group.remove(f.sprite);
        (f.sprite.material as THREE.SpriteMaterial).dispose();
        this.active.splice(i, 1);
        continue;
      }
      f.sprite.scale.setScalar(f.baseScale * (0.3 + t * 1.4));
      (f.sprite.material as THREE.SpriteMaterial).opacity = 1 - t;
    }
  }
}
