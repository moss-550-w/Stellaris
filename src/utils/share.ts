/**
 * 工具 —— 在线分享编解码（V2.0 阶段八，纯前端·零后端）
 *
 * 设计：WorldState → JSON → deflate-raw 压缩（浏览器原生 CompressionStream）→ base64url，
 * 拼为可分享 URL（`#share=<token>`）。压缩不可用时回退明文，解码端按首字标记自动识别。
 *
 * 红线：全程不依赖任何后端。分享串完全自包含，离线 / 静态托管均可解码加载。
 * 兼容：payload 含 `v` 版本号；解码对缺省字段做 normalize，向下兼容 V1.0 存档结构
 *       （per-body 演化 / 航天器字段缺失由物理层 `World.load` 补默认）。
 */
import type { WorldState } from '@/physics/types';

/** 分享格式版本（结构演进时递增；解码按需迁移） */
export const SHARE_VERSION = 1;

/** URL hash 中分享串的键名 */
export const SHARE_HASH_KEY = 'share';

/** 经验上较安全的 URL 长度上限；超出建议降级为文件分享 */
export const URL_SHARE_LIMIT = 8000;

/** 首字编码标记：压缩 / 明文，使解码端无需额外元数据即可识别 */
const MARK_DEFLATE = 'D';
const MARK_PLAIN = 'P';

export interface SharePayload {
  v: number;
  presetKey: string;
  state: WorldState;
}

export interface ShareData {
  presetKey: string;
  state: WorldState;
}

// —— base64url ——

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  // 分块避免超大 apply 栈溢出
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// —— 压缩（原生 CompressionStream，按需回退）——

function hasCompression(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/** 拷入一块独立 ArrayBuffer，规避 lib.dom 将 Uint8Array 视作可能 SharedArrayBuffer 的类型分歧 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}

/** 经 deflate-raw 压缩。用 Blob.stream().pipeThrough 避开 writer 的 BufferSource 类型分歧 */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

// —— 编解码 ——

/** 将世界状态编码为自包含分享串（含格式标记 + 版本，往返无损） */
export async function encodeShare(presetKey: string, state: WorldState): Promise<string> {
  const payload: SharePayload = { v: SHARE_VERSION, presetKey, state };
  const json = JSON.stringify(payload);
  const raw = new TextEncoder().encode(json);
  if (hasCompression()) {
    const packed = await deflate(raw);
    return MARK_DEFLATE + bytesToB64url(packed);
  }
  return MARK_PLAIN + bytesToB64url(raw);
}

/** 解码分享串为世界状态（normalize 兼容旧结构）。非法输入抛错。 */
export async function decodeShare(token: string): Promise<ShareData> {
  if (!token || token.length < 2) throw new Error('分享串为空或过短');
  const mark = token[0];
  const body = token.slice(1);
  const bytes = b64urlToBytes(body);

  let raw: Uint8Array;
  if (mark === MARK_DEFLATE) {
    if (!hasCompression()) throw new Error('当前环境不支持解压（CompressionStream 缺失）');
    raw = await inflate(bytes);
  } else if (mark === MARK_PLAIN) {
    raw = bytes;
  } else {
    throw new Error('未知分享格式标记');
  }

  const json = new TextDecoder().decode(raw);
  const data = JSON.parse(json) as Partial<SharePayload>;
  return normalize(data);
}

/** 兼容性归一化：校验并补全缺省字段 */
function normalize(data: Partial<SharePayload>): ShareData {
  const state = data.state;
  if (!state || !Array.isArray(state.bodies)) {
    throw new Error('分享数据无效：缺少天体数据');
  }
  return {
    presetKey: data.presetKey ?? 'single',
    state: {
      bodies: state.bodies,
      simYears: state.simYears ?? 0,
      nextId: state.nextId ?? state.bodies.length + 1,
      rngState: state.rngState ?? 0x9e3779b9,
      evolutionScale: state.evolutionScale,
    },
  };
}

// —— URL 集成 ——

/** 由分享串构造完整可分享 URL（基于当前页面地址，纯前端 hash 路由） */
export function buildShareUrl(token: string, base = location.href): string {
  const url = base.split('#')[0];
  return `${url}#${SHARE_HASH_KEY}=${token}`;
}

/** 从 URL hash 中提取分享串；无则返回 null */
export function readShareFromHash(hash = location.hash): string | null {
  const m = hash.match(new RegExp(`[#&]${SHARE_HASH_KEY}=([^&]+)`));
  return m ? m[1] : null;
}

/** 清除地址栏 hash 中的分享串（加载后避免刷新重复加载），保留其它 hash 段 */
export function clearShareHash(): void {
  if (readShareFromHash() === null) return;
  const cleaned = location.hash
    .replace(new RegExp(`[#&]${SHARE_HASH_KEY}=[^&]+`), '')
    .replace(/^#?&?/, '');
  const base = location.href.split('#')[0];
  history.replaceState(null, '', cleaned ? `${base}#${cleaned}` : base);
}
