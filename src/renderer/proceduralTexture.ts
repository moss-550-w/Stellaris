/**
 * 渲染表现层 —— 程序化纹理生成（混合纹理策略首版）
 *
 * 阶段一用 value-noise + fBm 在主线程一次性生成 CanvasTexture：
 * - 行星：彩色基底 map + 灰度 bumpMap，叠加恒星光照后呈现岩质明暗立体感；
 * - 恒星：高亮暖色 map（自发光），辅以加性混合光晕 sprite。
 * GLSL 实时着色管线（vite-plugin-glsl 已就位）留待阶段三接入。
 */
import * as THREE from 'three';
import { PRNG } from '@/core/prng';

const GRID = 64;

/** 创建可平铺的 value-noise 采样器（双线性 + 平滑插值） */
function makeNoise(seed: number): (x: number, y: number) => number {
  const prng = new PRNG(seed);
  const grid = new Float32Array(GRID * GRID);
  for (let i = 0; i < grid.length; i++) grid[i] = prng.next();

  const at = (x: number, y: number): number => {
    const xi = ((x % GRID) + GRID) % GRID;
    const yi = ((y % GRID) + GRID) % GRID;
    return grid[yi * GRID + xi];
  };

  return (x: number, y: number): number => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
  };
}

/** 多倍频分形噪声，返回约 [0,1] */
function fbm(noise: (x: number, y: number) => number, x: number, y: number): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 5; o++) {
    v += amp * noise(x * freq, y * freq);
    freq *= 2;
    amp *= 0.5;
  }
  return v;
}

function createCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 2D 绘图上下文');
  return { canvas, ctx };
}

/** 生成岩质行星纹理：彩色 map + 灰度 bumpMap */
export function generatePlanetTexture(
  baseColor: number,
  seed: number,
  size = 256,
): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const noise = makeNoise(seed);
  const base = new THREE.Color(baseColor);

  const color = createCanvas(size);
  const bump = createCanvas(size);
  const colorImg = color.ctx.createImageData(size, size);
  const bumpImg = bump.ctx.createImageData(size, size);

  const scale = 6; // 噪声平铺密度
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = fbm(noise, (x / size) * scale, (y / size) * scale);
      const shade = 0.55 + f * 0.7; // 明暗因子
      const idx = (y * size + x) * 4;

      colorImg.data[idx] = Math.min(255, base.r * 255 * shade);
      colorImg.data[idx + 1] = Math.min(255, base.g * 255 * shade);
      colorImg.data[idx + 2] = Math.min(255, base.b * 255 * shade);
      colorImg.data[idx + 3] = 255;

      const g = Math.min(255, f * 255);
      bumpImg.data[idx] = g;
      bumpImg.data[idx + 1] = g;
      bumpImg.data[idx + 2] = g;
      bumpImg.data[idx + 3] = 255;
    }
  }
  color.ctx.putImageData(colorImg, 0, 0);
  bump.ctx.putImageData(bumpImg, 0, 0);

  const map = new THREE.CanvasTexture(color.canvas);
  const bumpTex = new THREE.CanvasTexture(bump.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump: bumpTex };
}

/** 生成恒星表面纹理：高亮暖色 + 微弱米粒斑驳 */
export function generateStarTexture(baseColor: number, seed: number, size = 256): THREE.CanvasTexture {
  const noise = makeNoise(seed);
  const base = new THREE.Color(baseColor);
  const { canvas, ctx } = createCanvas(size);
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = fbm(noise, (x / size) * 10, (y / size) * 10);
      const shade = 0.85 + f * 0.3;
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, base.r * 255 * shade);
      img.data[idx + 1] = Math.min(255, base.g * 255 * shade);
      img.data[idx + 2] = Math.min(255, base.b * 255 * shade);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 生成气态行星纹理：纬向条带 + fBm 湍流扰动，呈木星类外观（纯程序化）。
 */
export function generateGasTexture(baseColor: number, seed: number, size = 256): THREE.CanvasTexture {
  const noise = makeNoise(seed);
  const base = new THREE.Color(baseColor);
  const { canvas, ctx } = createCanvas(size);
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 湍流扰动纬度，使条带波动
      const warp = fbm(noise, (x / size) * 3, (y / size) * 3) - 0.5;
      const lat = y / size + warp * 0.08;
      const band = 0.5 + 0.5 * Math.sin(lat * Math.PI * 14);
      const shade = 0.7 + band * 0.5;
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.min(255, base.r * 255 * shade);
      img.data[idx + 1] = Math.min(255, base.g * 255 * shade);
      img.data[idx + 2] = Math.min(255, base.b * 255 * shade);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 生成径向渐变光晕纹理（用于加性混合 sprite） */
export function generateGlowTexture(baseColor: number, size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  const c = new THREE.Color(baseColor);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
  grad.addColorStop(0.25, `rgba(${r},${g},${b},0.45)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

/**
 * 生成黑洞吸积盘纹理（用于环面贴图）：内热外冷的橙白渐变 + 周向湍流亮纹，alpha 内外淡出。
 * U 为周向、V 为径向。
 */
export function generateAccretionTexture(seed: number, size = 256): THREE.CanvasTexture {
  const noise = makeNoise(seed);
  const { canvas, ctx } = createCanvas(size);
  const img = ctx.createImageData(size, size);

  for (let v = 0; v < size; v++) {
    const radial = v / size; // 0=内缘 1=外缘
    // 内热(白黄) → 外冷(暗红)
    const heat = 1 - radial;
    const rr = 255;
    const gg = 140 + heat * 110;
    const bb = 40 + heat * 150;
    const edge = Math.sin(radial * Math.PI); // 内外缘淡出
    for (let u = 0; u < size; u++) {
      const turb = 0.6 + 0.6 * fbm(noise, (u / size) * 12, (v / size) * 4);
      const idx = (v * size + u) * 4;
      img.data[idx] = Math.min(255, rr * turb);
      img.data[idx + 1] = Math.min(255, gg * turb);
      img.data[idx + 2] = Math.min(255, bb * turb);
      img.data[idx + 3] = Math.min(255, edge * turb * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
