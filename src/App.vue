<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, reactive } from 'vue';
import { SimulationController, DEFAULT_EVOLUTION_INDEX, type SimUIState } from '@/gameplay/SimulationController';
import Toolbar from '@/ui/Toolbar.vue';
import ControlPanel from '@/ui/ControlPanel.vue';
import EditorPanel from '@/ui/EditorPanel.vue';
import ChallengePanel from '@/ui/ChallengePanel.vue';
import SaveMenu from '@/ui/SaveMenu.vue';
import Onboarding from '@/ui/Onboarding.vue';
import { TIME_SCALES, DEFAULT_SCALE_INDEX } from '@/core/time';
import { DEFAULT_QUALITY, type QualityLevel } from '@/store/settings';
import type { BodyPatch, IntegrationMode } from '@/physics/types';
import {
  saveLocal,
  loadLocal,
  deleteLocal,
  serializeSave,
  parseSave,
} from '@/utils/storage';
import { downloadText, downloadDataUrl, pickTextFile } from '@/utils/fileIo';
import { isMobile } from '@/utils/device';

const host = ref<HTMLDivElement | null>(null);
const onboarding = ref<InstanceType<typeof Onboarding> | null>(null);

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
  quality: isMobile() ? 'low' : DEFAULT_QUALITY,
  energy: null,
  challengeKey: null,
  challenge: null,
  evolutionIndex: DEFAULT_EVOLUTION_INDEX,
});

let controller: SimulationController | null = null;

onMounted(() => {
  if (host.value) controller = new SimulationController(host.value, ui);
});
onBeforeUnmount(() => {
  controller?.dispose();
  controller = null;
});

// 时间戳（应用运行时，浏览器环境）
const nowIso = (): string => new Date().toISOString();
const stamp = (): string => nowIso().replace(/[:T]/g, '-').slice(0, 19);

const onSelect = (i: number): void => controller?.setScaleIndex(i);
const onEvolution = (i: number): void => controller?.setEvolutionIndex(i);
const onLoad = (key: string): void => controller?.loadPreset(key);
const onMode = (m: IntegrationMode): void => controller?.setMode(m);
const onQuality = (q: QualityLevel): void => controller?.setQuality(q);
const onAdd = (): void => controller?.addBody();
const onUndo = (): void => controller?.undo();
const onRedo = (): void => controller?.redo();
const onEdit = (patch: Record<string, number | string>): void => controller?.editSelected(patch as BodyPatch);
const onRemove = (): void => controller?.removeSelected();
const onCloseEditor = (): void => controller?.selectBody(null);
const onChallenge = (key: string | null): void => controller?.setChallenge(key);

// —— 存档 / 文件 / 截图 ——
function onSave(name: string): void {
  const state = controller?.getWorldState();
  if (!state) return;
  saveLocal(name, ui.presetKey, state, nowIso());
}
function onLoadSlot(id: string): void {
  const file = loadLocal(id);
  if (file) controller?.loadState(file.state, file.presetKey);
}
function onDeleteSlot(id: string): void {
  deleteLocal(id);
}
function onExport(): void {
  const state = controller?.getWorldState();
  if (!state) return;
  downloadText(`stellaris-${stamp()}.json`, serializeSave('导出存档', ui.presetKey, state, nowIso()));
}
async function onImport(): Promise<void> {
  const text = await pickTextFile('.json');
  if (!text) return;
  try {
    const file = parseSave(text);
    controller?.loadState(file.state, file.presetKey);
  } catch (err) {
    alert('导入失败：' + (err as Error).message);
  }
}
async function onScreenshot(): Promise<void> {
  const dataUrl = await controller?.captureScreenshot();
  if (dataUrl) downloadDataUrl(`stellaris-${stamp()}.png`, dataUrl);
}
function onGuide(): void {
  onboarding.value?.open();
}
</script>

<template>
  <div ref="host" class="canvas-host"></div>
  <h1 class="brand">Stellaris</h1>

  <SaveMenu
    @save="onSave"
    @load="onLoadSlot"
    @delete="onDeleteSlot"
    @export="onExport"
    @import="onImport"
    @screenshot="onScreenshot"
    @guide="onGuide"
  />
  <Toolbar
    :state="ui"
    @load="onLoad"
    @mode="onMode"
    @quality="onQuality"
    @add="onAdd"
    @undo="onUndo"
    @redo="onRedo"
  />
  <ChallengePanel :state="ui" @select="onChallenge" />
  <EditorPanel :state="ui" @edit="onEdit" @remove="onRemove" @close="onCloseEditor" />
  <ControlPanel :state="ui" @select="onSelect" @evolution="onEvolution" />

  <Onboarding ref="onboarding" />
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
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  margin: 0;
  font-size: 11px;
  color: #8893b0;
  pointer-events: none;
  user-select: none;
}
</style>
