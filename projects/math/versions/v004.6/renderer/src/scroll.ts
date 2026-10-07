import * as THREE from 'three';

type Manifest = {settings: {width: number; height: number; fps: number; duration_seconds: number; sampling: {samples: number; shutter: number}}; variants: {id: string}[]};
type Milestone = {id: string; kind?: string; year: string; suffix?: string; date_display: string; date_role?: string; start: number; end: number; title: string; summary: string; count?: number; count_unit?: string; fact_ids: string[]};
type Storyboard = {intro_end: number; scroll_start: number; scroll_end: number; source_label: string; timeline: Milestone[]; overlay_fade_seconds: number; transition: {enter_seconds: number; exit_seconds: number; initial_enter_seconds: number; travel_px: number; final_travel_px: number}; ending_panorama: {start: number; zoom_end: number; hold_end: number; fade_end: number; overview_top_px: number; overview_height_px: number; sticky_header_fade_seconds: number}; ending_statistics: {start: number; enter_seconds: number; items: {count: number; unit: string; x: number}[]; number_baseline_px: number; number_size_px: number; unit_baseline_px: number; unit_size_px: number; color: string}};
type EndingState = {phase: string; progress: number; scale: number; page_x: number; page_y: number; page_width: number; page_height: number; document_alpha: number; sticky_header_alpha: number; statistics_alpha: number; visible_source_start: number; visible_source_end: number; visible_rows: number[]; whole_document_visible: boolean};
type TransitionState = {node_id: string; year: string; date_display: string; date_suffix: string; content_alpha: number; content_translate_y: number; year_alpha: number; year_translate_y: number; overlay_alpha: number; exit_translate_y: number};
type Annotation = {index: number; folder: string; topic_zh: string; explanation_zh: string};
type HeaderReference = {source_path: string; source_sha256: string; width: number; height: number; header_height_px: number};
type Segment = {source_id: string; path: string; sha256: string; top: number; width: number; height: number};
type DirectoryCapture = {width: number; height: number; body_top_px: number; body_height_px: number; row_height_px: number; row_count: number; note_column_x_px: number; mask_column_x_px: number; mask_column_end_px: number; segments: Segment[]};
type PictureState = {source_segments: {source_id: string; sha256: string}[]; crop: number[]; visible_rows: number[]; annotated_visible_rows: number[]; overlay_alpha: number; scroll_offset_px: number; original_english_layer: string; overlays: string[]};
declare global {interface Window {
  ready: Promise<void>;
  renderFrame: (seconds: number, variant: string, capture?: boolean) => string | null;
  renderDesignPng: (seconds: number, variant: string) => string;
  sourcePicture: {state: (seconds: number) => PictureState};
  timelineDesign: {state: (seconds: number) => Milestone; transitionState: (seconds: number) => TransitionState};
  endingDesign: {state: (seconds: number) => EndingState};
}}

const canvas = document.querySelector('canvas')!;
window.ready = (async () => {
  const [manifest, storyboard, annotations, directory, reference, capture] = await Promise.all([
    fetch('../manifest.json').then(r => r.json()) as Promise<Manifest>,
    fetch('../data/storyboard.json').then(r => r.json()) as Promise<Storyboard>,
    fetch('../data/annotations.zh.json').then(r => r.json()) as Promise<{items: Annotation[]}>,
    fetch('../data/directory.json').then(r => r.json()) as Promise<{entries: {name: string}[]}>,
    fetch('../data/screenshot-layout.json').then(r => r.json()) as Promise<HeaderReference>,
    fetch('../data/github-capture.json').then(r => r.json()) as Promise<DirectoryCapture>,
  ]);
  async function loadPicture(sourcePath: string): Promise<HTMLImageElement> {
    const picture = new Image();
    await new Promise<void>((resolve, reject) => {
      picture.onload = () => resolve(); picture.onerror = () => reject(Error('Original GitHub capture unavailable: ' + sourcePath));
      picture.src = '../../../' + sourcePath;
    });
    return picture;
  }
  const [headerSource, ...segmentPictures] = await Promise.all([loadPicture(reference.source_path), ...capture.segments.map(segment => loadPicture(segment.path))]);
  if (headerSource.naturalWidth !== reference.width || headerSource.naturalHeight !== reference.height) throw Error('Original header reference dimensions changed');
  for (const [index, segment] of capture.segments.entries()) {
    const picture = segmentPictures[index]!;
    if (picture.naturalWidth !== segment.width || picture.naturalHeight !== segment.height) throw Error('Original directory segment dimensions changed');
  }
  if (directory.entries.length !== capture.row_count) throw Error('Directory capture count mismatch');
  await document.fonts.ready;
  const headerPicture = document.createElement('canvas');
  headerPicture.width = reference.width; headerPicture.height = reference.header_height_px;
  headerPicture.getContext('2d')!.drawImage(headerSource, 0, 0);
  const notes = new Map(annotations.items.map(note => {
    if (directory.entries[note.index]?.name !== note.folder) throw Error('Chinese annotation mapped to wrong paper');
    return [note.index, note] as const;
  }));
  const {width, height, fps} = manifest.settings;
  const outputScale = width / 1920, imageScale = 1920 / capture.width;
  const headerHeight = reference.header_height_px * 1920 / reference.width;
  const sourceBodyHeight = (1080 - headerHeight) / imageScale;
  const maximumOffset = capture.body_height_px - sourceBodyHeight;
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  const frame = document.createElement('canvas'), sample = document.createElement('canvas');
  frame.width = sample.width = width; frame.height = sample.height = height;
  const frameCtx = frame.getContext('2d', {alpha: false})!, ctx = sample.getContext('2d', {alpha: false})!;
  const renderer = new THREE.WebGLRenderer({canvas, preserveDrawingBuffer: true, antialias: false});
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const texture = new THREE.CanvasTexture(frame); texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false; texture.minFilter = texture.magFilter = THREE.LinearFilter;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-width/2, width/2, height/2, -height/2, .1, 10);
  camera.position.z = 1;
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({map: texture, toneMapped: false})));
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const smooth = (x: number) => {const t = clamp(x); return t*t*(3-2*t);};
  const phaseAt = (seconds: number) => storyboard.timeline.find(item => seconds >= item.start && seconds < item.end) ?? storyboard.timeline.at(-1)!;
  const offsetAt = (seconds: number) => maximumOffset * clamp((seconds - storyboard.scroll_start) / (storyboard.scroll_end - storyboard.scroll_start));
  const overlayAt = (seconds: number) => seconds >= storyboard.intro_end ? 0 : 1 - smooth((seconds - storyboard.intro_end + storyboard.overlay_fade_seconds) / storyboard.overlay_fade_seconds);
  const documentHeight = headerHeight + capture.body_height_px * imageScale;
  function endingAt(seconds: number): EndingState {
    const ending = storyboard.ending_panorama;
    const progress = smooth((seconds - ending.start) / (ending.zoom_end - ending.start));
    const scale = Math.exp(Math.log(ending.overview_height_px / documentHeight) * progress);
    const pageWidth = 1920 * scale, pageHeight = documentHeight * scale;
    const bottom = 1080 + (ending.overview_top_px + ending.overview_height_px - 1080) * progress;
    const pageX = (1920 - pageWidth) / 2, pageY = seconds < ending.start ? -offsetAt(seconds) * imageScale : bottom - pageHeight;
    const stickyAlpha = 1 - smooth((seconds - ending.start) / ending.sticky_header_fade_seconds);
    const alpha = 1 - smooth((seconds - ending.hold_end) / (ending.fade_end - ending.hold_end));
    const visibleTop = stickyAlpha === 1 ? headerHeight : 0;
    const sourceStart = Math.max(0, ((visibleTop - pageY) / scale - headerHeight) / imageScale);
    const sourceEnd = Math.min(capture.body_height_px, ((1080 - pageY) / scale - headerHeight) / imageScale);
    return {
      phase: seconds < ending.start ? 'scroll' : seconds < ending.zoom_end ? 'zoom-out' : seconds < ending.hold_end ? 'overview' : 'fade-out',
      progress, scale, page_x: pageX, page_y: pageY, page_width: pageWidth, page_height: pageHeight,
      document_alpha: alpha, sticky_header_alpha: stickyAlpha,
      statistics_alpha: alpha * smooth((seconds - storyboard.ending_statistics.start) / storyboard.ending_statistics.enter_seconds),
      visible_source_start: sourceStart, visible_source_end: sourceEnd,
      visible_rows: [Math.max(0, Math.floor(sourceStart / capture.row_height_px)), Math.min(capture.row_count - 1, Math.ceil(sourceEnd / capture.row_height_px) - 1)],
      whole_document_visible: pageY >= -1e-8 && pageY + pageHeight <= 1080 + 1e-8,
    };
  }
  function transitionAt(seconds: number): TransitionState {
    const phase = phaseAt(seconds), index = storyboard.timeline.indexOf(phase);
    const timing = storyboard.transition;
    const enter = smooth((seconds - phase.start) / (index === 0 ? timing.initial_enter_seconds : timing.enter_seconds));
    const leave = index === storyboard.timeline.length - 1 ? 1 : smooth((phase.end - seconds) / timing.exit_seconds);
    let first = index, last = index;
    while (first > 0 && storyboard.timeline[first - 1]!.year === phase.year) first--;
    while (last < storyboard.timeline.length - 1 && storyboard.timeline[last + 1]!.year === phase.year) last++;
    const yearEnter = smooth((seconds - storyboard.timeline[first]!.start) / (first === 0 ? timing.initial_enter_seconds : timing.enter_seconds));
    const yearLeave = last === storyboard.timeline.length - 1 ? 1 : smooth((storyboard.timeline[last]!.end - seconds) / timing.exit_seconds);
    return {
      node_id: phase.id, year: phase.year, date_display: phase.date_display, date_suffix: phase.suffix!,
      content_alpha: enter * leave,
      content_translate_y: timing.travel_px * (1 - enter) - timing.travel_px * (1 - leave),
      year_alpha: yearEnter * yearLeave,
      year_translate_y: timing.travel_px * (1 - yearEnter) - timing.travel_px * (1 - yearLeave),
      overlay_alpha: overlayAt(seconds),
      exit_translate_y: -timing.final_travel_px * (1 - overlayAt(seconds)),
    };
  }

  function sourceState(seconds: number): PictureState {
    const offset = offsetAt(seconds), sourceY = capture.body_top_px + offset;
    if (seconds >= storyboard.ending_panorama.start) {
      const ending = endingAt(seconds), start = capture.body_top_px + ending.visible_source_start, end = capture.body_top_px + ending.visible_source_end;
      return {
        source_segments: capture.segments.filter(segment => segment.top < end && segment.top + segment.height > start).map(segment => ({source_id: segment.source_id, sha256: segment.sha256})),
        crop: [0, start, capture.width, end - start], visible_rows: ending.visible_rows,
        annotated_visible_rows: [...notes.keys()].filter(index => index >= ending.visible_rows[0]! && index <= ending.visible_rows[1]!),
        overlay_alpha: 0, scroll_offset_px: offset,
        original_english_layer: 'Original registered GitHub pixels projected as one continuous long page; no English redraw or independent montage.',
        overlays: ['Same Chinese notes in the original commit column', 'Original breadcrumb at the top of the complete long document', 'Subtle document edge and shadow on a white background', ...(ending.sticky_header_alpha > 0 ? ['Sticky breadcrumb dissolves while the camera pulls back'] : []), ...(ending.statistics_alpha > 0 ? ['722 manuscripts and 372 related result families beside the full-page overview'] : [])],
      };
    }
    const first = Math.max(0, Math.floor(offset / capture.row_height_px));
    const last = Math.min(capture.row_count - 1, Math.ceil((offset + sourceBodyHeight) / capture.row_height_px) - 1);
    return {
      source_segments: capture.segments.filter(segment => segment.top < sourceY + sourceBodyHeight && segment.top + segment.height > sourceY).map(segment => ({source_id: segment.source_id, sha256: segment.sha256})),
      crop: [0, sourceY, capture.width, sourceBodyHeight], visible_rows: [first, last],
      annotated_visible_rows: [...notes.keys()].filter(index => index >= first && index <= last),
      overlay_alpha: overlayAt(seconds), scroll_offset_px: offset,
      original_english_layer: 'Unmodified native GitHub screenshot pixels, scaled and cropped; native English, folders, separators and ellipses preserved.',
      overlays: ['Native breadcrumb header from the user screenshot', 'Chinese notes only inside annotated rows of the original commit column', ...(seconds < storyboard.intro_end ? [`Translucent white opening wash and milestone type; disappear by ${storyboard.intro_end} seconds`] : [])],
    };
  }

  function panoramaScene(seconds: number): void {
    const ending = endingAt(seconds), state = sourceState(seconds);
    ctx.save(); ctx.globalAlpha = ending.document_alpha;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(31,35,40,' + .12 * smooth(ending.progress * 4) + ')';
    ctx.shadowBlur = 16; ctx.shadowOffsetY = 3;
    ctx.fillRect(ending.page_x, ending.page_y, ending.page_width, ending.page_height);
    ctx.shadowColor = 'transparent';
    ctx.save(); ctx.translate(ending.page_x, ending.page_y); ctx.scale(ending.scale, ending.scale);
    const visibleStart = capture.body_top_px + ending.visible_source_start, visibleEnd = capture.body_top_px + ending.visible_source_end;
    for (const [index, segment] of capture.segments.entries()) {
      const start = Math.max(visibleStart, segment.top), end = Math.min(visibleEnd, segment.top + segment.height);
      if (end <= start) continue;
      ctx.drawImage(segmentPictures[index]!, 0, start - segment.top, capture.width, end - start,
        0, headerHeight + (start - capture.body_top_px) * imageScale, 1920, (end - start) * imageScale);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(0, headerHeight, 1920, documentHeight - headerHeight); ctx.clip();
    ctx.translate(0, headerHeight); ctx.scale(imageScale, imageScale);
    for (let index = state.visible_rows[0]!; index <= state.visible_rows[1]!; index++) {
      const note = notes.get(index); if (!note) continue;
      const top = index * capture.row_height_px;
      ctx.fillStyle = '#fff';
      ctx.fillRect(capture.mask_column_x_px, top + 1, capture.mask_column_end_px - capture.mask_column_x_px, capture.row_height_px - 2);
      ctx.save(); ctx.beginPath(); ctx.rect(capture.mask_column_x_px, top + 1, capture.mask_column_end_px - capture.mask_column_x_px, capture.row_height_px - 2); ctx.clip();
      ctx.fillStyle = '#1f2328'; ctx.font = '500 17px ' + font; ctx.fillText(note.topic_zh, capture.note_column_x_px, top + 18);
      ctx.fillStyle = '#59636e'; ctx.font = '14px ' + font; ctx.fillText(note.explanation_zh, capture.note_column_x_px, top + 35);
      ctx.restore();
    }
    ctx.restore();
    ctx.drawImage(headerPicture, 0, 0, 1920, headerHeight);
    ctx.font = '500 22px ' + font; ctx.fillStyle = '#59636e';
    ctx.fillText('中文速览', capture.note_column_x_px * imageScale, headerHeight * .65);
    ctx.restore();
    ctx.strokeStyle = 'rgba(208,215,222,' + smooth(ending.progress * 4) + ')'; ctx.lineWidth = 1;
    ctx.strokeRect(ending.page_x, ending.page_y, ending.page_width, ending.page_height);
    if (ending.sticky_header_alpha > 0) {
      ctx.globalAlpha *= ending.sticky_header_alpha;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1920, headerHeight);
      ctx.drawImage(headerPicture, 0, 0, 1920, headerHeight);
      ctx.font = '500 22px ' + font; ctx.fillStyle = '#59636e';
      ctx.fillText('中文速览', capture.note_column_x_px * imageScale, headerHeight * .65);
    }
    ctx.restore();
  }

  function directoryScene(seconds: number): void {
    const state = sourceState(seconds), sourceY = state.crop[1]!;
    for (const [index, segment] of capture.segments.entries()) {
      const start = Math.max(sourceY, segment.top), end = Math.min(sourceY + sourceBodyHeight, segment.top + segment.height);
      if (end <= start) continue;
      ctx.drawImage(segmentPictures[index]!, 0, start - segment.top, capture.width, end - start,
        0, headerHeight + (start - sourceY) * imageScale, 1920, (end - start) * imageScale);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(0, headerHeight, 1920, 1080 - headerHeight); ctx.clip();
    ctx.translate(0, headerHeight); ctx.scale(imageScale, imageScale);
    for (let index = state.visible_rows[0]; index <= state.visible_rows[1]; index++) {
      const note = notes.get(index); if (!note) continue;
      const top = capture.body_top_px + index * capture.row_height_px - sourceY;
      ctx.fillStyle = '#fff';
      ctx.fillRect(capture.mask_column_x_px, top + 1, capture.mask_column_end_px - capture.mask_column_x_px, capture.row_height_px - 2);
      ctx.save(); ctx.beginPath(); ctx.rect(capture.mask_column_x_px, top + 1, capture.mask_column_end_px - capture.mask_column_x_px, capture.row_height_px - 2); ctx.clip();
      ctx.fillStyle = '#1f2328'; ctx.font = '500 17px ' + font; ctx.fillText(note.topic_zh, capture.note_column_x_px, top + 18);
      ctx.fillStyle = '#59636e'; ctx.font = '14px ' + font; ctx.fillText(note.explanation_zh, capture.note_column_x_px, top + 35);
      ctx.restore();
    }
    ctx.restore();
    ctx.drawImage(headerPicture, 0, 0, 1920, headerHeight);
    if (state.annotated_visible_rows.length) {
      ctx.font = '500 22px ' + font; ctx.fillStyle = '#59636e';
      ctx.fillText('中文速览', capture.note_column_x_px * imageScale, headerHeight * .65);
    }
  }

  function endingStatistics(seconds: number): void {
    const alpha = endingAt(seconds).statistics_alpha; if (alpha <= 0) return;
    const stats = storyboard.ending_statistics;
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center';
    for (const item of stats.items) {
      ctx.fillStyle = stats.color; ctx.font = '800 ' + stats.number_size_px + 'px ' + font;
      ctx.fillText(String(item.count), item.x, stats.number_baseline_px);
      ctx.fillStyle = '#59636e'; ctx.font = '500 ' + stats.unit_size_px + 'px ' + font;
      ctx.fillText(item.unit, item.x, stats.unit_baseline_px);
    }
    ctx.restore();
  }

  function openingHeader(): void {
    ctx.fillStyle = '#59636e'; ctx.font = '500 25px ' + font;
    ctx.fillText('从对话，到数学前沿', 112, 124);
    ctx.textAlign = 'right'; ctx.fillStyle = '#0969da'; ctx.font = '600 29px ' + font;
    ctx.fillText('不到 4 年', 1808, 124); ctx.textAlign = 'left';
  }
  function timelineRail(year: string, activeAlpha: number): void {
    const labels = ['2022 · ChatGPT', '2023 · GPT-4', '2024 · o1', '2025 · GPT-5', '2026 · 前沿突破'];
    for (const [i, label] of labels.entries()) {
      const active = label.startsWith(year), x = 114 + i * 330;
      ctx.fillStyle = '#59636e'; ctx.font = '500 25px ' + font;
      ctx.fillText(label, x, 998);
      if (active) {
        ctx.save(); ctx.globalAlpha *= activeAlpha;
        ctx.fillStyle = '#0969da'; ctx.font = '500 25px ' + font; ctx.fillText(label, x, 998);
        ctx.fillRect(x, 1014, 58, 4); ctx.restore();
      }
    }
  }
  function opening(seconds: number): void {
    const alpha = overlayAt(seconds); if (alpha <= 0) return;
    const wash = ctx.createLinearGradient(0, headerHeight, 0, 1080);
    for (const [stop, opacity] of [[0,.42],[.18,.60],[.5,.68],[.8,.62],[1,.43]]) wash.addColorStop(stop!, 'rgba(255,255,255,' + opacity! * alpha + ')');
    ctx.fillStyle = wash; ctx.fillRect(0, headerHeight, 1920, 1080 - headerHeight);
    ctx.save(); ctx.globalAlpha = alpha;
    const phase = phaseAt(seconds), transition = transitionAt(seconds);
    ctx.translate(0, transition.exit_translate_y);
    openingHeader();
    ctx.save(); ctx.globalAlpha *= transition.year_alpha; ctx.translate(0, transition.year_translate_y);
    ctx.fillStyle = '#1f2328'; ctx.font = '800 340px ' + font; ctx.fillText(phase.year, 96, 524);
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= transition.content_alpha; ctx.translate(0, transition.content_translate_y);
    ctx.fillStyle = '#0969da'; ctx.font = '600 114px ' + font; ctx.fillText(phase.suffix!, 1048, 499);
    if (phase.date_role === 'editorial-as-of') {
      ctx.fillStyle = '#59636e'; ctx.font = '500 30px ' + font; ctx.fillText('截至', 1048, 365);
    }
    if (phase.count !== undefined) {
      ctx.fillStyle = '#1f2328'; ctx.font = '600 48px ' + font; ctx.fillText(phase.title, 106, 620);
      ctx.fillStyle = '#0969da'; ctx.font = '800 230px ' + font; ctx.fillText(String(phase.count), 106, 840);
      ctx.fillStyle = '#1f2328'; ctx.font = '600 70px ' + font; ctx.fillText(phase.count_unit!, 600, 820);
      ctx.font = '32px ' + font; ctx.fillStyle = '#59636e'; ctx.fillText(phase.summary, 114, 920);
      ctx.font = '20px ' + font; ctx.fillText('预印本合集 · 验证状态各异', 114, 956);
      ctx.textAlign = 'right'; ctx.fillText(storyboard.source_label, 1808, 956); ctx.textAlign = 'left';
    } else if (phase.kind === 'ns') {
      ctx.fillStyle = '#0969da'; ctx.font = '800 160px ' + font; ctx.fillText('NS', 106, 724);
      ctx.fillStyle = '#1f2328'; ctx.font = '600 70px ' + font; ctx.fillText('千禧难题 · 给出解法', 378, 708);
      ctx.fillStyle = '#59636e'; ctx.font = '39px ' + font; ctx.fillText(phase.summary, 114, 822);
    } else {
      ctx.fillStyle = '#1f2328'; ctx.font = '600 ' + (phase.id === 'TL_2025' ? 99 : 112) + 'px ' + font; ctx.fillText(phase.title, 106, 708);
      ctx.fillStyle = '#59636e'; ctx.font = '39px ' + font; ctx.fillText(phase.summary, 114, 802);
    }
    ctx.restore(); timelineRail(phase.year, transition.year_alpha); ctx.restore();
  }
  function draw(seconds: number): void {
    ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0); ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1920, 1080);
    if (seconds < storyboard.ending_panorama.start) directoryScene(seconds);
    else panoramaScene(seconds);
    if (seconds >= storyboard.ending_statistics.start) endingStatistics(seconds);
    if (seconds < storyboard.intro_end) opening(seconds);
  }
  window.sourcePicture = {state: sourceState}; window.timelineDesign = {state: phaseAt, transitionState: transitionAt};
  window.endingDesign = {state: endingAt};
  window.renderFrame = (seconds, variant, capture = true) => {
    if (!manifest.variants.some(v => v.id === variant)) throw Error('Unknown variant');
    const {samples, shutter} = manifest.settings.sampling;
    for (let i = 0; i < samples; i++) {
      const t = Math.max(0, Math.min(manifest.settings.duration_seconds, seconds + ((i+.5)/samples-.5)*shutter/fps));
      draw(t); frameCtx.globalAlpha = 1/(i+1); frameCtx.drawImage(sample, 0, 0);
    }
    frameCtx.globalAlpha = 1; texture.needsUpdate = true; renderer.render(scene, camera);
    return capture ? canvas.toDataURL('image/jpeg', .97).split(',')[1]! : null;
  };
  window.renderDesignPng = (seconds, variant) => {window.renderFrame(seconds, variant, false); return canvas.toDataURL('image/png').split(',')[1]!;};
  window.renderFrame(.64, manifest.variants[0]!.id, false);
})();
