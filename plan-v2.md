# plan-v2.md —— Stellaris V2.0 开发路线图

> 本文件是《游戏级群星运行模拟器》**V2.0** 的可落地开发路线图，承接 V1.0 的 [`plan.md`](./plan.md)（阶段零~四已全部完成）。
> V2.0 四大方向源自 [`CLAUDE.md`](./CLAUDE.md)「V2.0 规划」：**天体演化、航天器与探测器、高精度实验模块、在线分享**。本文档为其可执行展开。

**状态图例：** `[ ]` 未开始 · `[~]` 进行中 · `[x]` 已完成

**阶段编号：** 承接 V1.0（阶段零~四），V2.0 自 **阶段五** 起，避免混淆。

---

## 1. V2.0 总览与原则

**定位升级：** 在 V1.0「可玩沙盒」之上，为宇宙增加四个维度——

| 维度 | 方向 | 一句话 |
|------|------|--------|
| 时间纵深 | 天体演化 | 让宇宙随时间生长，恒星走完生命周期 |
| 可控载具 | 航天器与探测器 | 玩家发射受控载具，体验轨道机动与借力飞行 |
| 严肃模式 | 高精度实验模块 | 可选的科学实验精度，守恒量可监测 |
| 社区流通 | 在线分享（纯前端） | 作品可分享、围观、再创作，零后端 |

**沿用 V1.0 五大原则：** 体验优先 · 物理自洽 · 视觉震撼 · 交互自由 · 性能可控。

**V2.0 新增约束：**
1. **演化不破坏感知时间**：演化时标统一映射感知时间系统（`core/time.ts`），不做亿年级真实积分。
2. **高精度隔离**：高精度为可选「实验精度」第三档，独立于 V1.0 娱乐流畅 / 平衡标准双档，不污染默认手感。
3. **零后端红线**：在线分享纯前端实现；任何托管后端均不纳入 V2.0（第三方图床由用户自带，不属本项目后端）。
4. **存档向下兼容**：每次扩展 `WorldState` / `SerializedBody` 必须升存档版本号，并在 `storage.ts` / `share.ts` 做 normalize 兼容 V1.0 存档。

**复用资产（V1.0 现有模块）：** `physics/world.ts`、`physics/integrator.ts`、`physics/collision.ts`、`gameplay/presets.ts`、`gameplay/challenges.ts`、`gameplay/energyMeter.ts`、`gameplay/habitableZone.ts`、`renderer/CelestialFactory.ts`、`renderer/effects.ts`、`utils/storage.ts`、`utils/fileIo.ts`、`utils/scienceData.ts`。各阶段「复用与改动点」逐一引用。

---

## 2. 阶段五：天体演化 ✅ 已完成（2026-06-20）

**目标：** 天体具备生命周期与状态变迁，让宇宙「随时间生长」。

**设计要点：**
- 物理侧扩展 `World` 与 `SerializedBody`：新增 `age`（演化年龄）、`stage`（演化阶段）、`baseRadius`（主序基准半径）。
- 演化引擎 `physics/evolution.ts`（Worker 内，每物理 tick 低频步进，与物理积分解耦）：恒星按 (质量, 年龄) 纯函数走 主序 → 红巨星 → 白矮星 / 中子星 / 黑洞；阶段为纯函数 → 撤销/重做与序列化天然安全。
- 渲染侧 `CelestialFactory` 按 `stage` 切换外观（半径缩放 / 颜色 / 黑洞类型转换），复用现有 `syncBodies` 增量重建。
- UI：信息卡显示演化阶段与剩余寿命；新增「演化倍率」档位（独立于物理 `timeScale`）。

**任务清单：**
- [x] `SerializedBody`/`NewBody`/`BodyMeta` 扩展演化字段 + `EvolutionStage` 类型；存档版本号 1→2，`storage.ts` 升级，`World.load` 对旧存档缺字段补默认（向下兼容）。
- [x] `evolution.ts`：主序寿命 ∝ M^(-2.5)、阶段判定、按质量分遗骸（白矮/中子/黑洞）、超新星阈值、各阶段外观参数。
- [x] Worker 演化低频步进（`World.evolveStep`，原子跃迁对 swap-remove 安全）+ `EvolutionEvent` 消息 + `setEvolutionScale` 指令。
- [x] 渲染按阶段变更外观 + 跃迁特效（`effects.ts` 新增 `spawnEvolution`，超新星金白大爆发）。
- [x] 演化倍率 UI（`ControlPanel.vue` 演化档位）+ 信息卡阶段/剩余寿命展示（`EditorPanel.vue`）。
- [x] 新挑战「见证超新星」（`challenges.ts`，控制器累计超新星次数判定）。

**交付物：** 恒星可在感知时间内走完生命周期并触发视觉跃迁的演化沙盒。

**验收结果（全部达成）：**
- `vue-tsc --noEmit` 零错误；`vite build` 成功（62 模块，worker 11.8kB 含演化引擎）。
- 演化逻辑（独立脚本核验）：1M 阶段时序（主序→红巨星→白矮星）正确；遗骸按质量（1M→白矮/2M→中子/5M→黑洞）；超新星阈值（>1.4M）；主序寿命质量反比；**V1.0 存档缺字段补默认完全兼容**。
- 阶段跃迁为原子操作，对碰撞 swap-remove 索引天然安全；`npm run dev` 启动无报错，全部模块 HTTP 200。

**复用与改动点：** `types.ts`（演化类型/事件/指令）、`world.ts`（演化状态与步进）、`worker.ts`（演化步进与事件）、`evolution.ts`（新增引擎）、`CelestialFactory.ts`（按 meta 外观，无需改）、`effects.ts`（跃迁特效）、`challenges.ts`、`storage.ts`（版本兼容）、`ControlPanel.vue`/`EditorPanel.vue`/`App.vue`（UI）。

**说明 / 顺延：** 派生量 `luminosity`/`temperature` 以质量近似体现于外观（颜色/半径），未单列字段；气态/岩质吸积与冷却（演化的非恒星部分）留作后续。

---

## 3. 阶段六：航天器与探测器 ✅ 已完成（2026-06-20）

**目标：** 玩家可发射受控载具，体验轨道机动与引力弹弓（呼应 V1.0 已有「引力弹弓能量计」）。

**设计要点（已落地）：**
- 类别 `spacecraft`：`mass=0` 的天体在现有积分器中**天然即测试粒子**——受真实天体引力（`fi=f·masses[j]`），对外施力为零（`fj=f·masses[i]=0`），无需改动积分热路径内循环，零额外 N 体成本风险。
- 推力作为引力步进**之后的冲量**施加（`World.applyThrust`），与 Verlet 引力积分解耦：prograde/retrograde 沿/反速度方向，Δv = maxThrust×dt，燃料按 Δv 等量消耗。**燃料即 Δv 预算**。
- 交互：工具栏「🚀 发射」一键放出探测器并自动选中；编辑器内推力模式（顺/逆/停）+ 实时燃料条；预测线复用 V1.0 `predictTrajectory`（显示无动力滑行轨迹，利于规划点火）。
- 探测器飞掠天体（距离 < 半径×4）→ 解锁该类型科普卡 + 飞掠提示 toast。

**任务清单：**
- [x] `BodyType`/`NewBody`/`SerializedBody`/`BodyMeta` 增 spacecraft 与推力字段；`ThrustMode` 类型；`SnapshotMessage` 增 `fuels` 实时燃料；`setShipControl` 指令。
- [x] `World` 推力/燃料平行数组 + `applyThrust` 冲量模型 + `setShipControl`；序列化/load/metas/snapshot 全链路；存档版本 2 兼容。
- [x] Worker `setShipControl` 分发 + 快照 `fuels` Transferable 回传。
- [x] 航天器渲染（`CelestialFactory` 青色八面体 + 引擎辉光）+ `makeSpacecraft` 预设（绕场景主导质量近圆轨道，自带燃料）。
- [x] 控制器：`launchSpacecraft`（自动选中）、`setShipThrust`、飞掠检测解锁科普、燃料入 `SelectedInfo`。
- [x] UI：`Toolbar` 发射按钮、`EditorPanel` 推力控制 + 燃料条、飞掠 toast、新挑战「引力弹弓」（探测器达 8 AU/年）。

**交付物：** 可发射、推进、借力飞行并采集科普的探测器系统。

**验收结果（全部达成）：**
- `vue-tsc --noEmit` 零错误；`vite build` 成功（62 模块，worker 13.5kB 含推力系统）。
- 逻辑正确性（独立脚本核验）：**测试粒子单向引力**（航天器加速度 39.478 = GM/r²、恒星加速度恒为 0）；**推力 Δv 精确等于燃料预算**（3.6）；顺行加速（3→6.6）/逆行减速（5→1.4）均精确。
- `npm run dev` 启动无报错，全部模块 HTTP 200。

**复用与改动点：** `types.ts`（spacecraft 类型/字段/指令）、`world.ts`（推力/燃料/测试粒子）、`worker.ts`（指令+快照燃料）、`integrator.ts`（**未改**，mass=0 天然测试粒子）、`CelestialFactory.ts`、`presets.ts`、`SimulationController.ts`、`scienceData.ts`、`challenges.ts`、`Toolbar.vue`/`EditorPanel.vue`/`App.vue`。

**说明 / 顺延：** 推力为「顺/逆行」即时冲量模型，自动霍曼转移与任意朝向推力留作后续；探测器视觉为简化标记，精细建模留作打磨。

---

## 4. 阶段七：高精度实验模块 ✅ 已完成（2026-06-20）

**目标：** 提供严肃科学模式，作为 V1.0 两档精度之上的可选「实验精度」第三档。

**设计要点（已落地）：**
- 积分器升级：新增 **RK4（经典四阶 Runge–Kutta）**，自带 4 阶精度、**不依赖历史加速度**（与 Verlet 的 `accOld` 无耦合）→ 作为第三档**天然隔离**，不污染娱乐 / 标准双档热路径。
- 守恒量监测：`physics/diagnostics.ts` 计算系统总能量（KE+PE）与总角动量 `|Σ mᵢ(rᵢ×vᵢ)|`；Worker 仅在实验档**低频回传**（≈0.25s/次），主线程 HUD 展示数值与相对基线漂移，并对漂移健康度配色。
- 守恒基线在「进入实验档 / 加载 / 结构变化（碰撞 / 演化 / 编辑 / 撤销）」时重建，漂移自基线起算，避免结构突变误判为积分误差。
- 实验场景：**8 字三体周期解**（Chenciner–Montgomery，G=4π² 下速度 ×2π 重标度）、**拉格朗日 L4/L5 特洛伊**（主星+行星+两枚 mass=0 测试粒子，M/m=1000 满足三角点线性稳定判据），`PresetDef.experiment` 标记分组。
- 报告导出：诊断时间序列抽稀保持有界（≤2000 点、超限折半翻倍间隔保留全时间跨度），一键导出 CSV（复用 `fileIo.ts`）。

**任务清单：**
- [x] `integrator.ts` 增 RK4（模块级惰性 scratch，零热路径分配）；`IntegrationMode` 增 `'precise'` 第三档（与娱乐 / 标准隔离）；`World.step` 按档分发。
- [x] `diagnostics.ts` 守恒量（能量 / 角动量）+ Worker 低频 `DiagnosticsMessage` 回传 + 基线重建（`invalidateDiagnostics`）+ `setMode precise` 立即回传一帧。
- [x] 守恒量 HUD（`DiagnosticsHud.vue`）：能量 / 角动量 / 双漂移实时显示 + 漂移健康度配色 + 导出按钮。
- [x] 实验预设场景（8 字三体、L4/L5）扩展 `presets.ts`（`experiment` 标记）。
- [x] 实验报告导出（守恒量时间序列 CSV，`SimulationController.exportDiagnosticsCsv` + `App.vue` 下载）。

**交付物：** 带守恒量监测与经典实验场景的高精度实验模式。

**验收结果（全部达成）：**
- `vue-tsc --noEmit` 零错误；`vite build` 成功（65 模块，worker 15.1kB 含 RK4+诊断）；`npm run dev` 全模块 HTTP 200。
- 守恒量对比（8 字编舞跑 5 年，独立脚本核验）：**RK4 能量漂移 1.98e-7 vs 半隐式欧拉 3.39e-3**（优 4 个数量级），印证第三档精度与诊断有效性。
- 经典周期解稳定：8 字编舞跑满一周期（T≈1.0068 年）位形闭合（最大偏差 7.7e-3 AU）；L4 特洛伊跑 10 行星周期轨道半径偏移仅 0.15 AU（有界天平动，未逃逸）。
- 隔离验证：RK4 不读写 `accOld`，娱乐 / 标准双档代码路径与手感零改动。

**复用与改动点：** `integrator.ts`（RK4）、`diagnostics.ts`（新增守恒量）、`types.ts`（第三档枚举 + `DiagnosticsMessage`）、`world.ts`（按档分发）、`worker.ts`（低频诊断+基线）、`presets.ts`（实验场景）、`SimulationController.ts`（采样+CSV）、`DiagnosticsHud.vue`（新增 HUD）、`Toolbar.vue`（实验档按钮）、`App.vue`（HUD 接线+报告下载）。

**说明 / 顺延：** 守恒量 HUD 已承担「精确数值观测」职责；`EditorPanel` 的高精度初值编辑面板（任意精度数值输入框）作为打磨项顺延——当前实验场景由预设提供精确初值，已满足经典实验需求。自适应步长留作后续（RK4 定步长在感知时间窗内已远超标准档精度）。

---

## 5. 阶段八：在线分享（纯前端）✅ 已完成（2026-06-20）

**目标：** 宇宙作品可被分享、围观、再创作——全程零后端。

**设计要点（已落地，严守纯前端）：**
- 分享编码：`WorldState` → JSON → **deflate-raw 压缩**（浏览器原生 `CompressionStream`，不可用时回退明文）→ base64url → **可分享 URL**（`#share=<token>`）。首字标记（`D`/`P`）使解码端自识别压缩/明文，分享串完全自包含、离线可解。
- 加载：启动时解析 `location.hash`，携带分享串则解码加载并 `clearShareHash` 清理（避免刷新重复加载）。扩展 `App.vue onMounted`。
- 容量降级：分享 URL 超 `URL_SHARE_LIMIT`（8000 字符）时弹窗提示改用「导出文件分享」；第三方图床留作用户自带（不属本项目后端）。
- 画廊：内置精选场景库（`utils/gallery.ts`），复用 `presets.ts` 的 build 即时生成 `WorldState`（含 8 字三体 / L4·L5 实验场景），点击即加载并自动切换建议精度档；静态打包进构建产物，零后端。

**任务清单：**
- [x] 分享编解码 `utils/share.ts`（deflate-raw + base64url，往返无损，含 `SHARE_VERSION` 版本号 + normalize 向下兼容）。
- [x] URL 分享：生成链接按钮 + 复制 + 启动解析加载（`SaveMenu.vue` 分享入口、`ShareGallery.vue` 弹窗、`App.vue` 启动解析）。
- [x] 超限降级到文件分享提示（`ShareGallery.vue` 超长警示 → 导出文件）。
- [x] 静态精选场景库 `utils/gallery.ts` + 画廊浏览 UI（`ShareGallery.vue` gallery 模式，实验场景标签 + 建议档自动切换）。
- [~] 分享链接含缩略图预览：顺延——URL 分享以紧凑为先（截图 dataURL 体积过大不宜入 URL），缩略图更适合未来文件分享形态。

**交付物：** 一键生成分享链接、打开即加载他人宇宙、内置官方场景库的纯前端分享体系。

**验收结果（全部达成）：**
- `vue-tsc --noEmit` 零错误；`vite build` 成功（70 模块）；`npm run dev` 全模块 HTTP 200。
- 编解码往返无损（独立脚本核验）：V2.0 完整状态（演化+航天器字段）往返一致；**V1.0 旧结构兼容解码**（缺字段补默认）；50 天体压缩至 JSON 体积 **21%**（13.9KB→2.9KB token，远低于 URL 上限）。
- 零后端红线未破：分享串自包含、`CompressionStream` 为浏览器原生、画廊静态打包，离线 / 静态托管均可用。

**复用与改动点：** `share.ts`（新增编解码）、`gallery.ts`（新增场景库）、`ShareGallery.vue`（新增弹窗 UI）、`SaveMenu.vue`（分享/场景库入口）、`App.vue`（生成链接+启动解析+画廊加载）、`storage.ts`/`fileIo.ts`（复用序列化与下载）、`presets.ts`（画廊复用 build）。

**说明 / 顺延：** 分享缩略图、第三方图床上传适配作为打磨/扩展项顺延，不影响核心分享闭环。

---

## 6. 阶段九：氛围 BGM（沉浸音乐）✅ 已完成（2026-06-21）

**目标：** 为「视觉沉浸优先」的宇宙补上听觉氛围层——发布前内容打磨增量。呼应 CLAUDE.md 阶段四「内容填充 / UI 动画」未覆盖的沉浸音乐，**不属 V2.0 原四大方向**，纯前端、零新增依赖。

**设计要点（已落地，严守解耦）：**
- **完全解耦**：BGM 独立于物理 / 渲染 / `SimUIState`，原生 `HTMLAudioElement` 主线程开销可忽略，不触碰物理 Worker 与渲染热路径；自包含组件持有播放器生命周期，App 仅一行接线。
- **资源路径**：6 首 `public/audio/` 太空氛围 mp3，曲目 src 用 base 感知前缀（`import.meta.env.BASE_URL`）+ 文件名 `encodeURIComponent`，兼容 GitHub Pages 子路径与离线；**仅当前曲设 `src` 逐曲加载**，不预取 ~30MB。
- **自动播放策略**：浏览器禁止无手势出声 → `window` 首次 `pointerdown` / `keydown` 一次性监听触发，`play()` 的 Promise 以 `.catch` 兜底降级为暂停态。
- **播放策略**：Fisher-Yates 洗牌后顺序播放、`ended → next` 自动衔接形成**随机无缝循环**；默认音量 0.4；音量 / 开关偏好持久化于 LocalStorage 键 `stellaris.audio`（仿 `storage.ts` 容错范式）。

**任务清单：**
- [x] `store/audio.ts`：曲目清单（base 感知 + `encodeURIComponent` 转义）+ `AudioSettings` 类型 + `load/saveAudioSettings` 持久化（`try/catch` 容错、字段补默认）。
- [x] `gameplay/AudioManager.ts`：封装 `HTMLAudioElement`，洗牌随机循环、`ended→next` 无缝衔接、首交互一次性自动播放 + `play().catch` 兜底、`reactive` 状态供 UI 绑定、音量 / 开关持久化、`dispose` 释放。
- [x] `ui/MusicWidget.vue`：右下角玻璃拟态迷你播放器（曲名 / 播放暂停 / 上下一首 / 音量滑块），自包含生命周期，复用既有样式基线。
- [x] `App.vue`：`import` + 模板 `<MusicWidget />` 接线（无 props / emit，不进 `ui` reactive 状态）。

**交付物：** 右下角悬浮迷你播放器，首次交互自动随机循环、可切歌 / 调音量、偏好持久化的沉浸 BGM 系统。

**验收结果：**
- `vue-tsc --noEmit` 零错误；`vite build` 成功（75 模块，BGM 不入 Worker，worker 体积不变 15.1kB）。
- 6 首 mp3 经 `public/` 复制进 `dist/audio/`；打包代码曲目路径为 base 感知前缀 + `encodeURIComponent`（空格 → `%20`），子路径 / 离线可用。
- 运行时行为（首交互自动起播、播放 / 暂停 / 切歌 / 音量、LocalStorage 持久化）待本地 `npm run dev` 核验——无头环境无法验证音频出声。

**复用与改动点：** `store/audio.ts`（新增，仿 `storage.ts` 持久化范式）、`gameplay/AudioManager.ts`（新增逻辑类）、`ui/MusicWidget.vue`（新增组件，复用玻璃拟态样式基线）、`App.vue`（import + 一行接线）。

**说明 / 顺延：** 场景化动态切曲（黑洞 / 超新星触发特定曲目）、淡入淡出过渡、移动端单独默认音量、与音效（SFX）体系合并留作后续打磨。

---

## 7. 横切关注点（V2.0 专属硬约束）

每阶段自查，任一违背需回退讨论：
- [x] **存档兼容**：扩展 `SerializedBody` / `WorldState` 均升版本号；`storage.ts` / `share.ts` normalize 向下兼容 V1.0（已核验旧结构解码）。
- [x] **性能不回退**：演化 / 航天器 / 高精度重计算均在 Worker；RK4 仅实验档启用，默认双档热路径零改动。
- [x] **精度隔离**：高精度仅限实验精度档（RK4 不依赖 `accOld`），默认娱乐 / 标准双档手感不变。
- [x] **零后端红线**：分享串自包含 + `CompressionStream` 原生 + 画廊静态打包，全程纯前端 / 静态资源。
- [x] **感知时间一致**：演化与航天器时标统一映射感知时间系统（`core/time.ts`）。

---

## 8. 里程碑概览

| 阶段 | 状态 | 核心交付物 | 关键验收 | 依赖 |
|------|------|-----------|----------|------|
| 阶段五 演化 | ✅ 已完成 | 生命周期演化沙盒 | 解耦不掉帧、跃迁平滑、存档兼容 | V1.0 物理 / 渲染 / 存档 |
| 阶段六 航天器 | ✅ 已完成 | 受控探测器系统 | 测试粒子不拖性能、弹弓可度量 | V1.0 预测线 / 能量计；阶段五（演化目标可选） |
| 阶段七 高精度 | ✅ 已完成 | 实验精度第三档 | 漂移优于标准档、周期解稳定 | V1.0 积分器 / 验证思路 |
| 阶段八 分享 | ✅ 已完成 | 纯前端分享体系 | 往返无损、离线可用、零后端 | V1.0 存档 / 截图 |
| 阶段九 BGM | ✅ 已完成 | 沉浸氛围音乐系统 | 构建 / 类型零错误、资源打包、解耦零依赖 | V1.0 UI 层；`public/audio` 资源 |

> 排期为相对顺序（按 CLAUDE.md 原顺序：演化 → 航天器 → 高精度 → 分享 → BGM 增量打磨），未硬编死日期；各阶段可独立交付增量价值。
>
> **V2.0 四大方向（阶段五~八）已完成（2026-06-20）。** 天体演化、航天器与探测器、高精度实验模块、在线分享均已落地并通过验收。
>
> **阶段九 氛围 BGM 作为发布前内容打磨增量于 2026-06-21 落地**——沉浸背景音乐，纯前端、零新增依赖，与既有系统完全解耦。

---

## 9. 风险与决策结论（已落地）

> 原四项预研风险均已在对应阶段验证并定型，记录最终方案与依据备查。

- **演化时标平衡**（阶段五）：采用**独立演化倍率档**（`EVOLUTION_SCALES = [0,1,10,50,200]`），与物理 `timeScale` 解耦——演化年龄按 `物理推进年 × 演化倍率` 步进，使亿年级生命周期在可感知窗内可见，且不扰动感知时间手感。结论：不做亿年级真实积分，倍率映射满足体验优先。
- **测试粒子取舍**（阶段六）：航天器定为 **`mass=0` 测试粒子**——在现有积分器中天然只受力不施力（`fj = f·masses[i] = 0`），**未引入分层 / 多速率积分**，积分热路径零改动、零额外 N 体成本。结论：精度与性能双赢,无需分层。
- **第三档成本**（阶段七）：实验档用**定步长 RK4**,**不依赖历史加速度**（与 Verlet 的 `accOld` 无耦合）,天然隔离默认双档；**未懒加载**——worker 仅 15.1KB,体积可忽略;诊断 O(N²) 仅实验档低频（≈0.25s/次）计算。结论：包体与性能影响可忽略,无需懒加载。
- **URL 容量上限**（阶段八）：分享串经 **deflate-raw 压缩**(50 天体实测压至 JSON 体积 21%、约 2.9KB),设 `URL_SHARE_LIMIT = 8000` 字符阈值,超限弹窗提示**降级导出文件分享**；第三方图床保留为「用户自带凭证」,明确**不属本项目后端**。结论：常规宇宙 URL 分享充足,大型场景有文件降级兜底,零后端红线未破。

---

## 10. 与 V1.0 的关系

- V1.0（阶段零~四）已全部完成，见 [`plan.md`](./plan.md)，本文档不重复其内容。
- V2.0 全程以增量扩展方式叠加于 V1.0 现有五层架构，不重写既有正常逻辑（CLAUDE.md：向下兼容）。
