# V006.8 完整导出失败记录

2026-10-04 的首次完整导出因 Node.js 堆内存耗尽中断，版本保持 `draft`。没有完整视频，也未执行 `register` 或完整成片验收；未自动重试。

原片抽查未发现平台、账号或剪辑软件水印，可以直接嵌入。原片的文字、坐标线和片尾 Regenerate 按钮属于画面内容，全部保留。原视频与原音轨哈希复核未变，水印观察范围见 [检查记录](provenance/watermark-inspection.json)。

## 本次结果

- 目标：3840×2160、60fps、9400 帧，完整原音轨 156.650667 秒。
- 执行：`RUN_2026-10-04T06-10-28-057Z_5707170a`，进程退出码 134。
- 最后进度日志为 5040/9400 帧（54%）；FFmpeg 随后封装出的局部文件实际有 5265 帧、87.75 秒画面（目标的约 56%）。
- 局部文件带完整音轨，因此容器显示约 156.65 秒，不能据此判断整片完成。局部文件只作为失败证据，不登记为成片。
- 40 条屏幕解释、43 次注释出现、46 句中英歌词已实现。排版预检中，完整上一条与当前条最多占 858 px，阅读区域为 926 px；字幕无溢出。技术 smoke 验证过 30 帧合成，不等于整片交付。
- `npm run check`、`npm test`（9 项）和 `npm run verify` 已通过；最终成片的完整解码、音轨包对比、播放和同步审看尚未完成。

## 原因与待采用修复

`production/render.mjs:59` 在每帧使用同一个始终等待失败的 `encoder.failed` Promise 做 `Promise.race`。旧 race 的回调仍挂在这个 Promise 上，连同已成功返回的 base64 图片一起留在内存中，最终触及约 4 GiB 的 V8 堆上限。

独立的非媒体复现使用 700 个、每个 131072 字符的随机 base64 字符串。垃圾回收后，原写法仍增加 92,026,912 字节（约 87.8 MiB）；直接等待当前结果的写法仅增加 178,000 字节（约 0.17 MiB）。证据：[复现脚本](provenance/memory-repro.mjs)、[修改前](provenance/memory-repro-before.json)、[修改后](provenance/memory-repro-after.json)。这验证了内存保留原因及修正方向，尚未验证修正后的整片渲染。

已准备 [新版本修复补丁](provenance/proposed-v0069-exporter-fix.patch)，尚未应用。它供后续 v006.9 复制的导出器使用：直接等待当前帧，前后检查编码器错误，继续使用现有写入错误处理。不会修改文字、版式、原片、音轨或画面参数，也不会增加 Node 堆上限。v006.8 的导出器、渲染源码、输入与参数保持本次执行时的哈希。

## 执行证据与停止依据

[失败详情](provenance/render-failure.json)记录局部媒体哈希、输入复核、退出码和未执行重试；[媒体探测](provenance/partial-output-probe.json)区分视频与音频时长。原始 running 回执保存在[原回执快照](provenance/failed-run-original-receipt.json)，本次[运行记录](runs/RUN_2026-10-04T06-10-28-057Z_5707170a.json)已补记为 failed，并注明是外部核验后的状态修正。原生 OOM 绕过了 JavaScript 清理；确认本次进程已退出、文件没有写入者后，只释放本次拥有的陈旧锁。

仓库 [AGENTS.md](../../../../AGENTS.md) 规定：“失败记录后停止，不自动重试、改参数或重复提交。”所用 [lyric-code-video 技能](../../../../.agents/skills/lyric-code-video/SKILL.md) 同样要求遵守项目停止规则。因此此处只准备修复方案；须获得继续授权后，在独立新版本应用补丁，再执行一次完整导出及媒体验收。
