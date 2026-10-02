# pdoom-video：可借鉴内容与边界

参考仓库：[mexicat/pdoom-video](https://github.com/mexicat/pdoom-video)。本次阅读固定提交为 `bdbad537a7b7af3213475651774030c47568c181`；下面链接固定到该提交，避免后续源码变化混入制作证据。开始实际复用时核验许可、依赖与源码差异，不把此快照当作永远最新的版本。

## 优先学习什么

| 来源 | 可复用机制 | 迁移注意 |
| --- | --- | --- |
| [TREATMENT](https://github.com/mexicat/pdoom-video/blob/bdbad537a7b7af3213475651774030c47568c181/docs/TREATMENT.md) | 逐句可读／逐词同步；文字进入场景；共享母题与多种图形“版画”；副歌升级 | 为新歌重新设计语义、字体、色彩与母题 |
| [ENGINE](https://github.com/mexicat/pdoom-video/blob/bdbad537a7b7af3213475651774030c47568c181/docs/ENGINE.md) | 场景 API、逻辑／物理尺度、线条与字形、采样、后期、GPU readback | 先确认目标仓库接口；1080p 好看不等于 4K 细线正确 |
| [时间线](https://github.com/mexicat/pdoom-video/blob/bdbad537a7b7af3213475651774030c47568c181/app/src/timeline.ts) | 歌词锚点和乐句／拍点组织镜头 | 当前歌词、时钟、场景长度重新生成，不沿用旧锚点 |
| [音频分析](https://github.com/mexicat/pdoom-video/tree/bdbad537a7b7af3213475651774030c47568c181/analysis) | 分离、CTC 对齐、ASR 交叉检查、音高／起音／节拍和 QA 图 | 手工修正和源 MP3 偏移只属于原输入；模型可选择兼容替代 |
| [离线导出](https://github.com/mexicat/pdoom-video/blob/bdbad537a7b7af3213475651774030c47568c181/app/scripts/render.ts) | 浏览器出帧、分段／静帧、WebSocket 原始帧、ffmpeg | 保留目标仓库的背压、失败停止、证据与注册机制 |

## 引擎模块阅读地图

源码根为 [`app/src/engine/`](https://github.com/mexicat/pdoom-video/tree/bdbad537a7b7af3213475651774030c47568c181/app/src/engine)。按需要选读：

- `scene.ts`、`engine.ts`：时间驱动场景与调度；先理解状态为何可以任意时间求值。
- `type.ts`：字形路径、布局和真实 kerning；拆成逐字效果后仍用完整布局的 glyph 位置，不能简单累加每个字的测量宽度。
- `stroke.ts`：单线字体、笔头路径和书写时间，适合歌词被画出或机器绘字。
- `lines.ts`、`gl.ts`：GPU 批量线段、HDR render target、2D 图层与合成；按实际容量和性能选规模。
- `glsl/common.ts`、`scale.ts`：SDF、噪声、刻线与抗锯齿，以及逻辑尺寸到物理像素换算。
- `post.ts`：bloom、颜色与纹理等统一后期；文字清晰度和高光范围一起审查。
- `lyrics.ts`、`audio.ts`：歌词与音频特征驱动画面；数据必须绑定当前歌曲。
- `util.ts`：缓动、脉冲、噪声、曲线工具；运动服务歌词事件。
- `hud.ts`、`palette.ts`：上游的概率数字与风格实现，适合研究设计；不作为所有歌曲的默认 HUD／色板。

[`app/src/main.ts`](https://github.com/mexicat/pdoom-video/blob/bdbad537a7b7af3213475651774030c47568c181/app/src/main.ts) 的传输与 engine 的异步 readback 可结合研究；自适应运动模糊递增采样、固定每帧抖动和线性 HDR 平均的细节见 ENGINE。

## 场景用于理解设计机制

从 [`app/src/scenes/`](https://github.com/mexicat/pdoom-video/tree/bdbad537a7b7af3213475651774030c47568c181/app/src/scenes) 选择与新作问题相关的例子：`loss.ts` 的图形／地形转换、`hook.ts` 的尺度与概率、`spacetime.ts` 的空间字体、`paperclips.ts` 的对象重复、`fuse.ts` 的引线与推进。这些场景的歌曲内容、参数和顺序属于原作品；不能只换歌词就声称完成了新歌的视觉设计。

上游 treatment 将橙色火花、图表、回形针和引线连接成反复变形的母题；Pdoom 数字分阶段在场景内出现；不同章节使用不同图形材料但共享排版和色彩。这种“多场景、统一语法”的组织方式比固定字幕模板更值得迁移。原片与源码存在修订差异，实际视觉结论以原片观察为准。

## 复用前的约束

代码许可与音乐、歌词、字体、图片各自核验并保留归属。上游 README 标明代码 MIT、字体有独立许可，歌曲／歌词不因此成为 MIT。记录固定提交、复用路径、许可证、来源哈希、实际修改和对应版本；不把未知使用权写成已授权。

保留本仓库的作品／版本组织、公共工具接口、完整音轨、运行证据、review 状态和用户上传范围。不复制整个固定前端应用、固定端口、机器绝对路径、源歌媒体或旧歌对齐修正。

4K 输出、采样数量、压缩参数和作者机器耗时都是实现或测量条件。根据新作镜头实际验证质量和成本，不承诺换用此引擎就自动获得相同审美或速度。
