<script setup lang="ts">
import { computed } from 'vue';
import { TIME_SCALES, describeScale } from '@/core/time';
import type { SimUIState } from '@/gameplay/SimulationController';

const props = defineProps<{ state: SimUIState }>();
const emit = defineEmits<{ (e: 'select', index: number): void }>();

const scaleLabel = (s: number): string => (s === 0 ? '⏸' : `${s}×`);
const speedDesc = computed(() => describeScale(props.state.timeScale));
</script>

<template>
  <div class="panel">
    <div class="row info">
      <span class="dot" :class="{ on: state.connected }"></span>
      <span class="count">{{ state.count }} 天体</span>
      <span class="fps">{{ state.fps }} FPS</span>
    </div>

    <div class="row scales">
      <button
        v-for="(s, i) in TIME_SCALES"
        :key="i"
        class="scale-btn"
        :class="{ active: i === state.scaleIndex }"
        @click="emit('select', i)"
      >
        {{ scaleLabel(s) }}
      </button>
    </div>

    <div class="row meta">
      <span class="sim-time">模拟时间 {{ state.simYears.toFixed(2) }} 年</span>
      <span class="speed">{{ speedDesc }}</span>
      <span v-if="state.detailOmitted" class="omit">细节省略</span>
    </div>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(12, 16, 28, 0.72);
  border: 1px solid rgba(120, 150, 220, 0.18);
  backdrop-filter: blur(10px);
  color: #cdd6f4;
  user-select: none;
  min-width: 380px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
  transition: background 0.3s;
}
.dot.on {
  background: #4ade80;
  box-shadow: 0 0 8px #4ade80;
}
.count {
  font-size: 13px;
  font-weight: 600;
}
.fps {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.6;
}
.scales {
  justify-content: space-between;
}
.scale-btn {
  flex: 1;
  padding: 7px 0;
  border: 1px solid rgba(120, 150, 220, 0.2);
  border-radius: 8px;
  background: rgba(30, 38, 60, 0.6);
  color: #cdd6f4;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s;
}
.scale-btn:hover {
  background: rgba(60, 80, 130, 0.6);
}
.scale-btn.active {
  background: #5b86b5;
  border-color: #7aa7d6;
  color: #fff;
  font-weight: 600;
}
.meta {
  font-size: 12px;
  opacity: 0.85;
}
.meta .speed {
  margin-left: auto;
  opacity: 0.7;
}
.omit {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(234, 179, 8, 0.18);
  color: #facc15;
  font-size: 11px;
}
</style>
