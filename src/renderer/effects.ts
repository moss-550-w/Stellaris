/**
 * 渲染表现层 —— 碰撞 / 演化特效
 *
 * 加性混合 sprite 一次性闪光：合并/撕裂为短促光球，毁灭/超新星为更大更久的爆发；
 * 演化阶段跃迁（超新星爆发、遗骸诞生）复用同一闪光机制。
 * 完整碎片场与冲击波留待后续视觉打磨。
 */
import * as THREE from 'three';
import type { CollisionEvent, EvolutionEvent } from '@/physics/types';
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

  /** 底层闪光：在位置生成一次加性光球 */
  private flash(x: number, y: number, z: number, color: number, baseScale: number, life: number): void {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.texture,
        color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(baseScale * 0.3);
    this.group.add(sprite);
    this.active.push({ sprite, age: 0, life, baseScale });
  }

  spawn(ev: CollisionEvent): void {
    const big = ev.kind === 'destroy' || ev.kind === 'supernova';
    this.flash(ev.x, ev.y, ev.z, ev.color, ev.radius * (big ? 18 : 6), big ? 1.1 : 0.5);
  }

  /** 演化跃迁特效：超新星为大而久的金白爆发，其它跃迁为温和闪现 */
  spawnEvolution(ev: EvolutionEvent): void {
    if (ev.supernova) {
      this.flash(ev.x, ev.y, ev.z, 0xfff0c0, ev.radius * 24, 1.4);
    } else {
      this.flash(ev.x, ev.y, ev.z, ev.color, ev.radius * 7, 0.7);
    }
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
