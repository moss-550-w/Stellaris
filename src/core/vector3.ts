/**
 * 基础内核层 —— 三维矢量
 *
 * 设计要点：
 * - 同时提供「就地运算」(addInPlace 等) 与「返回新对象」(add 等) 两套接口。
 *   物理积分热路径优先用就地运算，避免高频 GC。
 * - 与 Three.js 的 Vector3 解耦：物理层不依赖渲染库，保持基础内核层纯净。
 */
export class Vec3 {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v: Vec3): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  // —— 就地运算（修改自身，返回 this）——

  addInPlace(v: Vec3): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  subInPlace(v: Vec3): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  scaleInPlace(s: number): this {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  /** this += v * s，积分步进常用 */
  addScaledInPlace(v: Vec3, s: number): this {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }

  // —— 纯运算（返回新对象）——

  add(v: Vec3): Vec3 {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v: Vec3): Vec3 {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s: number): Vec3 {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vec3): Vec3 {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length(): number {
    return Math.sqrt(this.lengthSq());
  }

  distanceToSq(v: Vec3): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  distanceTo(v: Vec3): number {
    return Math.sqrt(this.distanceToSq(v));
  }

  normalize(): Vec3 {
    const len = this.length();
    return len > 0 ? this.scale(1 / len) : new Vec3();
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  static zero(): Vec3 {
    return new Vec3(0, 0, 0);
  }
}
