/**
 * 工具 —— File API 文件导入/导出（纯前端，无后端）
 */

/** 触发浏览器下载文本文件 */
export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 触发 dataURL 下载（用于截图） */
export function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** 弹出文件选择器并读取为文本 */
export function pickTextFile(accept = '.json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (): void => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (): void => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = (): void => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}
