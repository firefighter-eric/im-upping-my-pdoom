# v004.4 · 完整日期与十二秒柔和片头

作品 MATH_001；生成 ID MATH_001_V004_R004_001；变体 math-github-preview；状态 review，待人类审看。

片头从 10 秒放慢到 12 秒，总长保持 58 秒。全部八个节点统一大年份与蓝色月日，NS 使用 2026.09.08，722 篇预印本使用“截至 2026.10.07”。[NS 官方公告](https://openai.com/index/navier-stokes-solution/)确认发布日期和有外力 C/D 版本、Lean 形式化范围；预印本日期是登记目录快照的截至日期，722 篇对应 372 组相关结果。

每次转换采用轻微上移与顺序淡出、淡入：旧文字在最后 0.18 秒上移 18 像素淡出，新文字在前 0.18 秒从下方淡入，使用 smoothstep 缓动。去掉旧版突然放大的效果，连续四个 2026 年节点共享固定年份。最后 0.6 秒片头层柔和消失，在第 12 秒完全退场。真实白底 GitHub 页面从第一帧持续匀速滚动，保留英文左、全部 722 项中文右，最后展示实际目录末行直接结束。

[打开播放器与全屏按钮](watch.html) · [本地 MP4](outputs/MATH_001_V004_R004_001_math-github-preview_v004.4.mp4)。规格为原生 1920×1080、60fps、58 秒、3480 帧，H.264 与 44.1kHz 双声道 AAC；固定四次时间采样、快门 0.2。沿用既有 58 秒音乐输入，AAC 音频包保持逐字节一致。

完整视频仅渲染一次：[RUN_2026-10-07T10-24-13-657Z_61b32061](runs/RUN_2026-10-07T10-24-13-657Z_61b32061.json)。输出 SHA-256：`7aaa4ec1b5992e3d303e5f7d90896280b157ec3a82eed6266931ff34e2ac4394`。登记后未改动画代码、时间数据或制作方案。

源码检查、12 项测试、版本与输入核验、专项媒体核验通过。注册包含规格、全片解码和 AAC 包比较；全部 3480 帧时间戳符合 60fps。实际解码连续 16 帧均不同，15 次向上位移均为 10 像素。片头检查 721 个帧时间状态，另查看 18 张实际编码帧，覆盖所有节点中点、NS 与 722 的转换、片头退场和末行。

正常速度、非静音技术播放完整 58 秒，9.4、11.1、29、53.94 秒四处跳转后播放前进，全屏按钮进入 VIDEO 全屏。无媒体错误或损坏帧；Chrome 在开始约 0.35 秒内记录 1 个掉帧，后续整片与四次跳转期间未增长。此检查不代表用户设备显示刷新或音乐节奏感已被人工审看。

全部 313 个既有 Math 原素材及历史版本文件保持原哈希；第 12 秒后的代表性原生画面与 v004.3 字节一致，全部中文数据保持原哈希。证据见 [delivery](provenance/delivery.json)、[audiovisual-playback](provenance/audiovisual-playback.json)、[encoded-visual-review](provenance/encoded-visual-review.json)、[opening-transitions-preflight](provenance/opening-transitions-preflight.json)、[preview-http](provenance/preview-http.json) 和 [historical-preservation](provenance/historical-preservation.json)。

一分钟内展示全部 722 篇仍是快速扫读。中文专业内容、音乐节奏感、用户设备观看感受与整片审美待人类审看。原音轨和全部旧版保留；媒体仅留本地，素材权利状态为 TBD。
