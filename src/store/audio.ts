/**
 * 状态管理 —— BGM 背景音乐
 *
 * 曲目清单 + 用户偏好（音量 / 开关）持久化。曲目资源位于 public/audio/，
 * 路径用 base 感知前缀并对文件名转义，兼容 GitHub Pages 子路径与离线运行。
 */

export interface Track {
  /** 展示用曲名（文件名去扩展名） */
  title: string;
  /** 可直接喂给 <audio> 的 src（已处理 base 与空格转义） */
  src: string;
}

export interface AudioSettings {
  /** 是否启用 BGM（控制首交互自动播放与播放意图） */
  enabled: boolean;
  /** 音量 0–1 */
  volume: number;
}

/** public/audio/ 下的曲目文件名（含空格，src 构造时统一转义） */
const TRACK_FILES = [
  'Deep Space Silence.mp3',
  'Drift Among Stars.mp3',
  'Cold Void Burst.mp3',
  'Event Horizon Drift.mp3',
  'Stardust.mp3',
  'Visual Diffusion.mp3',
  'Drift Beyond Orion.mp3',
  'Ring of Creation.mp3',
];

/** base 感知的音频目录前缀（base:'./' → './'） */
const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/`;

export const TRACKS: Track[] = TRACK_FILES.map((file) => ({
  title: file.replace(/\.mp3$/i, ''),
  src: `${AUDIO_BASE}${encodeURIComponent(file)}`,
}));

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { enabled: true, volume: 0.4 };

const STORAGE_KEY = 'stellaris.audio';

/** 读取本地音频偏好，缺失或损坏时回退默认值 */
export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const d = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      enabled: typeof d.enabled === 'boolean' ? d.enabled : DEFAULT_AUDIO_SETTINGS.enabled,
      volume: clamp01(typeof d.volume === 'number' ? d.volume : DEFAULT_AUDIO_SETTINGS.volume),
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

/** 写入本地音频偏好 */
export function saveAudioSettings(s: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* LocalStorage 不可用时静默降级，不影响播放 */
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
