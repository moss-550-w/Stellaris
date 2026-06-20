<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, reactive } from 'vue';
import { SimulationController, type SimUIState } from '@/gameplay/SimulationController';
import Toolbar from '@/ui/Toolbar.vue';
import ControlPanel from '@/ui/ControlPanel.vue';
import EditorPanel from '@/ui/EditorPanel.vue';
import { TIME_SCALES, DEFAULT_SCALE_INDEX } from '@/core/time';
import type { BodyPatch, IntegrationMode } from '@/physics/types';

const host = ref<HTMLDivElement | null>(null);

const ui = reactive<SimUIState>({
  presetKey: 'single',
  simYears: 0,
  scaleIndex: DEFAULT_SCALE_INDEX,
  timeScale: TIME_SCALES[DEFAULT_SCALE_INDEX],
  detailOmitted: false,
  connected: false,
  fps: 0,
  mode: 'fluid',
  count: 0,
  canUndo: false,
  canRedo: false,
  selectedId: null,
  selected: null,
});

let controller: SimulationController | null = null;

onMounted(() => {
  if (host.value) controller = new SimulationController(host.value, ui);
});
onBeforeUnmount(() => {
  controller?.dispose();
  controller = null;
});

const onSelect = (i: number): void => controller?.setScaleIndex(i);
const onLoad = (key: string): void => controller?.loadPreset(key);
const onMode = (m: IntegrationMode): void => controller?.setMode(m);
const onAdd = (): void => controller?.addBody();
const onUndo = (): void => controller?.undo();
const onRedo = (): void => controller?.redo();
const onEdit = (patch: Record<string, number | string>): void => controller?.editSelected(patch as BodyPatch);
const onRemove = (): void => controller?.removeSelected();
const onCloseEditor = (): void => controller?.selectBody(null);
</script>

<template>
  <div ref="host" class="canvas-host"></div>
  <h1 class="brand">Stellaris</h1>

  <Toolbar
    :state="ui"
    @load="onLoad"
    @mode="onMode"
    @add="onAdd"
    @undo="onUndo"
    @redo="onRedo"
  />
  <EditorPanel :state="ui" @edit="onEdit" @remove="onRemove" @close="onCloseEditor" />
  <ControlPanel :state="ui" @select="onSelect" />

  <p class="hint">点击天体选中编辑 · 拖拽旋转视角 · 滚轮缩放</p>
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
.hint {
  position: fixed;
  left: 18px;
  bottom: 16px;
  margin: 0;
  font-size: 11px;
  color: #8893b0;
  pointer-events: none;
  user-select: none;
}
</style>
