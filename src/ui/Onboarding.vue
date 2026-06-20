<script setup lang="ts">
import { ref } from 'vue';

const STORAGE_KEY = 'stellaris.onboarded';

const steps = [
  { icon: '🌌', title: '欢迎来到 Stellaris', text: '这是一个物理自洽的宇宙游乐场。创造恒星、行星与黑洞，观察它们在引力下共舞。' },
  { icon: '🖱️', title: '观测视角', text: '拖拽旋转视角，滚轮缩放，点击任意天体查看详情与科普。' },
  { icon: '⏱️', title: '感知时间', text: '底部调速条控制时间流速：从暂停到万倍速，随时定格或快进宇宙演化。' },
  { icon: '🪐', title: '自由创造', text: '右上角切换预设场景、添加天体、切换物理精度。编辑天体的质量与速度，即时生效。' },
  { icon: '🏆', title: '挑战自我', text: '左侧挑战面板有精确目标（如建立宜居双星）。切换到「标准」精度即可开始判定。' },
];

// 首次访问才显示
const visible = ref(localStorage.getItem(STORAGE_KEY) !== '1');
const index = ref(0);

function next(): void {
  if (index.value < steps.length - 1) index.value++;
  else finish();
}
function prev(): void {
  if (index.value > 0) index.value--;
}
function finish(): void {
  localStorage.setItem(STORAGE_KEY, '1');
  visible.value = false;
}

// 供外部「重新查看引导」
function open(): void {
  index.value = 0;
  visible.value = true;
}
defineExpose({ open });
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="overlay" @click.self="finish">
      <div class="card">
        <div class="icon">{{ steps[index].icon }}</div>
        <h2>{{ steps[index].title }}</h2>
        <p>{{ steps[index].text }}</p>

        <div class="dots">
          <span v-for="(_, i) in steps" :key="i" class="dot" :class="{ on: i === index }"></span>
        </div>

        <div class="actions">
          <button class="skip" @click="finish">跳过</button>
          <div class="nav">
            <button v-if="index > 0" class="ghost" @click="prev">上一步</button>
            <button class="primary" @click="next">{{ index === steps.length - 1 ? '开始探索' : '下一步' }}</button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 6, 14, 0.75);
  backdrop-filter: blur(6px);
}
.card {
  width: 380px;
  max-width: 90vw;
  padding: 28px;
  border-radius: 18px;
  background: rgba(18, 24, 40, 0.95);
  border: 1px solid rgba(120, 150, 220, 0.25);
  color: #cdd6f4;
  text-align: center;
}
.icon {
  font-size: 44px;
  margin-bottom: 8px;
}
h2 {
  margin: 0 0 12px;
  font-size: 19px;
  font-weight: 600;
}
p {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.7;
  opacity: 0.8;
}
.dots {
  display: flex;
  justify-content: center;
  gap: 7px;
  margin-bottom: 18px;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: all 0.2s;
}
.dot.on {
  background: #5b86b5;
  width: 18px;
  border-radius: 4px;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nav {
  display: flex;
  gap: 8px;
}
button {
  padding: 8px 16px;
  border-radius: 9px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
}
.skip {
  background: transparent;
  color: #8893b0;
  border: none;
}
.ghost {
  background: rgba(40, 50, 75, 0.6);
  color: #cdd6f4;
  border: 1px solid rgba(120, 150, 220, 0.2);
}
.primary {
  background: #5b86b5;
  color: #fff;
  font-weight: 600;
}
.primary:hover {
  background: #6b96c5;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
