<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { AudioManager } from '@/gameplay/AudioManager';

// 自包含：组件持有 AudioManager 生命周期，无需父组件接线
const mgr = new AudioManager();
const state = mgr.state;

function onVolume(e: Event): void {
  mgr.setVolume(Number((e.target as HTMLInputElement).value));
}

onBeforeUnmount(() => mgr.dispose());
</script>

<template>
  <div class="music-widget" :class="{ playing: state.playing }">
    <span class="note">♪</span>
    <span class="title" :title="state.title">{{ state.title }}</span>
    <button class="ctrl" title="上一首" @click="mgr.prev()">⏮</button>
    <button class="ctrl play" :title="state.playing ? '暂停' : '播放'" @click="mgr.toggle()">
      {{ state.playing ? '⏸' : '▶' }}
    </button>
    <button class="ctrl" title="下一首" @click="mgr.next()">⏭</button>
    <input
      class="volume"
      type="range"
      min="0"
      max="1"
      step="0.05"
      :value="state.volume"
      title="音量"
      @input="onVolume"
    />
  </div>
</template>

<style scoped>
.music-widget {
  position: fixed;
  right: 16px;
  bottom: 22px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(12, 16, 28, 0.72);
  border: 1px solid rgba(120, 150, 220, 0.18);
  backdrop-filter: blur(10px);
  color: #cdd6f4;
  user-select: none;
}
.note {
  font-size: 13px;
  opacity: 0.7;
}
.music-widget.playing .note {
  color: #88ccff;
  opacity: 1;
}
.title {
  max-width: 132px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  opacity: 0.9;
}
.ctrl {
  padding: 4px 6px;
  border: 1px solid rgba(120, 150, 220, 0.2);
  border-radius: 7px;
  background: rgba(30, 38, 60, 0.6);
  color: #cdd6f4;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.18s;
}
.ctrl:hover {
  background: rgba(60, 80, 130, 0.6);
}
.ctrl.play {
  background: #5b86b5;
  border-color: #7aa7d6;
  color: #fff;
}
.ctrl.play:hover {
  background: #6b96c5;
}
.volume {
  width: 64px;
  accent-color: #5b86b5;
  cursor: pointer;
}
</style>
