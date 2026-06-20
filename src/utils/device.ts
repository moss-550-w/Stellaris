/**
 * 工具 —— 设备检测
 *
 * 移动端默认降至低画质并以 30fps 为目标（CLAUDE.md 性能约定）。
 */
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const byUa = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
  const byTouch = typeof window !== 'undefined' && 'ontouchstart' in window && window.innerWidth < 920;
  return byUa || byTouch;
}
