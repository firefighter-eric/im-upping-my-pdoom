# 迁移前 AGI 制作决定摘录

原来源：AI Short Drama / production-log/decision-log.md。保留历史上下文；其中旧路径并非本工作区的可执行入口。

## 2026-10-01 — 开始 LLM 视频方向，建立独立参考区与 LLMV_001

- 用户明确开始制作由 LLM 制作的视频，并要求下载 Bilibili `BV18ta86EEHb`、提取音频，以及建立能观看同类参考作品的专门区域。Story Studio 新增“LLM 视频”导航、项目列表、原片播放器、独立音频试听与下载、来源页和来源项目链接；当前新作品的内容、LLM 型号、Prompt、渲染引擎与制作规格为 `TBD`。
- 首个参考为 `LLMV_001`《吓哭了Opus5.5 AGI概念MV》，上传者“白雪仅当雪白”。公开页面简介称来源项目为 `https://github.com/mexicat/pdoom-video`；本次只按来源表述登记，没有把视频标题当作已验证的模型记录。
- 不使用 Cookie，通过公开 view/playurl 接口取得匿名 qn64 的 720p 原片。CDN 首次响应仅有部分文件，最终按 Content-Range 逐段取得完整 38,410,013 字节；完整音画解码通过。原片为 1280×720、30fps、156.687625 秒、H.264/AAC；SHA-256 `47aaddf0b93bcc6aeaac26dc872a31b75086d1e1dfb6296ff7fbbcbb8dacf890`。完整临时件、`00_inbox/video/LLMV_001_BV18ta86EEHb_source_v001.mp4` 与 `references/LLMV_001_source_v001.mp4` 字节一致，未覆盖或删除既有来源。
- 完整原音轨提取为 `LLMV_001_AUDIO_001` M4A（AAC 无重编码）及 `LLMV_001_AUDIO_002` WAV（16-bit PCM 编辑版），均为 48kHz、双声道、156.650667 秒。没有裁剪、变速或分离人声／伴奏；M4A 解码后与原片音轨 SHA-256 一致，两份音频完整解码通过。规格、文件哈希、工具与命令登记在 `02_library/llm-video-references/LLMV_001_pdoom/asset.yaml`。
- Story Studio 执行 `content:sync` 与生产构建。Playwright 验证精确 `#/llm-video/LLMV_001`：原片 currentTime 前进至 1.049005 秒，M4A 至 0.562038 秒，WAV 至 0.561370 秒；三个播放器 readyState=4、媒体错误为空。项目总览→LLM 视频入口→LLMV_001→刷新后保持项目成功。1600×1000 与 1440×900 桌面视口无横向溢出，无框架错误覆盖层或控制台警告／错误；16 项回归测试通过。
- 参考状态保持 `review`，权利状态为 `TBD`；素材、音乐、图形、源视频及转载、改编、商业使用范围待确认。没有创建新的短剧剧本、分镜或视频生成任务。
- 决策人：Eric / Codex


## 2026-10-01 — LLM 视频按并列项目类型展示

- 用户明确“项目类型和短剧栏目、视频项目并列”。侧栏改为“短剧项目 / 视频项目 / LLM 视频项目”三个同级栏目；LLM 栏目使用同样的标题、数量、展开／收起控件和文件夹项目行，排列在视频项目之后。项目详情继续提供原片与音频。
- 类型检查通过；当前 Story Studio 页面已确认三个栏目处于同一父级、使用相同标题样式。LLM 栏目收起／展开、进入 LLMV_001 及原片实际播放通过，媒体无错误，控制台无警告／错误。
- 决策人：Eric / Codex



## 2026-10-01 — LLMV_001 项目命名为 AGI

- 用户确认当前 LLM 视频项目名为“AGI”。更新资产登记与索引；侧栏、参考卡片与详情标题使用 AGI。原视频标题“吓哭了Opus5.5 AGI概念MV”保存在 source_title，并在来源与制作信息中显示。稳定 ID、原片与音频路径保持不变。
- 决策人：Eric / Codex


## 2026-10-01 — AGI 完整音轨三版 MV v001 交付为 review

- 用户请求按 AGI 提取音频制作 MV，并在视觉方向选择中明确要求“3个版本都做”。使用同一份完整 `LLMV_001_AUDIO_001` 音轨制作 `LLMV_001_MV_001` 科幻抽象版、`LLMV_001_MV_002` AGI 觉醒叙事版、`LLMV_001_MV_003` 歌词视觉版。
- 制作方法：Codex（GPT-6）编写原创确定性 Canvas 2D 场景，Chrome 离线输出，ffmpeg 编码 H.264；无 ComfyUI 提交、无文生视频推理。音轨 AAC stream-copy，三版音频数据 SHA-256 均与提取的 M4A 一致，未裁剪、变速或重新生成声音。
- 三版均为 1920×1080、CFR 24fps、3760 帧、视频 156.666667 秒；完整音轨 156.650667 秒，与画面差值小于一帧。完整音画解码通过。
- 本地 MLX Whisper 转录保留原始 JSON；歌词视觉版使用来源项目逐词数据辅助对齐。对照本地音轨与来源音量包络，相关性 0.931、最优偏移 0.02 秒。歌词保持原英文，个别发音／高亮仍需人工审看；声音与歌词权利继承原资产 TBD。
- 三版均登记在 `02_library/llm-video-references/LLMV_001_pdoom/asset.yaml`，稳定 ID 同步索引。完整 Prompt、源代码、输入／输出 SHA-256、探测报告和制作记录位于 `production/mv-v001/`，三个 MP4 在 `generations/`，全部保持 review，没有新增世界观或人物创意事实。
- Story Studio 新增三版切换、候选状态、已知问题与下载。`content:sync`、类型检查与 16 项回归通过。精确 `#/llm-video/LLMV_001` 页面实播：三版起播进度分别 1.073968、1.067904、1.064212 秒，readyState=4，媒体错误为空；47／100／145 秒跳转均继续前进且无媒体错误。1600×1000 桌面无横向溢出。数据记录 `story-studio-playback-v001.json`；截图 `output/playwright/agi-mv-three-versions-v001.png`。
