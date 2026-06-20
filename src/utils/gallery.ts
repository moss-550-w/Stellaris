/**
 * 工具 —— 官方精选场景库（V2.0 阶段八，纯前端·静态打包）
 *
 * 内置精选宇宙作为「场景库」，构建时静态打包进产物，零后端、离线可用。
 * 每个条目复用 `presets.ts` 的 build 函数即时生成 `WorldState`，避免重复维护初值，
 * 并附带面向玩家的导览文案与建议精度档（实验场景提示切实验档观测）。
 */
import type { IntegrationMode, WorldState } from '@/physics/types';
import { PRESETS, toWorldState } from '@/gameplay/presets';

export interface GalleryItem {
  key: string;
  name: string;
  /** 一句话导览 */
  blurb: string;
  /** 建议精度档（实验场景为 'precise'） */
  suggestedMode: IntegrationMode;
  /** 即时生成世界状态（复用预设 build） */
  build: () => WorldState;
}

/** 由预设 key 取其 build 并组装为 WorldState */
function fromPreset(key: string): () => WorldState {
  const def = PRESETS.find((p) => p.key === key);
  return () => toWorldState(def ? def.build() : PRESETS[0].build());
}

export const GALLERY: GalleryItem[] = [
  {
    key: 'single',
    name: '经典恒星系',
    blurb: '单恒星 + 四颗行星的稳定圆轨道，宇宙沙盘的起点。',
    suggestedMode: 'fluid',
    build: fromPreset('single'),
  },
  {
    key: 'binary',
    name: '双星共舞',
    blurb: '两颗恒星绕共同质心旋转，外侧行星环双星运行。',
    suggestedMode: 'standard',
    build: fromPreset('binary'),
  },
  {
    key: 'blackhole',
    name: '黑洞引力透镜',
    blurb: '近距天体绕黑洞运行，正对时可见全屏光线偏折。',
    suggestedMode: 'standard',
    build: fromPreset('blackhole'),
  },
  {
    key: 'figure8',
    name: '8 字三体周期解',
    blurb: '三星沿同一条 8 字曲线永恒追逐——切「实验」档见证精确周期。',
    suggestedMode: 'precise',
    build: fromPreset('figure8'),
  },
  {
    key: 'lagrange',
    name: '拉格朗日 L4/L5',
    blurb: '特洛伊小天体在平衡点天平动，「实验」档可观测守恒量。',
    suggestedMode: 'precise',
    build: fromPreset('lagrange'),
  },
];
