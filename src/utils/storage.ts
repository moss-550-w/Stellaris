/**
 * 工具 —— 存档 / 读档
 *
 * 存档单位为 WorldState（与撤销/重做同源）。本地多槽位存于 LocalStorage，
 * 另支持 File API 导出/导入 .json，便于分享。
 */
import type { WorldState } from '@/physics/types';

const STORAGE_PREFIX = 'stellaris.save.';
const SLOT_INDEX_KEY = 'stellaris.saves';
// 版本 2：V2.0 阶段五新增天体演化字段（age/stage/baseRadius）与 evolutionScale。
// 旧版本 1 存档无这些字段，load 时由 World/normalize 补默认，保持向下兼容。
const SAVE_VERSION = 2;

export interface SaveFile {
  version: number;
  name: string;
  savedAt: string; // ISO 字符串
  presetKey: string;
  state: WorldState;
}

export interface SaveSlot {
  id: string;
  name: string;
  savedAt: string;
}

function readIndex(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(SLOT_INDEX_KEY);
    return raw ? (JSON.parse(raw) as SaveSlot[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(slots: SaveSlot[]): void {
  localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(slots));
}

/** 列出全部本地存档槽，按时间倒序 */
export function listSaves(): SaveSlot[] {
  return readIndex().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** 保存到本地（同名覆盖）。savedAt 由调用方传入以规避无参 Date 限制 */
export function saveLocal(name: string, presetKey: string, state: WorldState, savedAt: string): SaveSlot {
  const id = STORAGE_PREFIX + encodeURIComponent(name);
  const file: SaveFile = { version: SAVE_VERSION, name, savedAt, presetKey, state };
  localStorage.setItem(id, JSON.stringify(file));

  const slots = readIndex().filter((s) => s.id !== id);
  slots.push({ id, name, savedAt });
  writeIndex(slots);
  return { id, name, savedAt };
}

/** 读取本地存档 */
export function loadLocal(id: string): SaveFile | null {
  try {
    const raw = localStorage.getItem(id);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 删除本地存档 */
export function deleteLocal(id: string): void {
  localStorage.removeItem(id);
  writeIndex(readIndex().filter((s) => s.id !== id));
}

/** 序列化为可下载的 JSON 文本 */
export function serializeSave(name: string, presetKey: string, state: WorldState, savedAt: string): string {
  const file: SaveFile = { version: SAVE_VERSION, name, savedAt, presetKey, state };
  return JSON.stringify(file, null, 2);
}

/** 解析导入的 JSON 文本，校验结构 */
export function parseSave(text: string): SaveFile {
  const data = JSON.parse(text);
  const file = normalize(data);
  if (!file.state || !Array.isArray(file.state.bodies)) {
    throw new Error('存档格式无效：缺少天体数据');
  }
  return file;
}

/** 兼容性归一化：补全缺省字段 */
function normalize(data: unknown): SaveFile {
  const d = data as Partial<SaveFile>;
  return {
    version: d.version ?? SAVE_VERSION,
    name: d.name ?? '未命名',
    savedAt: d.savedAt ?? '',
    presetKey: d.presetKey ?? 'single',
    state: d.state as WorldState,
  };
}
