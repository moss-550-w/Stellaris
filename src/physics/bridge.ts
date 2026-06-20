/**
 * 物理仿真层 —— 主线程侧桥接
 * 封装 Worker 的创建、消息收发与销毁，向上层屏蔽通信细节。
 */
import type { PhysicsCommand, PhysicsOutbound } from './types';

export type PhysicsMessageHandler = (msg: PhysicsOutbound) => void;

export class PhysicsBridge {
  private readonly worker: Worker;

  constructor(onMessage: PhysicsMessageHandler) {
    // Vite 约定：new URL + import.meta.url 让 Worker 参与打包
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<PhysicsOutbound>): void => onMessage(e.data);
  }

  /** 发送指令；transfer 用于零拷贝转移 ArrayBuffer 所有权 */
  send(command: PhysicsCommand, transfer: Transferable[] = []): void {
    this.worker.postMessage(command, transfer);
  }

  dispose(): void {
    this.worker.terminate();
  }
}
