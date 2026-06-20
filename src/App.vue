<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, reactive } from 'vue';
import { SimulationController, type SimUIState } from '@/gameplay/SimulationController';
import ControlPanel from '@/ui/ControlPanel.vue';
import { TIME_SCALES, DEFAULT_SCALE_INDEX } from '@/core/time';

const host = ref<HTMLDivElement | null>(null);

// 响应式 UI 状态，交由控制器逐帧更新
const ui = reactive<SimUIState>({
  systemName: '',
  simYears: 0,
  scaleIndex: DEFAULT_SCALE_INDEX,
  timeScale: TIME_SCALES[DEFAULT_SCALE_INDEX],
  detailOmitted: false,
  connected: false,
  fps: 0,
});

let controller: SimulationController | null = null;

onMounted(() => {
  if (host.value) {
    controller = new SimulationController(host.value, ui);
  }
});

onBeforeUnmount(() => {
  controller?.dispose();
  controller = null;
});

function onSelect(index: number): void {
  controller?.setScaleIndex(index);
}
</script>

<template>
  <div ref="host" class="canvas-host"></div>
  <h1 class="brand">Stellaris</h1>
  <ControlPanel :state="ui" @select="onSelect" />
</template>

<style scoped>
.canvas-host {
  position: fixed;
  inset: 0;
}

.brand {
  position: fixed;
  top: 16px;
  left: 18px;
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 3px;
  color: #cdd6f4;
  pointer-events: none;
  user-select: none;
}
</style>
