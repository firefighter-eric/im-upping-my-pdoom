# v005.0 · 概率游乐场 · Preview 验收

2026-10-02，状态 **review**，等待人工审看。

- 完整视频：`outputs/LLMV_001_V005_R000_001_probability-park-preview_v005.0.mp4`（35.3 MiB）。
- 时间脚本：`SCRIPT.md`；方案与实际实现说明：`TREATMENT.md`。
- 1920×1080，CFR 30fps，固定4次时间采样，4700帧，156.666667秒。
- 原AAC音轨156.650667秒，包哈希完全一致，音画尾差约16ms；未变速、裁剪或重新编码。
- 单次完整渲染215.8秒；记录：`runs/RUN_2026-10-02T14-36-26-861Z_74b0d167.json`。

## 已完成检查

代码编译、9项测试、完整仓库来源校验、媒体规格及原AAC校验通过。注册前通过全片解码。4700个实际画面时间戳符合30fps，最大时间戳舍入误差3.333e-7秒。

实际浏览器播放到80秒，声音处于开启状态；静音播放与三次跳转、非静音播放与三次跳转均通过，readyState=4、媒体错误为空。该证据只确认媒体正常播放，不能证明已经实际听辨同步。

全部46句有全文显示与逐词高亮，原生排版边界与句尾覆盖检查通过。最终MP4抽取142张不同帧，留存帧号、时间与SHA-256；已查看46句尾画面及FOOM命中前后、最终副歌、尾声和淡出原生帧。中段及六段连续运动序列在渲染前审看。截图证据位于stills/，具体范围见`runs/ENCODED_FRAME_AUDIT.json`。

## 待人工审看

13个低置信词、4处额外声部、正常速度阅读与听感踩点仍待复核；未记录人工批准。部分场景采用机械几何隐喻与匹配硬切，具体实现说明已写入TREATMENT。音乐及歌词权利继续为TBD。

## 证据

- `runs/DELIVERY_QA.json`：验收汇总。
- `runs/PLAYBACK_QA.json`、`runs/UNMUTED_PLAYBACK_QA.json`：播放证据。
- `provenance/authoring-preflight.json`、`provenance/motion-preflight.json`：草稿预检。
- `provenance/toolchain.json`：实际工具版本。
- `data/storyboard-v005.0.json`：46句、92个主／次层声音锚点事件。
