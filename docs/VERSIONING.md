# 作品与版本协议

## 作品

`projects/<slug>/project.yaml` 使用独立稳定 `id` 与小写 slug。`sources/` 存放不可覆盖的输入，来源登记保留 URL、输入 ID、格式、尺寸、时长、SHA-256 和权利状态。AGI 的旧来源登记原样保存在 `sources/asset-original-v001.yaml`，其中旧路径属于迁移前上下文，不直接作为新工作区执行入口。

## 版本 manifest

每个 `versions/<version>/manifest.json` 为独立版本的执行与交付来源。

## 主版本与小版本

同一创意方向用同一主版本，首版为 `v003.0`，排版、镜头等修订为 `v003.1`、`v003.2`；更换创意方向使用下一个主版本，如 `v004.0`。小版本仍是独立目录、独立执行和独立交付，不覆盖旧成片。

历史 `v001`、`v002` 继续有效；数值比较时 `v003` 与 `v003.0` 等价，不允许二者同时作为目录存在。按主版本、小版本的整数值排序，所以 `v003.10` 在 `v003.2` 之后。

```sh
npm run version:new -- --project agi --from v003.0 --version v003.1
npm run version:new -- --project agi --from v003.1 --version v004.0
```

未指定 `--version` 时，最新版本含小版本就递增小版本；历史整数版本则递增主版本。新生成 ID 包含小版本，例如 `LLMV_001_V003_R001_001`，避免修订间混淆。

2026-10-02 用户要求将原 `v003` 改名为 `v003.0`、原 `v004` 改名为 `v003.1`。当前 manifest 使用新名称；成片仅改路径，内容和哈希不变。原生成 ID、TREATMENT、runs 和原来源记录原样保留，不把改名当成重新渲染。每版 `VERSION.md` 提供当前命名说明，`provenance/version-naming.json` 记录映射与历史文件哈希，原 manifest 快照也保留并接受 verify 校验。后续新版本不继承这份改名身份记录。

| 字段 | 意义 |
| --- | --- |
| project_id / version / parent_version | 精确作品与版本来源链 |
| status | draft、review、approved、superseded |
| request / model / method | 用户意图、Prompt／方案、实际模型或工具；未知写 TBD |
| renderer.path / renderer.entrypoint / renderer.sha256 | 版本目录内渲染器及当前代码哈希 |
| settings.width / height / fps / duration_seconds / target_frames | 交付规格；完整音轨帧数为 ceil(duration × fps) |
| inputs.audio / inputs.wav | 原始输入 ID、作品目录内路径及 SHA-256 |
| data / data_hashes | 版本目录内的音频特征、歌词时间路径及逐文件哈希 |
| variants | 变体 ID、稳定 generation_id、说明、已知问题及输出 |
| variants[].output | 版本目录内输出路径、哈希、大小、规格、实际帧数、执行 ID 与状态 |
| rights / validation / review | 权利、实际验收与人工批准记录 |

输入 `path` 相对作品根目录；renderer、data、output 相对当前版本目录。禁止越出作品或版本目录。海报为作品根目录内路径；AGI v001 的旧海报保留在 sources/analysis。

`review.human_approval` 是转 approved 时的必要记录。AGI v006.13 已由用户于 2026-10-04 确认为正式稿；[批准记录](../projects/agi/versions/v006.13/provenance/USER_FINAL_APPROVAL.json)固定批准人、时间、范围和成片哈希。该状态变更保留原交付内容及审批前清单，不继承到未来版本。

用户明确选择清理已登记的本地成片时，保留 output 的路径、原哈希、规格、执行 ID 和历史审核状态；用 `output.retention` 单列 `state: removed-by-user`、版本内清理记录路径及其 SHA-256。记录必须绑定作品、版本、变体、生成 ID、原输出身份、用户原话和实际删除时间。原始输入不适用此清理标记。

`verify` 校验完整回执后，可明确报告并跳过这一项有记录的媒体缺失；无回执的缺失和任何现存文件的哈希错误仍失败。`verify:source` 也验证清理记录，`verify:media` 仍要求实际文件，不能将已移除媒体计为通过。若重新生成，应建立独立 draft、沿用原代码／数据／参数并重新登记，不能伪称恢复了字节完全相同的旧输出。示例见 [V002 重建说明](../projects/agi/versions/v002/RESTORE.md)。

## 新版本

已有版本不覆盖；新版本严格大于所有现有版本。复制 renderer 和 data（模块化版本继承完整 renderer.source_directory），以及声明的 audio_pipeline.tool_directory 代码；保留输入映射。清空输出、执行验证、分析完成状态及人类批准，重新填写 Prompt／创意变更。同一版本的变体共用相同输入时可并存；输入、方案或渲染代码发生交付后变更时创建新版本。

原始 v001 的 55 个文件在迁移清单中逐文件冻结。历史原脚本含旧工作区与机器路径，保留作为证据。执行时使用根 scripts/；不得运行 provenance/original 中的旧 register、render 或 transcribe。

## 通用渲染接口

版本渲染器为 HTML，须提供一个符合 manifest 宽高的 canvas：

```js
window.ready = Promise.resolve();
window.renderFrame = (seconds, variant) => {
  // Draw the deterministic frame for this exact time and variant.
  return canvas.toDataURL('image/jpeg', 0.94).split(',')[1];
};
```

可选第三参数 `capture=false` 用于静帧预览，避免不必要 JPEG 编码。公共工具只接收时间与变体；构图、素材、字体、动画、音画响应和场景切换均由版本定义。新作品模板只显示 TBD，不能当成已完成创作。

本工具的完整 MV 路径复用原 AAC 音轨；换音频、混音或不同编码流程应另建版本并明确处理规则，不得静默改变。

## TypeScript / Three.js 版本

`renderer.build = vite`、`renderer.source_directory = renderer` 声明版本内编译目录。入口、TypeScript、场景、shader、字体和资源全部位于该目录，renderer.files 固定全部文件哈希。Vite 只为本次只读预览／渲染生成独立 .cache 构建目录，不复用或清理他人正在使用的产物。

新制作默认原生 3840×2160、60fps；实际规格仍由版本 manifest 决定，历史版本不修改。Three.js 引擎支持按输出倍率原生出帧，以及固定／自适应多次采样运动模糊；sampling 参数属于版本设置。

`settings.frame_transport = rgba-websocket` 可选择 raw RGBA 导出。版本须在 export 模式提供 `window.streamFrames({from,to,fps,variant,ws,samples,shutter,inflight})`，逐帧发送宽×高×4 字节、GPU bottom-up RGBA，并尊重服务器写入确认；公共工具恢复垂直方向并编码。仍需保留 window.ready / renderFrame JPEG 接口供静帧和通用验收使用。

完整渲染记录固定全部渲染依赖、方案哈希、数据哈希、实际工具版本和参数；register 检查执行证据、实际源音轨时长、媒体规格与完整解码后才转 review。

## 音频准备

版本 audio_pipeline 声明分析脚本目录与兼容模型。公共 audio:prepare 只做身份、哈希、运行与状态编排，具体分离、对齐、节拍和歌曲解释在版本内。Demucs 四分轨、主唱分离、双 CTC／多声道对齐、Whisper 交叉检查、音高／起音与节拍／包络分析使用同一输入时间轴。

每次创建 AUDIO_* 记录；模型、包版本、输入／歌词／工具代码与输出哈希可追踪。模型与中间数据不进 Git；生成 JSON 以独立文件绑定 draft。原音轨仍作为最终导出的声音，分轨只用于分析，不静默替换成片音轨。自动歌词置信度、段落解释及 QA 图均需人类审核。

## 执行记录

`runs/RUN_*.json` 记录作品、版本、变体、代码／输入／数据哈希、实际设置、时间和输出哈希。失败留记录并停止；输出可能保留为 `.partial.mp4`，不会注册成完整成片。完整成功输出先验证，再由 register 登记。

## 增加其他制作技术

工作区允许任意视频创作技术在版本中保存代码、Prompt、输入与结果。公共浏览器渲染脚本是一条已实现路径；外部 AI 视频任务、GPU／云服务接入仍为 TBD。接入时继续使用相同稳定身份、执行记录、不可覆盖和人工审核规则。
