# v004.3 · 58 秒、60 帧有声视频预览

作品 MATH_001；生成 ID MATH_001_V004_R003_001；变体 math-github-preview；状态 review，待人类审看。

片头延长到 10 秒，真实白底 GitHub 页面从第一帧就开始匀速滚动。前 10 秒叠加半透明年度节点：2022 ChatGPT、2023 GPT-4、2024 o1、2025 GPT-5、2026 Opus 4.6、GPT-6 Astra、NS 和数学预印本汇总，每项只补一句背景。第 10 秒片头层完全退场，页面持续滚动，最后展示实际目录末行并直接结束；总长仍为 58 秒。英文目录在左，右侧保留全部 722 项中文速览。

用户提到的“2026 年 2 月 MISS”名称存在歧义。制作前说明并询问了 Opus 4.6 与 Mythos 两条来源，未收到选择时，按用户指定的 2 月采用 Opus 4.6：Anthropic 公布发现并验证 500 多个高危漏洞，修复仍在推进。[官方说明](https://www.anthropic.com/research/zero-days)。4 月的 Mythos 是另一项发布，未加入本版片头。

[打开本地播放器](watch.html) · [本地 MP4](outputs/MATH_001_V004_R003_001_math-github-preview_v004.3.mp4)。播放器提供“全屏观看”按钮。原预览窗口实际将 1920 像素画面缩到约 549 像素宽，缩放会进一步影响小字扫读。

本版原生规格为 1920×1080、60fps、58 秒、3480 帧，H.264 与 44.1kHz 双声道 AAC。各帧按真实 60fps 时间重新生成，固定四次不同时间采样、快门 0.2。逻辑滚动步进由上一版约 22.09 像素／帧降为约 10.09 像素／帧；实际编码中连续 16 帧均不同，逐帧图像匹配测得 15 次向上位移均为 10 像素。音乐沿用已选 58 秒输入，AAC 音频包逐字节保持一致。

单次完整渲染记录为 [RUN_2026-10-07T10-04-24-272Z_b850ef15](runs/RUN_2026-10-07T10-04-24-272Z_b850ef15.json)。输出 SHA-256：`7f2e072d160b3974edcb89986290ab6c01266373c60b708ee5ef452f5d8950d2`。本版完整视频只渲染一次；制作前 QA 曾修正静帧返回值解析，错误与修正单独留证，没有重试完整渲染。

源码检查、12 项测试、版本与输入核验通过；注册时完成规格核验、全片解码和 AAC 包比较，专项媒体核验通过。另核验全部 3480 个帧时间戳，检查 15 张实际编码帧，并以正常速度、非静音状态连续播放完整 58 秒，验证 5、29、53.94 秒三处跳转后播放前进，以及全屏按钮。没有媒体错误或损坏帧。Chrome 在启动约 0.36 秒内记录 7 个掉帧，后续全片和三处跳转期间计数保持不变；这不代表用户设备的显示刷新率或内置浏览器掉帧情况已被测量。

全部 246 个既有 Math 素材及历史版本文件保持原哈希。证据见 [delivery](provenance/delivery.json)、[audiovisual-playback](provenance/audiovisual-playback.json)、[encoded-motion](provenance/encoded-motion.json)、[frame-timestamps](provenance/frame-timestamps.json)、[preview-http](provenance/preview-http.json) 和 [historical-preservation](provenance/historical-preservation.json)。

全部 722 篇在一分钟内展示仍属于快速扫读。中文专业内容、音乐节奏感、用户设备上的观看感受与整片审美待人类审看；技术通过不代表人类批准。NS 保留有外力 C/D 版本与 Lean 形式化范围，722 表示预印本数量、对应 372 组相关结果。全部旧版和原音轨保留；媒体仅留本地，素材权利状态为 TBD。
