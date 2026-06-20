/**
 * 基础内核层 —— 带种子的伪随机数生成器 (mulberry32)
 *
 * 关键约定：状态可读写 (getState/setState)，用于撤销/重做的「完整系统快照」——
 * 每次快照需记录随机种子状态，回滚后随机序列可精确复现。
 */
export class PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** 返回 [0, 1) 区间的随机数 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 返回 [min, max) 区间的随机数 */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** 返回 [min, max] 区间的随机整数 */
  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** 读取当前状态，用于快照 */
  getState(): number {
    return this.state;
  }

  /** 恢复状态，用于快照回滚 */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}
