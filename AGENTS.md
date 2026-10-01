# 协作约定

## 项目目标与资料优先级

这是以作品和制作版本为核心的代码视频创作仓库，可承载多部类似视频。公共工具位于 `scripts/`，具体画面和制作技术属于各版本。不要把本仓库改造成固定的前端应用。

1. `PROJECT.md`：工作区定位、交付规格与版本规则。
2. `projects/<slug>/project.yaml`：稳定作品 ID、原始输入、来源与权利状态。
3. `projects/<slug>/versions/<version>/manifest.json` 和 `TREATMENT.md`：该版本的创意、提示词、输入映射、参数、状态与输出。
4. 版本内 `runs/` 与 `provenance/`：实际执行记录、哈希和历史证据。
5. `docs/DECISIONS.md`：已确认的重要协作决策。

## 版本与素材

- 原始参考视频、音频、元数据放在作品的 `sources/`。禁止覆盖、修改或删除原始输入；新输入使用稳定 ID 和递增版本号。
- 使用 `v001`、`v002` 等递增目录，不使用 `final-final`。同一制作版本可有多个明确命名的变体。
- 已交付的 `review`、`approved`、`superseded` 版本保持可追溯。变更创意、提示词、输入、代码或参数时创建新版本；不要覆盖旧成片或修改已绑定执行记录的内容。
- `npm run version:new -- --project <slug> --from v001 --version v002` 只继承输入映射、数据和渲染代码，新版本从 `draft` 开始，不继承成片或批准状态。
- 未确认的创意事实、模型、权利或计划使用 `TBD`。生成结果进入 `review`；只有明确的人类批准才能进入 `approved`，并记录批准人／时间／范围。
- 新作品使用稳定 `project.yaml` ID 和独立 `projects/<slug>/`；生成 ID 必须绑定作品、版本与变体。不得混用其他作品的输入或输出。
- 原始迁移资料在 `docs/migration-manifest-v001.json` 中逐文件固定哈希。`provenance/original/` 与 `archive/` 是历史资料，不作为可执行工具使用。

## 执行与交付

- 生成前读取当前版本的 manifest、提示词、输入映射与权利状态，核对输入哈希。记录实际模型／工具、提示词、参数、输入／代码／输出哈希、日期与任务状态。
- `render` 单次执行，不清理、抢占或重排他人的任务；失败记录后停止，不自动重试、改参数或重复提交。
- 单个版本的代码渲染接口为 `window.ready` 和 `window.renderFrame(seconds, variant)`，返回 JPEG base64。可以使用 Canvas、WebGL 或其他技术；公共脚本不得写死 AGI 场景、人物或私人机器路径。
- 帧率、尺寸、时长和变体由版本 manifest 决定。根据 2026-10-02 用户要求，新制作默认技术起点为原生 3840×2160、60fps、TypeScript＋Three.js／WebGL；历史版本保持原规格。完整音频的目标帧数为 `ceil(duration_seconds × fps)`，结尾差异小于一帧。
- 默认保留用户选择的完整原音轨，不变速、不裁剪、不重写。若另有明确要求，创建新版本并记录音频处理方法。
- 渲染完先核对实际媒体规格、帧数、音频与完整解码，再 `register` 为 review。文件存在或构建通过不能证明音画播放正常；交付时必须实际播放，并检查进度与媒体错误。
- `npm run render:smoke` 是工具验收，输出在忽略的 `.cache/` 中，不作为完整视频、正式变体或人工审核结果。
- 各作品的渲染预览是临时只读服务，不建立固定前端项目。端口由系统分配，指定端口时严格占用检查；不得停止其他项目服务，尤其不要占用既有 Story Studio 的 5173。

## Git 与检查

- 根据 2026-10-02 用户上传要求，视频和音频只在本地保留并由 .gitignore 排除；上传代码、字体／图片资产、分析 JSON 与制作记录。不得删除原始素材或清除其哈希登记。将来只有用户明确要求发布媒体时才重新纳入 Git LFS，真实大文件不得直接塞入 Git 历史。不要提交依赖、缓存、模型权重、临时输出、凭据或环境文件。
- 本仓库的 GitHub origin 是作品工作区，发布仅包含本仓库授权范围。音乐／歌词权利 `TBD` 不得被改写成已取得授权或 MIT。
- 保留并行工作，不复制整个旧 Story Studio；`archive/story-studio/` 仅保存与 AGI 交付有关的历史上下文。
- 必须通过 `npm run check`、`npm test`、`npm run verify`。涉及媒体交付时加 `npm run verify:media -- --project <slug> --version <version>` 并实际播放。
- CI 使用 `verify:source` 校验无需本地音视频的代码与版本资料；CI 通过不等同于素材已恢复或完整媒体已验收。本地完整 `verify` 与媒体制作仍须已登记的原始文件。
