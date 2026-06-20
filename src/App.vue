<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, reactive, watch } from 'vue';
import { SimulationController, DEFAULT_EVOLUTION_INDEX, type SimUIState } from '@/gameplay/SimulationController';
import Toolbar from '@/ui/Toolbar.vue';
import ControlPanel from '@/ui/ControlPanel.vue';
import EditorPanel from '@/ui/EditorPanel.vue';
import ChallengePanel from '@/ui/ChallengePanel.vue';
import SaveMenu from '@/ui/SaveMenu.vue';
import Onboarding from '@/ui/Onboarding.vue';
import DiagnosticsHud from '@/ui/DiagnosticsHud.vue';
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
  discovered: [],
  discoveryToast: null,
  diagnostics: null,
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
const onLaunch = (): void => controller?.launchSpacecraft();
const onUndo = (): void => controller?.undo();
const onRedo = (): void => controller?.redo();
const onEdit = (patch: Record<string, number | string>): void => controller?.editSelected(patch as BodyPatch);
const onRemove = (): void => controller?.removeSelected();
const onCloseEditor = (): void => controller?.selectBody(null);
const onChallenge = (key: string | null): void => controller?.setChallenge(key);
const onThrust = (mode: 'off' | 'prograde' | 'retrograde'): void => controller?.setShipThrust(mode);
const onDismissToast = (): void => controller?.clearDiscoveryToast();

// 飞掠解锁提示 3.5 秒后自动消失
watch(
  () => ui.discoveryToast,
  (v) => {
    if (v) setTimeout(() => controller?.clearDiscoveryToast(), 3500);
  },
);

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
function onExportReport(): void {
  const csv = controller?.exportDiagnosticsCsv();
  if (!csv) {
    alert('暂无诊断数据：请在实验档运行片刻后再导出');
    return;
  }
  downloadText(`stellaris-diagnostics-${stamp()}.csv`, csv);
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
    @launch="onLaunch"
    @undo="onUndo"
    @redo="onRedo"
  />
  <ChallengePanel :state="ui" @select="onChallenge" />
  <EditorPanel :state="ui" @edit="onEdit" @remove="onRemove" @close="onCloseEditor" @thrust="onThrust" />
  <ControlPanel :state="ui" @select="onSelect" @evolution="onEvolution" />
  <DiagnosticsHud :state="ui" @export-report="onExportReport" />

  <transition name="toast">
    <div v-if="ui.discoveryToast" class="toast" @click="onDismissToast">
      🛰️ {{ ui.discoveryToast }}
    </div>
  </transition>

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
.toast {
  position: fixed;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 18px;
  border-radius: 10px;
  background: rgba(46, 166, 160, 0.92);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  z-index: 40;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}
</style>
