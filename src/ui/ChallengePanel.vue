<script setup lang="ts">
import { listChallenges } from '@/gameplay/challenges';
import type { SimUIState } from '@/gameplay/SimulationController';

const props = defineProps<{ state: SimUIState }>();
const emit = defineEmits<{ (e: 'select', key: string | null): void }>();

const challenges = listChallenges();

function pick(key: string): void {
  emit('select', props.state.challengeKey === key ? null : key);
}
</script>

<template>
  <div class="challenges">
    <div class="title">挑战</div>
    <div class="list">
      <button
        v-for="c in challenges"
        :key="c.key"
        class="item"
        :class="{ active: state.challengeKey === c.key }"
        @click="pick(c.key)"
      >
        {{ c.name }}
      </button>
    </div>

    <div v-if="state.challengeKey && state.challenge" class="detail">
      <div class="goal">{{ listChallenges().find((c) => c.key === state.challengeKey)?.goal }}</div>
      <div class="bar">
        <div class="fill" :class="{ done: state.challenge.done }" :style="{ width: (state.challenge.progress * 100).toFixed(0) + '%' }"></div>
      </div>
      <div class="reason" :class="{ done: state.challenge.done }">
        {{ state.challenge.done ? '✓ ' : '' }}{{ state.challenge.reason }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.challenges {
  position: fixed;
  top: 70px;
  left: 18px;
  width: 230px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(12, 16, 28, 0.72);
  border: 1px solid rgba(120, 150, 220, 0.18);
  backdrop-filter: blur(10px);
  color: #cdd6f4;
  user-select: none;
}
.title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  margin-bottom: 8px;
  opacity: 0.85;
}
.list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.item {
  padding: 5px 9px;
  border-radius: 7px;
  background: rgba(30, 38, 60, 0.6);
  border: 1px solid rgba(120, 150, 220, 0.2);
  color: #cdd6f4;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s;
}
.item:hover {
  background: rgba(60, 80, 130, 0.6);
}
.item.active {
  background: #5b86b5;
  border-color: #7aa7d6;
  color: #fff;
  font-weight: 600;
}
.detail {
  margin-top: 10px;
}
.goal {
  font-size: 11px;
  opacity: 0.7;
  line-height: 1.5;
  margin-bottom: 8px;
}
.bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: #5b86b5;
  border-radius: 3px;
  transition: width 0.3s;
}
.fill.done {
  background: #4ade80;
}
.reason {
  margin-top: 6px;
  font-size: 11px;
  opacity: 0.85;
  line-height: 1.4;
}
.reason.done {
  color: #4ade80;
  font-weight: 600;
}
</style>
