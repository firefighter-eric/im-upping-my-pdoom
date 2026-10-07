# I'm Upping My P(doom) · 代码视频工作区

以 **作品 → 制作版本 → 变体与交付记录** 为核心，制作歌词驱动的代码音乐视频与原片解梗伴看。每部作品独立登记来源、音轨和权利，每个版本保存方案、代码、参数、结果与执行证据；公共工具负责预览、渲染和核验。

## 快速开始

源码检查需要 **Node.js 22+**；本地渲染与媒体验收另需 **ffmpeg／ffprobe、浏览器和已登记的原始音视频**。

```sh
git clone https://github.com/firefighter-eric/im-upping-my-pdoom.git
cd im-upping-my-pdoom
npm ci
npm run check
npm test
npm run verify:source
npm run catalog
```

GitHub 和 ZIP 下载包含代码、字体／图片资产、分析数据与制作记录，**不包含视频、音频或其 LFS 指针**。媒体路径、规格和 SHA-256 继续保留；本地已有素材须按 `project.yaml` 与 manifest 映射恢复到对应路径，仓库不提供媒体下载。

参与制作前阅读 [AGENTS.md](AGENTS.md)；版本字段与执行协议见 [docs/VERSIONING.md](docs/VERSIONING.md)。

## 当前作品与交付

以下概览按 2026-10-07 的作品登记、manifest 和交付记录整理。实时完整列表使用 `npm run catalog`；历史阶段的方案或验收文档保留当时表述。

| 作品 | 独立身份与目录 | 最新完整交付 | 状态 |
| --- | --- | --- | --- |
| AGI / I'm Upping My P(doom) | `LLMV_001` · [projects/agi](projects/agi/project.yaml) | [v006.13 · 原片解梗伴看正式稿](projects/agi/versions/v006.13/QA.md)，3840×2160、60fps、9400 帧，约 2:37 | `approved` · 用户于 2026-10-04 确认 |
| Escape Velocity / anabology | `LLMV_002` · [projects/anabology](projects/anabology/REFERENCE.md) | [v001.1 · 当前解释居中完整版](projects/anabology/versions/v001.1/DELIVERY.md)，3840×2160、60fps、18,389 帧，约 5:06 | `review` · 技术与播放检查已记录，待整片人工批准 |
| GitHub Math / 数学论文目录滚动 | `MATH_001` · [projects/math](projects/math/README.md) | [v004.7 · 24秒横向滑动片头与长页全景](projects/math/versions/v004.7/DELIVERY.md)，1920×1080、60fps、3480帧、58秒；722篇论文与372组相关成果 | `review` · 仅最新版视频保留本地，六个旧视频已有清理回执；源码、素材映射与制作记录保留 |

两部伴看视频将原片与中文解释、双语字幕合成到新画布；文字与图形层原生 4K，原片保持其来源清晰度。完整原 AAC 音轨保留。AGI 的[正式稿批准](projects/agi/versions/v006.13/provenance/USER_FINAL_APPROVAL.json)绑定成片哈希，不改变音乐、歌词、原片及改编权利的 `TBD` 状态。

### AGI 的其他制作方向

| 版本 | 内容与规格 | 状态／入口 |
| --- | --- | --- |
| v001 | 科幻抽象、AGI 觉醒叙事、歌词视觉三种变体；1080p24 | `review` · [方案](projects/agi/versions/v001/TREATMENT.md) |
| v002 | 参考引擎的 TypeScript＋Three.js／WebGL 技术迁移；4K60 | 历史 `review`；MP4 已按用户选择移除，代码与重建资料保留 · [重建说明](projects/agi/versions/v002/RESTORE.md) |
| v003.0 → v003.1 | 失控的计算温室及排版修订；1080p30 Preview | 首版 `superseded`、修订版 `review` · [版本说明](projects/agi/versions/v003.1/VERSION.md) |
| v004.0 | 谁在控制谁 · 逐句控制剧场；1080p30 Preview | `review` · [方案](projects/agi/versions/v004.0/TREATMENT.md) |
| v005.0 | 概率游乐场 · 原创三维歌词画面；1080p30 Preview | `review` · [时间脚本](projects/agi/versions/v005.0/SCRIPT.md) |
| v006.0–v006.13 | 原片解梗伴看的设计、制作与布局迭代；最终 4K60 | 各版本保留独立状态，v006.13 为正式稿 · [交付验收](projects/agi/versions/v006.13/QA.md) |

V006 的设计样图、v006.8 失败记录、v006.9／v006.10 完整候选及后续布局修订均保留。anabology 的 [v001.0](projects/anabology/versions/v001.0/QA.md) 保留缺帧预览与失败证据，当前完整交付以 v001.1 的 DELIVERY.md 为准。

歌词文本准确性、逐词时间和有声同步分开审核。AGI 的低置信词、anabology 的部分 Drop 唱词与其他不确定项保持各自记录；技术验收或整体批准不补写未完成的逐词听辨证据。

## 目录与资料职责

```text
projects/<slug>/
  project.yaml                   # 作品身份、来源、原始输入与权利
  sources/                       # 不可覆盖的原片、音轨、元数据与来源证据
  versions/<version>/
    manifest.json                # 输入映射、参数、哈希、变体与状态
    TREATMENT.md                 # 创意、提示词、视觉处理与制作范围
    renderer.html 或 renderer/   # 版本内画面实现、字体与图片资产
    data/                        # 歌词时间、音频特征、布局等版本数据
    outputs/                     # 完整成片，仅在本地保留
    runs/                        # 实际执行与失败记录
    provenance/                  # 来源、验收、批准及历史证据
scripts/                         # 通用命令与核验工具
templates/                       # 新作品的渲染接口骨架
docs/                            # 版本协议、参考目录、制作计划与决定
archive/story-studio/            # AGI 的历史集成上下文
.agents/skills/lyric-code-video/  # 本仓库的歌词代码视频制作方法
```

Vite 只编译版本内渲染器，产物位于忽略的 `.cache/`；各版本预览使用临时只读服务。历史 `provenance/original/` 与 `archive/` 不作为可执行工具。迁移前原位置仍保留，55 个原文件的映射与哈希见[迁移清单](docs/migration-manifest-v001.json)。

## 按版本工作

### 1. 查看现有成片与画面

```sh
npm run preview -- --project agi --version v006.13 --variant companion --time 8.5
npm run preview -- --project anabology --version v001.1 --variant companion --time 70.7
```

每条命令启动一个临时服务，输出渲染器与已登记 MP4 的 URL。默认由系统分配空闲端口，Ctrl+C 结束当前服务；需要固定端口时传 `--port 4173`，占用即报错，不使用 Story Studio 的 5173。

渲染器页面用于画面审看；完整声音与视频打开 MP4 URL，或在同一服务地址打开 `/versions/<version>/watch.html`（该版本提供时）。AGI 的[审看片页](projects/agi/versions/v006.13/watch.html)与 anabology 的[播放页](projects/anabology/versions/v001.1/watch.html)支持成片播放与定位。

### 2. 创建独立 draft

先查看 catalog，再选父版和新版本号。同一创意方向递增小版本，新方向递增主版本；新编号必须大于该作品所有现有版本。

以下示例从 AGI 的 v005.0 开始一个新的创意方向；执行前确认 v007.0 仍未使用：

```sh
npm run version:new -- --project agi --from v005.0 --version v007.0
```

新 draft 继承输入映射、数据、渲染代码及声明的分析工具，成片、运行记录和人工批准不复制。填写新的 `TREATMENT.md`、manifest 和画面实现，核对输入／代码／数据哈希与规格后再制作。版本专用导出器或其他文件须按该版本方案核对，不能只凭复制完成就提交渲染。

新建独立作品使用：

```sh
npm run project:new -- --slug new-film --id VIDEO_003 --title "新作品"
```

该命令创建作品登记、sources 目录与初始 draft 的 TypeScript＋Three.js／WebGL 骨架，默认 4K60；创意、提示词、模型、音频映射和时长为 `TBD`。先登记本作品输入并替换接口骨架，不混用 AGI 的专用场景或时间线。

### 3. 核验、渲染与登记

通用浏览器渲染路径要求版本提供 `window.ready` 与 `window.renderFrame(seconds, variant)`，返回 JPEG base64；可另用 RGBA/WebSocket 传输。其他制作路径使用版本内记录的工具，继续遵守同一输入、执行和验收协议。

以下命令适用于已完成方案、参数与哈希登记的 v007.0 draft：

```sh
# 首次使用且没有可用浏览器时；本机 Chrome 可用 --browser chrome
npx playwright install chromium
npm run build:renderer -- --project agi --version v007.0
npm run render:smoke -- --project agi --version v007.0
npm run render:stills -- --project agi --version v007.0
npm run render -- --project agi --version v007.0
npm run register -- --project agi --version v007.0
npm run verify:media -- --project agi --version v007.0
npm run verify:playback -- --project agi --version v007.0
```

`render` 默认制作该版本全部变体，也可传 `--variant <variant-id>`；不会覆盖已有输出。一次完整执行失败后保留记录并停止，不自动重试、改参数或重复提交。`register` 核验每个变体的成功记录、哈希、规格、完整帧数、原音轨与全片解码后登记为 `review`。

Smoke 输出在 `.cache/`，不作为完整交付。正式成片默认原生 3840×2160、60fps；离线 Preview 默认 1920×1080、30fps、固定 4 次时间采样；实际参数以当前 manifest 为准。完整音轨目标帧数为 `ceil(duration_seconds × fps)`，结尾差异小于一帧。

### 4. 按需准备音频分析

版本内 `audio_pipeline` 决定分离、歌词对齐、节拍与特征分析的方法。现有参考流程在 macOS Apple Silicon／Python 3.12 上验证：

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements-audio.lock.txt
npm run audio:prepare -- --project agi --version v007.0 --device mps
```

音频准备仅用于无已交付输出的 draft。它核对输入与歌词哈希，记录模型、依赖、参数和产物；成功才把新 JSON 绑定版本，失败停止。模型、分轨、中间数据和 QA 图保存在忽略的 `.cache/`，分轨仅用于分析，成片继续使用完整原音轨。

简单包络分析可使用 `scripts/analyze.py`，依赖见 `requirements.txt`；转录可使用 `scripts/transcribe.py`。两者接受显式输入／输出且拒绝覆盖已有文件，新数据进入新版本。详细制作与人声／节奏核验方法见[歌词视频 Skill](.agents/skills/lyric-code-video/SKILL.md)。

## 检查与审核边界

| 命令 | 检查范围 |
| --- | --- |
| `npm run check` | 公共脚本及版本 HTML／TypeScript 渲染器 |
| `npm test` | 通用工具的回归测试 |
| `npm run verify:source` | CI／新克隆的源码、版本资料与非媒体来源校验 |
| `npm run verify` | 本地原始输入、版本来源链、数据与已登记输出哈希 |
| `npm run verify:media -- --project <slug> --version <version>` | 实际媒体规格、完整帧数、音轨时长与原 AAC 包一致性 |
| `npm run verify:playback -- --project <slug> --version <version>` | 浏览器中的静音播放、进度、跳转与媒体错误 |

修改后须通过 `check`、`test`、`verify`。完整 `verify` 和媒体验收要求已登记的本地素材；CI 的 `verify:source` 不替代它们。交付还须检查全片解码、实际有声播放和所需人工审看，并把结果绑定到输出身份。

版本从 `draft → review → approved`，历史可标记 `superseded`。批准仅来自明确的人类确认，记录批准人、时间、范围及成片哈希；静帧确认、渲染授权和 PR 合并不自动批准完整视频。

V002 的 MP4 已按用户选择清理：原哈希、执行身份和历史 `review` 保留，`output.retention` 与回执登记为 `removed-by-user`。常规 `verify` 核验回执并明确报告；`verify:media` 仍要求实际文件。重建须在独立 draft 重新渲染，不能称为字节相同的旧文件恢复。

## 来源、权利与进一步阅读

两部作品的原视频、音轨、歌词和改编权利均保持 **TBD**。下载、技术验收、制作批准或源码发布不改变权利状态。字体、第三方代码与图片保留各自来源和许可；项目级代码许可证见 [LICENSE.md](LICENSE.md) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

| 文档 | 内容 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 人与 Agent 的协作、执行和发布规则 |
| [PROJECT.md](PROJECT.md) | 项目目标、交付规格与制作背景 |
| [docs/VERSIONING.md](docs/VERSIONING.md) | 版本字段、继承、渲染接口与媒体保留协议 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 已确认决定的时间记录 |
| [docs/REFERENCES.md](docs/REFERENCES.md) | 两个独立参考的身份、来源与规格 |
| [docs/AGI_LYRICS_AUDIT.md](docs/AGI_LYRICS_AUDIT.md) | AGI 歌词文字校对与同步审核边界 |
| [anabology / EXPLAINER.md](projects/anabology/EXPLAINER.md) | Escape Velocity 解梗稿、歌词和交付入口 |
| [docs/github-publication-v001.json](docs/github-publication-v001.json) | 首次源码上传范围、媒体排除及 CI 证据 |
