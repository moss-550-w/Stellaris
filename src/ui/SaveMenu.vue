<script setup lang="ts">
import { ref } from 'vue';
import { listSaves, type SaveSlot } from '@/utils/storage';

const emit = defineEmits<{
  (e: 'save', name: string): void;
  (e: 'load', id: string): void;
  (e: 'delete', id: string): void;
  (e: 'export'): void;
  (e: 'import'): void;
  (e: 'screenshot'): void;
  (e: 'guide'): void;
  (e: 'share'): void;
  (e: 'gallery'): void;
}>();

const open = ref(false);
const saveName = ref('');
const slots = ref<SaveSlot[]>([]);

function refresh(): void {
  slots.value = listSaves();
}
function toggle(): void {
  open.value = !open.value;
  if (open.value) refresh();
}
function doSave(): void {
  const name = saveName.value.trim() || '快速存档';
  emit('save', name);
  saveName.value = '';
  setTimeout(refresh, 50);
}
function doDelete(id: string): void {
  emit('delete', id);
  setTimeout(refresh, 50);
}
function fmt(iso: string): string {
  return iso ? iso.replace('T', ' ').slice(0, 16) : '';
}
</script>

<template>
  <div class="save-menu">
    <button class="trigger" @click="toggle">☰ 菜单</button>

    <transition name="slide">
      <div v-if="open" class="dropdown">
        <div class="section">
          <div class="row">
            <input v-model="saveName" placeholder="存档名称" @keyup.enter="doSave" />
            <button class="primary" @click="doSave">保存</button>
          </div>
        </div>

        <div class="section">
          <div class="label">本地存档</div>
          <div v-if="slots.length === 0" class="empty">暂无存档</div>
          <div v-for="s in slots" :key="s.id" class="slot">
            <div class="slot-info" @click="emit('load', s.id)">
              <span class="slot-name">{{ s.name }}</span>
              <span class="slot-time">{{ fmt(s.savedAt) }}</span>
            </div>
            <button class="del" @click="doDelete(s.id)">✕</button>
          </div>
        </div>

        <div class="section actions">
          <button @click="emit('share')">🔗 分享链接</button>
          <button @click="emit('gallery')">🌌 场景库</button>
          <button @click="emit('export')">导出文件</button>
          <button @click="emit('import')">导入文件</button>
          <button @click="emit('screenshot')">截图</button>
          <button @click="emit('guide')">新手引导</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.save-menu {
  position: fixed;
  top: 14px;
  left: 120px;
  z-index: 30;
  user-select: none;
}
.trigger {
  padding: 7px 12px;
  border-radius: 10px;
  background: rgba(12, 16, 28, 0.72);
  border: 1px solid rgba(120, 150, 220, 0.18);
  backdrop-filter: blur(10px);
  color: #cdd6f4;
  font-size: 13px;
  cursor: pointer;
}
.dropdown {
  margin-top: 8px;
  width: 250px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(12, 16, 28, 0.85);
  border: 1px solid rgba(120, 150, 220, 0.18);
  backdrop-filter: blur(12px);
  color: #cdd6f4;
}
.section {
  padding: 8px 0;
  border-bottom: 1px solid rgba(120, 150, 220, 0.12);
}
.section:last-child {
  border-bottom: none;
}
.label {
  font-size: 11px;
  opacity: 0.6;
  margin-bottom: 6px;
}
.row {
  display: flex;
  gap: 6px;
}
.row input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border-radius: 7px;
  background: rgba(30, 38, 60, 0.8);
  border: 1px solid rgba(120, 150, 220, 0.2);
  color: #cdd6f4;
  font-size: 12px;
}
.primary {
  padding: 6px 12px;
  border-radius: 7px;
  background: #5b86b5;
  color: #fff;
  border: none;
  font-size: 12px;
  cursor: pointer;
}
.empty {
  font-size: 11px;
  opacity: 0.5;
  padding: 4px 0;
}
.slot {
  display: flex;
  align-items: center;
  padding: 5px 0;
}
.slot-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}
.slot-info:hover .slot-name {
  color: #88ccff;
}
.slot-name {
  font-size: 12px;
}
.slot-time {
  font-size: 10px;
  opacity: 0.5;
}
.del {
  background: transparent;
  border: none;
  color: #8893b0;
  cursor: pointer;
  font-size: 12px;
}
.del:hover {
  color: #ff9aa2;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.actions button {
  flex: 1 1 45%;
  padding: 7px;
  border-radius: 7px;
  background: rgba(30, 38, 60, 0.6);
  border: 1px solid rgba(120, 150, 220, 0.2);
  color: #cdd6f4;
  font-size: 12px;
  cursor: pointer;
}
.actions button:hover {
  background: rgba(60, 80, 130, 0.6);
}
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
