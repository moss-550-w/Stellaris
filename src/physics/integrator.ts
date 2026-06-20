/**
 * 物理仿真层 —— velocity Verlet 全 N 体积分器
 *
 * 标准模式积分核心：能量漂移小、可逆性好，满足千年尺度稳定性。
 * 所有缓冲均由调用方预分配并复用，热路径零分配。
 */
import { G, SOFTENING } from './constants';

/**
 * 计算全 N 体引力加速度，结果写入 acc（内部先清零再累加）。
 * 利用牛顿第三定律，成对计算，复杂度 O(N²/2)。
 */
export function computeAccelerations(
  positions: Float64Array,
  masses: Float64Array,
  count: number,
  acc: Float64Array,
): void {
  acc.fill(0);
  const soft2 = SOFTENING * SOFTENING;

  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    const xi = positions[ix];
    const yi = positions[ix + 1];
    const zi = positions[ix + 2];

    for (let j = i + 1; j < count; j++) {
      const jx = j * 3;
      const dx = positions[jx] - xi;
      const dy = positions[jx + 1] - yi;
      const dz = positions[jx + 2] - zi;

      const r2 = dx * dx + dy * dy + dz * dz + soft2;
      const invR = 1 / Math.sqrt(r2);
      const invR3 = invR * invR * invR;
      const f = G * invR3;

      // i 受 j 吸引
      const fi = f * masses[j];
      acc[ix] += dx * fi;
      acc[ix + 1] += dy * fi;
      acc[ix + 2] += dz * fi;

      // j 受 i 吸引（反向）
      const fj = f * masses[i];
      acc[jx] -= dx * fj;
      acc[jx + 1] -= dy * fj;
      acc[jx + 2] -= dz * fj;
    }
  }
}

/**
 * velocity Verlet 单步，就地更新 positions / velocities。
 * accOld 须为「当前位置」对应的加速度；步进后 accOld 被更新为新位置的加速度，可直接用于下一步。
 */
export function verletStep(
  positions: Float64Array,
  velocities: Float64Array,
  masses: Float64Array,
  count: number,
  dt: number,
  accOld: Float64Array,
  accNew: Float64Array,
): void {
  const n = count * 3;
  const halfDt2 = 0.5 * dt * dt;

  // x(t+dt) = x + v*dt + 0.5*a*dt²
  for (let k = 0; k < n; k++) {
    positions[k] += velocities[k] * dt + accOld[k] * halfDt2;
  }

  computeAccelerations(positions, masses, count, accNew);

  // v(t+dt) = v + 0.5*(a_old + a_new)*dt
  const halfDt = 0.5 * dt;
  for (let k = 0; k < n; k++) {
    velocities[k] += (accOld[k] + accNew[k]) * halfDt;
  }

  // 新加速度成为下一步的旧加速度
  accOld.set(accNew);
}

/**
 * 半隐式（辛）欧拉单步 —— 流畅模式核心。
 * 每步仅一次加速度计算，先用当前加速度更新速度，再用新速度更新位置；
 * 相比显式欧拉具备半辛性质，长期能量更稳定，性能优于 Verlet，利于支撑更多天体。
 * acc 为复用的临时缓冲。
 */
export function semiImplicitEulerStep(
  positions: Float64Array,
  velocities: Float64Array,
  masses: Float64Array,
  count: number,
  dt: number,
  acc: Float64Array,
): void {
  computeAccelerations(positions, masses, count, acc);
  const n = count * 3;
  for (let k = 0; k < n; k++) {
    velocities[k] += acc[k] * dt;
    positions[k] += velocities[k] * dt;
  }
}

// —— RK4（经典 4 阶龙格-库塔）：实验精度档（V2.0 阶段七）——
// 自带 4 阶精度、不依赖历史加速度，与 Verlet/欧拉档天然隔离。
// 模块级 scratch 按需增长复用，热路径零分配（Worker 单实例，安全）。
let rk4N = 0;
let a1!: Float64Array, a2!: Float64Array, a3!: Float64Array, a4!: Float64Array;
let vt1!: Float64Array, vt2!: Float64Array, vt3!: Float64Array, xt!: Float64Array;

function ensureRk4(n: number): void {
  if (n <= rk4N) return;
  a1 = new Float64Array(n);
  a2 = new Float64Array(n);
  a3 = new Float64Array(n);
  a4 = new Float64Array(n);
  vt1 = new Float64Array(n);
  vt2 = new Float64Array(n);
  vt3 = new Float64Array(n);
  xt = new Float64Array(n);
  rk4N = n;
}

/**
 * RK4 单步，就地更新 positions / velocities。
 * 对二阶 ODE（pos' = vel，vel' = accel(pos)）做四级求值。
 */
export function rk4Step(
  positions: Float64Array,
  velocities: Float64Array,
  masses: Float64Array,
  count: number,
  dt: number,
): void {
  const n = count * 3;
  ensureRk4(n);
  const hdt = 0.5 * dt;

  // 级 1
  computeAccelerations(positions, masses, count, a1);
  for (let k = 0; k < n; k++) {
    vt1[k] = velocities[k] + hdt * a1[k];
    xt[k] = positions[k] + hdt * velocities[k];
  }
  // 级 2
  computeAccelerations(xt, masses, count, a2);
  for (let k = 0; k < n; k++) {
    vt2[k] = velocities[k] + hdt * a2[k];
    xt[k] = positions[k] + hdt * vt1[k];
  }
  // 级 3
  computeAccelerations(xt, masses, count, a3);
  for (let k = 0; k < n; k++) {
    vt3[k] = velocities[k] + dt * a3[k];
    xt[k] = positions[k] + dt * vt2[k];
  }
  // 级 4
  computeAccelerations(xt, masses, count, a4);

  const sixth = dt / 6;
  for (let k = 0; k < n; k++) {
    positions[k] += sixth * (velocities[k] + 2 * vt1[k] + 2 * vt2[k] + vt3[k]);
    velocities[k] += sixth * (a1[k] + 2 * a2[k] + 2 * a3[k] + a4[k]);
  }
}
