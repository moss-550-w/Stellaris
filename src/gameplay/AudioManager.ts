/**
 * 玩法交互层 —— BGM 播放器
 *
 * 封装单个 HTMLAudioElement：随机洗牌、无缝循环、首交互自动播放、音量/开关持久化。
 * 与物理/渲染完全解耦，原生 Audio 主线程开销可忽略；逐曲加载，不预取全部资源。
 */
import { reactive } from 'vue';
import {
  TRACKS,
  loadAudioSettings,
  saveAudioSettings,
  type AudioSettings,
} from '@/store/audio';

export interface AudioUIState {
  /** 当前曲名 */
  title: string;
  /** 是否正在播放 */
  playing: boolean;
  /** 音量 0–1 */
  volume: number;
  /** 是否启用 BGM（播放意图，含自动播放） */
  enabled: boolean;
}

export class AudioManager {
  /** 供 UI 直接绑定的响应式状态 */
  readonly state: AudioUIState;

  private readonly el: HTMLAudioElement;
  private readonly order: number[];
  private cursor = 0;
  /** 首交互自动播放是否已触发（避免重复绑定） */
  private autoStarted = false;

  constructor() {
    const settings = loadAudioSettings();

    this.el = new Audio();
    this.el.loop = false; // 由 ended → next 实现整列随机循环
    this.el.preload = 'auto';
    this.el.volume = settings.volume;

    this.order = shuffle(TRACKS.map((_, i) => i));

    this.state = reactive<AudioUIState>({
      title: TRACKS[this.order[0]].title,
      playing: false,
      volume: settings.volume,
      enabled: settings.enabled,
    });

    this.el.addEventListener('ended', this.onEnded);
    this.el.addEventListener('play', this.onPlay);
    this.el.addEventListener('pause', this.onPause);

    this.loadTrack(0);

    // 浏览器禁止无手势自动出声：首次任意交互后尝试起播
    window.addEventListener('pointerdown', this.onFirstInteraction, { once: true });
    window.addEventListener('keydown', this.onFirstInteraction, { once: true });
  }

  // —— 对外接口 ——

  /** 播放/暂停切换；点击本身即用户手势，可直接出声 */
  toggle(): void {
    if (this.el.paused) {
      this.setEnabled(true);
      void this.tryPlay();
    } else {
      this.pause();
    }
  }

  next(): void {
    this.step(1);
  }

  prev(): void {
    this.step(-1);
  }

  setVolume(v: number): void {
    const vol = clamp01(v);
    this.el.volume = vol;
    this.state.volume = vol;
    this.persist();
  }

  /** 更新播放意图：关闭则暂停，开启且当前暂停则续播 */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    this.persist();
    if (!enabled) {
      this.pause();
    } else if (this.el.paused) {
      void this.tryPlay();
    }
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.onFirstInteraction);
    window.removeEventListener('keydown', this.onFirstInteraction);
    this.el.removeEventListener('ended', this.onEnded);
    this.el.removeEventListener('play', this.onPlay);
    this.el.removeEventListener('pause', this.onPause);
    this.el.pause();
    this.el.src = '';
  }

  // —— 内部实现 ——

  private readonly onFirstInteraction = (): void => {
    if (this.autoStarted) return;
    this.autoStarted = true;
    if (this.state.enabled) void this.tryPlay();
  };

  private readonly onEnded = (): void => this.step(1);
  private readonly onPlay = (): void => {
    this.state.playing = true;
  };
  private readonly onPause = (): void => {
    this.state.playing = false;
  };

  /** 切到队列偏移 delta 的曲目，播放中则续播 */
  private step(delta: number): void {
    const n = this.order.length;
    this.cursor = (this.cursor + delta + n) % n;
    const wasPlaying = !this.el.paused;
    this.loadTrack(this.cursor);
    if (wasPlaying || this.state.playing) void this.tryPlay();
  }

  private loadTrack(cursor: number): void {
    this.cursor = cursor;
    const track = TRACKS[this.order[cursor]];
    this.el.src = track.src;
    this.state.title = track.title;
  }

  private async tryPlay(): Promise<void> {
    try {
      await this.el.play();
    } catch {
      // 自动播放被拦截或加载失败：保持暂停态，等待用户手动触发
      this.state.playing = false;
    }
  }

  private pause(): void {
    this.el.pause();
  }

  private persist(): void {
    const s: AudioSettings = { enabled: this.state.enabled, volume: this.state.volume };
    saveAudioSettings(s);
  }
}

/** Fisher-Yates 洗牌（运行时随机，浅拷贝不改原数组） */
function shuffle(arr: number[]): number[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
