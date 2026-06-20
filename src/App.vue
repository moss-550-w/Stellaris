<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { SceneRenderer } from '@/renderer/SceneRenderer';
import { PhysicsBridge } from '@/physics/bridge';
import type { PhysicsOutbound } from '@/physics/types';

const canvasHost = ref<HTMLDivElement | null>(null);
const status = ref('初始化中…');

let renderer: SceneRenderer | null = null;
let physics: PhysicsBridge | null = null;

onMounted(() => {
  // 渲染表现层：主线程 Three.js 画布
  if (canvasHost.value) {
    renderer = new SceneRenderer(canvasHost.value);
    renderer.start();
  }

  // 物理仿真层：Web Worker，验证主线程↔Worker 通信链路
  physics = new PhysicsBridge((msg: PhysicsOutbound) => {
    if (msg.kind === 'pong') {
      status.value = '物理 Worker 已连通 ✓';
    }
  });
  physics.send({ type: 'ping' });
});

onBeforeUnmount(() => {
  renderer?.dispose();
  physics?.dispose();
});
</script>

<template>
  <div ref="canvasHost" class="canvas-host"></div>
  <div class="hud">
    <h1>Stellaris</h1>
    <p>{{ status }}</p>
  </div>
</template>

<style scoped>
.canvas-host {
  position: fixed;
  inset: 0;
}

.hud {
  position: fixed;
  top: 16px;
  left: 18px;
  color: #cdd6f4;
  pointer-events: none;
  user-select: none;
}

.hud h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 3px;
}

.hud p {
  margin: 6px 0 0;
  font-size: 13px;
  opacity: 0.75;
}
</style>
