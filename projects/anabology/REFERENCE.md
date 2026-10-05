# LLMV_002 · anabology 的 X 视频参考

用户于 2026-10-03 提供 [X 帖子 2103534482930491441](https://x.com/anabology/status/2103534482930491441)，要求下载为第二条独立参考。稳定 ID 为 `LLMV_002`，原片 ID 为 `LLMV_002_SOURCE`；原有 `LLMV_001 / AGI` 的来源、素材、音轨和制作版本各自归属。

本目录在 2026-10-03 首次导入时只登记参考素材。2026-10-05 已创建独立 `v001.0` 解梗伴看草稿，绑定本目录自己的原片、音轨与歌词；AGI 的内容、输入及批准状态不混用。公共导出机制与开放字体可以复用。

同日根据当前解释落在右栏第三个位置的反馈，新建 v001.1 版式修订，固定中间为当前解释、上方一条前文、下方下一条标题。七张样图和实时预览交付后，用户明确确认“好了，渲染成4K”；已单次导出 [v001.1 完整 4K60 成片](versions/v001.1/DELIVERY.md)，帧数、完整原音轨、解码、解释位置与实际播放通过，状态 review。旧预览、代码及失败证据全部原样保留。

2026-10-03 按用户歌词请求，另行无损提取完整 [M4A 原音轨](sources/audio/LLMV_002_audio_original_v001.m4a)，原 AAC 数据包与 MP4 内音轨完全一致。已取得作者公开的 `prompts-suno.md`，提取出 [歌词与念白](LYRICS.md) 和 [纯歌词 TXT](sources/text/LLMV_002_lyrics_en_v001.txt)。文本为作者注明的 Suno draft 3 原稿，实际演唱差异见 [带段落时间的核对稿](sources/analysis/transcription-v003/lyrics-timed-source-assisted-v001.md)。

本地 ASR 首轮产生大量重复词，原结果与拒绝记录保留；独立分段识别和密集合唱补查另建分析修订。原稿 Drop 前四行未由两次识别确认，若干代词与副歌用词仍待听辨；时间为自动定位，尚未逐词强制对齐或人工批准。`sources/analysis/transcription-v001` 至 `transcription-v003` 是分析记录，未创建视频制作版本。来源、模型修订、参数、代码和产物哈希均独立登记于本作品。

2026-10-05 按用户要求新增 [《Escape Velocity》中文解梗入口](EXPLAINER.md) 和 [40 条完整审稿](../../docs/plans/anabology-annotation-review-v001/REVIEW.md)，参照 AGI 的中英歌词／出处／用梗方式格式，覆盖作者原稿 65 个非空行。该初稿为 review，未确认的出处及 Drop 音轨状态继续保留边界。用户随后明确不要为凑 40 条而分组，改用 [自然拆分稿 v002](../../docs/plans/anabology-annotation-review-v002/REVIEW.md)，并创建 `v001.0` 视频草稿；其缺帧预览保留为历史，后续已授权并完成 v001.1 的居中布局 4K60 导出。详见 [当前解梗入口](EXPLAINER.md)。

| 项目 | 内容 |
| --- | --- |
| 显示名称 | anabology · X 视频参考（描述性名称，帖子未提供独立视频标题） |
| 发布者 | anabology / @anabology |
| 来源发布时间 | 2026-09-26 01:17:57，Asia/Shanghai |
| 来源登记 | [project.yaml](project.yaml)、[asset-v001.yaml](sources/asset-v001.yaml) |
| 原片 | [LLMV_002_source_v001.mp4](sources/references/LLMV_002_source_v001.mp4)，仅在本地保留 |
| 规格 | 1920×1080，H.264，24fps，7354 帧 |
| 时长 | 视频 306.416667 秒；容器及音轨 306.480181 秒 |
| 内嵌原音轨 | AAC，44.1kHz，双声道；未裁剪、变速或重新编码 |
| 文件大小 | 353345097 字节，约 337 MiB |
| 原片 SHA-256 | `5a22be4feed3c46051b4a7561ff9a3a8be7fab1ba87966a8c2495c957bae900d` |
| 状态 | review；技术验收通过，未作人工创意批准 |
| 权利 | TBD |

通过 X 的公开 syndication 元数据选择最高码率 MP4，从公开 `video.twimg.com` 地址匿名下载；HTTP 200 的 Content-Length 与实际字节数一致。原片未经转码，完整视频和音频解码通过。内嵌音轨比画面长约 0.064 秒，按来源原样保存。

实际播放的时间从 8.39 秒推进到 43.42 秒；约 92、198、288 秒跳转后均继续播放，`readyState=4`，`error=null`。记录见 [导入验收](sources/provenance/import-v001.json)、[播放验收](sources/provenance/playback-v001.json) 与 [媒体探测](sources/analysis/llmv_002_source_ffprobe_v001.json)。

帖子提及 Opus 5.5、Donald 的提示词、Midjourney 与 moodboard。这些仅为发布者描述，实际模型、提示词、制作过程及资产许可证保持 TBD。原始公开描述保存在 [来源元数据](sources/analysis/source-metadata_v001.json)。

视频继续由根 `.gitignore` 排除。来源、哈希、探测、海报和验收记录独立追踪；技术通过不等同于人工批准。

![新参考视频海报](sources/analysis/LLMV_002_poster_v001.jpg)
