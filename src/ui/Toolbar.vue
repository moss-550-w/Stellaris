<script setup lang="ts">
import { PRESETS } from '@/gameplay/presets';
import type { SimUIState } from '@/gameplay/SimulationController';
import type { IntegrationMode } from '@/physics/types';
import { QUALITY_LABELS, type QualityLevel } from '@/store/settings';

defineProps<{ state: SimUIState }>();
const emit = defineEmits<{
  (e: 'load', key: string): void;
  (e: 'mode', mode: IntegrationMode): void;
  (e: 'quality', level: QualityLevel): void;
  (e: 'add'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
}>();

const QUALITY_KEYS: QualityLevel[] = ['low', 'medium', 'high'];

function onPreset(e: Event): void {
  emit('load', (e.target as HTMLSelectElement).value);
}

function onQuality(e: Event): void {
  emit('quality', (e.target as HTMLSelectElement).value as QualityLevel);
}
</script>

<template>
  <div class="toolbar">
    <select class="preset" :value="state.presetKey" @change="onPreset">
      <option v-for="p in PRESETS" :key="p.key" :value="p.key">{{ p.name }}</option>
    </select>

    <div class="mode">
      <button :class="{ active: state.mode === 'fluid' }" @click="emit('mode', 'fluid')" title="半隐式欧拉，支持更多天体">
        流畅
      </button>
      <button :class="{ active: state.mode === 'standard' }" @click="emit('mode', 'standard')" title="velocity Verlet，高精度判定基准">
        标准
      </button>
    </div>

    <button class="act" @click="emit('add')">＋ 天体</button>
    <button class="act" :disabled="!state.canUndo" @click="emit('undo')">↶ 撤销</button>
    <button class="act" :disabled="!state.canRedo" @click="emit('redo')">↷ 重做</button>

    <select class="preset" :value="state.quality" @change="onQuality" title="画质档位">
      <option v-for="q in QUALITY_KEYS" :key="q" :value="q">画质·{{ QUALITY_LABELS[q] }}</option>
    </select>
  </div>
</template>

<style scoped>
.toolbar {
  position: fixed;
  top: 14px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(12, 16, 28, 0.72);
  border: 1px solid rgba(120, 150, 220, 0.18);
  backdrop-filter: blur(10px);
  color: #cdd6f4;
  user-select: none;
}
.preset {
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(30, 38, 60, 0.8);
  color: #cdd6f4;
  border: 1px solid rgba(120, 150, 220, 0.2);
  font-size: 13px;
  cursor: pointer;
}
.mode {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(120, 150, 220, 0.2);
}
.mode button {
  padding: 6px 10px;
  background: rgba(30, 38, 60, 0.6);
  color: #cdd6f4;
  border: none;
  font-size: 12px;
  cursor: pointer;
}
.mode button.active {
  background: #5b86b5;
  color: #fff;
  font-weight: 600;
}
.act {
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(30, 38, 60, 0.6);
  color: #cdd6f4;
  border: 1px solid rgba(120, 150, 220, 0.2);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.18s;
}
.act:hover:not(:disabled) {
  background: rgba(60, 80, 130, 0.6);
}
.act:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
