<script setup lang="ts">
/**
 * 守恒量诊断 HUD（V2.0 阶段七）—— 仅实验精度档显示。
 * 实时展示系统总能量、总角动量及相对基线漂移，并支持导出 CSV 报告。
 * 漂移量是积分器精度的客观度量：理想 RK4 下应维持极低量级（≈1e-6 或更小）。
 */
import { computed } from 'vue';
import type { SimUIState } from '@/gameplay/SimulationController';

const props = defineProps<{ state: SimUIState }>();
const emit = defineEmits<{ (e: 'export-report'): void }>();

const show = computed(() => props.state.mode === 'precise' && props.state.diagnostics !== null);

/** 漂移格式化：带符号科学计数 */
function fmtDrift(v: number): string {
  const s = v >= 0 ? '+' : '−';
  return `${s}${Math.abs(v).toExponential(2)}`;
}

/** 漂移健康度配色：|drift| < 1e-4 优、< 1e-2 良、否则警示 */
function driftClass(v: number): string {
  const a = Math.abs(v);
  if (a < 1e-4) return 'good';
  if (a < 1e-2) return 'ok';
  return 'warn';
}

function fmtVal(v: number): string {
  return v.toExponential(4);
}
</script>

<template>
  <div v-if="show && state.diagnostics" class="diag">
    <div class="head">
      <span class="dot"></span>守恒量诊断 · RK4
    </div>
    <div class="grid">
      <span class="k">模拟年</span>
      <span class="v">{{ state.diagnostics.simYears.toFixed(3) }}</span>
      <span class="k">总能量 E</span>
      <span class="v">{{ fmtVal(state.diagnostics.energy) }}</span>
      <span class="k">角动量 L</span>
      <span class="v">{{ fmtVal(state.diagnostics.angularMomentum) }}</span>
      <span class="k">能量漂移</span>
      <span class="v" :class="driftClass(state.diagnostics.energyDrift)">{{ fmtDrift(state.diagnostics.energyDrift) }}</span>
      <span class="k">角动量漂移</span>
      <span class="v" :class="driftClass(state.diagnostics.angularDrift)">{{ fmtDrift(state.diagnostics.angularDrift) }}</span>
    </div>
    <button class="export" :disabled="state.diagnostics.samples < 2" @click="emit('export-report')">
      导出报告 CSV（{{ state.diagnostics.samples }} 点）
    </button>
  </div>
</template>

<style scoped>
.diag {
  position: fixed;
  top: 70px;
  left: 18px;
  width: 200px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(12, 16, 28, 0.78);
  border: 1px solid rgba(120, 150, 220, 0.2);
  backdrop-filter: blur(10px);
  color: #cdd6f4;
  font-size: 12px;
  user-select: none;
  z-index: 30;
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  letter-spacing: 1px;
  margin-bottom: 8px;
  color: #b9c6ef;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5be3c0;
  box-shadow: 0 0 6px #5be3c0;
}
.grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 8px;
  font-variant-numeric: tabular-nums;
}
.k {
  color: #8893b0;
}
.v {
  text-align: right;
  font-family: 'Consolas', monospace;
}
.v.good {
  color: #7fe0a0;
}
.v.ok {
  color: #e8c97a;
}
.v.warn {
  color: #f08a8a;
}
.export {
  margin-top: 10px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(60, 80, 130, 0.5);
  color: #cdd6f4;
  border: 1px solid rgba(120, 150, 220, 0.25);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.18s;
}
.export:hover:not(:disabled) {
  background: rgba(80, 110, 170, 0.6);
}
.export:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
