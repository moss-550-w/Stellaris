/**
 * 状态管理 —— 画质设置
 *
 * 三档画质统一调节：渲染像素比、bloom 强度、星空密度、后处理开关。
 * 桌面默认 high，移动端可降至 low 以保 30fps。
 */
export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityProfile {
  /** 渲染像素比上限 */
  pixelRatioCap: number;
  /** 是否启用合并后处理 */
  postProcess: boolean;
  /** 星空点数 */
  starCount: number;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: { pixelRatioCap: 1, postProcess: false, starCount: 1200 },
  medium: { pixelRatioCap: 1.5, postProcess: true, starCount: 2200 },
  high: { pixelRatioCap: 2, postProcess: true, starCount: 3200 },
};

export const QUALITY_LABELS: Record<QualityLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

export const DEFAULT_QUALITY: QualityLevel = 'high';
