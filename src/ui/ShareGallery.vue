<script setup lang="ts">
/**
 * 分享链接 + 官方场景库弹窗（V2.0 阶段八，纯前端）。
 * 两种模式复用同一弹窗外壳：
 * - 'share'：展示生成的分享链接，支持复制 / 超长降级提示导出文件。
 * - 'gallery'：浏览内置精选场景，点击即加载。
 */
import { ref, watch } from 'vue';
import { GALLERY, type GalleryItem } from '@/utils/gallery';
import { URL_SHARE_LIMIT } from '@/utils/share';

const props = defineProps<{
  mode: 'share' | 'gallery' | null;
  shareUrl: string;
}>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'pick', item: GalleryItem): void;
  (e: 'export-file'): void;
}>();

const copied = ref(false);

watch(
  () => props.shareUrl,
  () => {
    copied.value = false;
  },
);

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.shareUrl);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <transition name="fade">
    <div v-if="mode" class="overlay" @click.self="emit('close')">
      <div class="modal">
        <div class="head">
          <h3>{{ mode === 'share' ? '分享你的宇宙' : '官方场景库' }}</h3>
          <button class="x" @click="emit('close')">✕</button>
        </div>

        <!-- 分享链接 -->
        <div v-if="mode === 'share'" class="share">
          <p class="desc">复制下方链接分享给他人，打开即加载你当前的宇宙（纯前端，无需服务器）。</p>
          <textarea class="url" readonly :value="shareUrl" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
          <div class="row">
            <button class="primary" @click="copy">{{ copied ? '✓ 已复制' : '复制链接' }}</button>
          </div>
          <p v-if="shareUrl.length > URL_SHARE_LIMIT" class="warn">
            链接较长（{{ shareUrl.length }} 字符），部分平台可能截断。建议改用
            <button class="link" @click="emit('export-file')">导出文件分享</button>。
          </p>
        </div>

        <!-- 场景库 -->
        <div v-else class="gallery">
          <p class="desc">精选宇宙，点击即刻加载。标注「实验」的场景建议切换到实验精度档观测。</p>
          <div class="grid">
            <button v-for="item in GALLERY" :key="item.key" class="card" @click="emit('pick', item)">
              <div class="card-top">
                <span class="card-name">{{ item.name }}</span>
                <span v-if="item.suggestedMode === 'precise'" class="tag">实验</span>
              </div>
              <span class="card-blurb">{{ item.blurb }}</span>
            </button>
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
  background: rgba(4, 6, 12, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}
.modal {
  width: 440px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  padding: 18px 20px;
  border-radius: 16px;
  background: rgba(14, 18, 32, 0.96);
  border: 1px solid rgba(120, 150, 220, 0.22);
  color: #cdd6f4;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
}
.x {
  background: transparent;
  border: none;
  color: #8893b0;
  font-size: 16px;
  cursor: pointer;
}
.x:hover {
  color: #cdd6f4;
}
.desc {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #9aa6c4;
}
.url {
  width: 100%;
  height: 72px;
  resize: none;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(8, 11, 20, 0.9);
  border: 1px solid rgba(120, 150, 220, 0.2);
  color: #a9c8ff;
  font-family: 'Consolas', monospace;
  font-size: 11px;
  word-break: break-all;
}
.row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.primary {
  flex: 1;
  padding: 9px;
  border-radius: 8px;
  background: #5b86b5;
  color: #fff;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.primary:hover {
  background: #6a97c7;
}
.warn {
  margin: 12px 0 0;
  font-size: 11px;
  color: #e8c97a;
  line-height: 1.6;
}
.link {
  background: none;
  border: none;
  color: #88ccff;
  text-decoration: underline;
  cursor: pointer;
  font-size: 11px;
  padding: 0;
}
.grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(30, 38, 60, 0.55);
  border: 1px solid rgba(120, 150, 220, 0.18);
  color: #cdd6f4;
  text-align: left;
  cursor: pointer;
  transition: background 0.16s, border-color 0.16s;
}
.card:hover {
  background: rgba(60, 80, 130, 0.55);
  border-color: rgba(120, 150, 220, 0.4);
}
.card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-name {
  font-size: 13px;
  font-weight: 600;
}
.tag {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(91, 227, 192, 0.18);
  color: #5be3c0;
  font-size: 10px;
  font-weight: 600;
}
.card-blurb {
  font-size: 11px;
  color: #9aa6c4;
  line-height: 1.5;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
