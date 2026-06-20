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
