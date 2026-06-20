<script setup lang="ts">
import { ref, watch } from 'vue';
import type { SimUIState } from '@/gameplay/SimulationController';
import type { BodyType } from '@/physics/types';

const props = defineProps<{ state: SimUIState }>();
const emit = defineEmits<{
  (e: 'edit', patch: Record<string, number | string>): void;
  (e: 'remove'): void;
  (e: 'close'): void;
}>();

const TYPE_LABELS: Record<BodyType, string> = { star: '恒星', rocky: '岩质', gas: '气态' };
const SWATCHES = [0xfff1cf, 0xffd9a0, 0x5b86b5, 0x76c08a, 0xc1654a, 0xc2b184, 0xa9c8ff, 0xd8b070];

// 本地编辑缓冲（仅在选中目标切换时重置，避免运行中被实时数据覆盖）
const mass = ref(0);
const radius = ref(0);
const type = ref<BodyType>('rocky');
const vx = ref(0);
const vy = ref(0);
const vz = ref(0);

watch(
  () => props.state.selected?.id,
  () => {
    const s = props.state.selected;
    if (!s) return;
    mass.value = s.mass;
    radius.value = s.radius;
    type.value = s.type as BodyType;
    vx.value = s.vx;
    vy.value = s.vy;
    vz.value = s.vz;
  },
  { immediate: true },
);

const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');
</script>

<template>
  <div v-if="state.selected" class="editor">
    <div class="head">
      <span class="name">{{ TYPE_LABELS[type] }} #{{ state.selected.id }}</span>
      <button class="close" @click="emit('close')">✕</button>
    </div>

    <label class="field">
      <span>类型</span>
      <select v-model="type" @change="emit('edit', { type })">
        <option value="rocky">岩质</option>
        <option value="gas">气态</option>
        <option value="star">恒星</option>
      </select>
    </label>

    <label class="field">
      <span>质量</span>
      <input type="number" v-model.number="mass" step="0.0000001" @change="emit('edit', { mass })" />
    </label>

    <label class="field">
      <span>半径 {{ radius.toFixed(3) }}</span>
      <input type="range" min="0.02" max="0.6" step="0.005" v-model.number="radius" @input="emit('edit', { radius })" />
    </label>

    <div class="field colors">
      <span>颜色</span>
      <div class="swatches">
        <button
          v-for="c in SWATCHES"
          :key="c"
          class="swatch"
          :style="{ background: hex(c) }"
          @click="emit('edit', { color: c })"
        ></button>
      </div>
    </div>

    <div class="vel">
      <span>速度 (AU/年)</span>
      <div class="vel-inputs">
        <input type="number" v-model.number="vx" step="0.1" @change="emit('edit', { vx })" />
        <input type="number" v-model.number="vy" step="0.1" @change="emit('edit', { vy })" />
        <input type="number" v-model.number="vz" step="0.1" @change="emit('edit', { vz })" />
      </div>
    </div>

    <div class="readout">
      位置 ({{ state.selected.x.toFixed(2) }}, {{ state.selected.y.toFixed(2) }}, {{ state.selected.z.toFixed(2) }})
      · 速率 {{ state.selected.speed.toFixed(2) }}
    </div>

    <button class="remove" @click="emit('remove')">删除天体</button>
  </div>
</template>

<style scoped>
.editor {
  position: fixed;
  top: 70px;
  right: 16px;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(12, 16, 28, 0.78);
  border: 1px solid rgba(120, 150, 220, 0.2);
  backdrop-filter: blur(10px);
  color: #cdd6f4;
}
.head {
  display: flex;
  align-items: center;
}
.name {
  font-size: 14px;
  font-weight: 600;
}
.close {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #9aa6c2;
  cursor: pointer;
  font-size: 14px;
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.field span {
  opacity: 0.8;
  white-space: nowrap;
}
.field select,
.field input {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border-radius: 6px;
  background: rgba(30, 38, 60, 0.8);
  border: 1px solid rgba(120, 150, 220, 0.2);
  color: #cdd6f4;
  font-size: 12px;
}
.field input[type='range'] {
  padding: 0;
}
.colors {
  flex-direction: column;
  align-items: flex-start;
}
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
}
.vel span {
  font-size: 12px;
  opacity: 0.8;
}
.vel-inputs {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.vel-inputs input {
  width: 0;
  flex: 1;
  padding: 4px 6px;
  border-radius: 6px;
  background: rgba(30, 38, 60, 0.8);
  border: 1px solid rgba(120, 150, 220, 0.2);
  color: #cdd6f4;
  font-size: 12px;
}
.readout {
  font-size: 11px;
  opacity: 0.65;
  line-height: 1.5;
}
.remove {
  padding: 7px;
  border-radius: 8px;
  background: rgba(220, 60, 70, 0.18);
  border: 1px solid rgba(220, 80, 90, 0.35);
  color: #ff9aa2;
  font-size: 12px;
  cursor: pointer;
}
.remove:hover {
  background: rgba(220, 60, 70, 0.3);
}
</style>
