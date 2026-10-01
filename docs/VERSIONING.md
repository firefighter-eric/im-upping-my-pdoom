# 作品与版本协议

## 作品

`projects/<slug>/project.yaml` 使用独立稳定 `id` 与小写 slug。`sources/` 存放不可覆盖的输入，来源登记保留 URL、输入 ID、格式、尺寸、时长、SHA-256 和权利状态。AGI 的旧来源登记原样保存在 `sources/asset-original-v001.yaml`，其中旧路径属于迁移前上下文，不直接作为新工作区执行入口。

## 版本 manifest

每个 `versions/v###/manifest.json` 为独立版本的执行与交付来源。

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

`review.human_approval` 是转 approved 时的必要记录。当前没有任何版本被批准。

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
