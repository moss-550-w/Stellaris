/**
 * 玩法交互层 —— 引力弹弓能量计
 *
 * 追踪选中天体的比动能(specific KE = ½v²)，检测引力弹弓（近距飞掠后净增速）。
 * 维护近期速率峰值与基线，输出当前速率、峰值、相对基线增益百分比。
 */
export interface EnergyReading {
  speed: number;
  peakSpeed: number;
  /** 相对基线的速率增益（%），正值表示获得能量（弹弓加速） */
  gainPct: number;
  slingshot: boolean;
}

export class EnergyMeter {
  private trackedId: number | null = null;
  private baseline = 0;
  private peak = 0;
  private lastSpeed = 0;
  private slingshotFlash = 0;

  track(id: number | null): void {
    if (id === this.trackedId) return;
    this.trackedId = id;
    this.baseline = 0;
    this.peak = 0;
    this.lastSpeed = 0;
    this.slingshotFlash = 0;
  }

  /** 每物理快照更新一次 */
  update(id: number, speed: number, dt: number): EnergyReading {
    if (id !== this.trackedId) {
      this.track(id);
    }
    if (this.baseline === 0) {
      this.baseline = speed;
      this.peak = speed;
    }
    // 基线缓慢跟踪（指数平滑），峰值快速捕捉
    this.baseline += (speed - this.baseline) * Math.min(1, dt * 0.5);
    if (speed > this.peak) this.peak = speed;

    const gainPct = this.baseline > 0 ? ((speed - this.baseline) / this.baseline) * 100 : 0;

    // 弹弓检测：短时显著增速（相对上一帧）
    if (speed > this.lastSpeed * 1.04 && this.lastSpeed > 0) {
      this.slingshotFlash = 0.8;
    } else {
      this.slingshotFlash = Math.max(0, this.slingshotFlash - dt);
    }
    this.lastSpeed = speed;

    return {
      speed,
      peakSpeed: this.peak,
      gainPct,
      slingshot: this.slingshotFlash > 0,
    };
  }
}
