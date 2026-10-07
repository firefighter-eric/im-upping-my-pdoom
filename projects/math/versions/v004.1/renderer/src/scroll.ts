import * as THREE from 'three';

type Manifest = {settings: {width: number; height: number; fps: number; duration_seconds: number; sampling: {samples: number; shutter: number}}; variants: {id: string}[]};
type Milestone = {id: string; kind?: string; year: string; suffix?: string; date_display: string; start: number; end: number; title: string; summary: string; count?: number; count_unit?: string; fact_ids: string[]};
type Storyboard = {intro_end: number; scroll_end: number; source_label: string; timeline: Milestone[]; overlay_fade_seconds: number};
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
  timelineDesign: {state: (seconds: number) => Milestone};
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
  const punch = (elapsed: number) => 1 + .14 * Math.exp(-elapsed * 18);
  const offsetAt = (seconds: number) => maximumOffset * clamp((seconds - storyboard.intro_end) / (storyboard.scroll_end - storyboard.intro_end));
  const overlayAt = (seconds: number) => seconds >= storyboard.intro_end ? 0 : 1 - smooth((seconds - storyboard.intro_end + storyboard.overlay_fade_seconds) / storyboard.overlay_fade_seconds);

  function sourceState(seconds: number): PictureState {
    const offset = offsetAt(seconds), sourceY = capture.body_top_px + offset;
    const first = Math.max(0, Math.floor(offset / capture.row_height_px));
    const last = Math.min(capture.row_count - 1, Math.ceil((offset + sourceBodyHeight) / capture.row_height_px) - 1);
    return {
      source_segments: capture.segments.filter(segment => segment.top < sourceY + sourceBodyHeight && segment.top + segment.height > sourceY).map(segment => ({source_id: segment.source_id, sha256: segment.sha256})),
      crop: [0, sourceY, capture.width, sourceBodyHeight], visible_rows: [first, last],
      annotated_visible_rows: [...notes.keys()].filter(index => index >= first && index <= last),
      overlay_alpha: overlayAt(seconds), scroll_offset_px: offset,
      original_english_layer: 'Unmodified native GitHub screenshot pixels, scaled and cropped; native English, folders, separators and ellipses preserved.',
      overlays: ['Native breadcrumb header from the user screenshot', 'Chinese notes only inside annotated rows of the original commit column', ...(seconds < storyboard.intro_end ? ['Translucent white opening wash and milestone type; disappear by 5 seconds'] : [])],
    };
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

  function openingHeader(): void {
    ctx.fillStyle = '#59636e'; ctx.font = '500 25px ' + font;
    ctx.fillText('从对话，到数学前沿', 112, 124);
    ctx.textAlign = 'right'; ctx.fillStyle = '#0969da'; ctx.font = '600 29px ' + font;
    ctx.fillText('不到 4 年', 1808, 124); ctx.textAlign = 'left';
  }
  function timelineRail(year: string): void {
    const labels = ['2022', '2023 · GPT-4', '2024 · o1', '2025', '2026'];
    for (const [i, label] of labels.entries()) {
      const active = label.startsWith(year), x = 114 + i * 302;
      ctx.fillStyle = active ? '#0969da' : '#59636e'; ctx.font = (active ? '600 ' : '400 ') + '25px ' + font;
      ctx.fillText(label, x, 998);
      if (active) {ctx.fillStyle = '#0969da'; ctx.fillRect(x, 1014, 58, 4);}
    }
  }
  function opening(seconds: number): void {
    const alpha = overlayAt(seconds); if (alpha <= 0) return;
    const wash = ctx.createLinearGradient(0, headerHeight, 0, 1080);
    for (const [stop, opacity] of [[0,.42],[.18,.60],[.5,.68],[.8,.62],[1,.43]]) wash.addColorStop(stop!, 'rgba(255,255,255,' + opacity! * alpha + ')');
    ctx.fillStyle = wash; ctx.fillRect(0, headerHeight, 1920, 1080 - headerHeight);
    ctx.save(); ctx.globalAlpha = alpha;
    const phase = phaseAt(seconds), elapsed = Math.max(0, seconds - phase.start);
    openingHeader();
    if (phase.count !== undefined) {
      ctx.fillStyle = '#59636e'; ctx.font = '500 32px ' + font; ctx.fillText(phase.date_display, 112, 203);
      ctx.fillStyle = '#1f2328'; ctx.font = '600 68px ' + font; ctx.fillText(phase.title, 106, 302);
      ctx.save(); ctx.translate(960, 738); const scale = punch(elapsed); ctx.scale(scale, scale);
      ctx.textAlign = 'center'; ctx.fillStyle = '#0969da'; ctx.font = '800 492px ' + font; ctx.fillText(String(phase.count), 0, 0); ctx.restore();
      ctx.textAlign = 'center'; ctx.fillStyle = '#1f2328'; ctx.font = '600 58px ' + font; ctx.fillText(phase.count_unit!, 960, 843);
      ctx.font = '30px ' + font; ctx.fillStyle = '#59636e'; ctx.fillText(phase.summary, 960, 920);
      ctx.textAlign = 'left'; ctx.font = '22px ' + font; ctx.fillText('预印本合集 · 验证状态各异', 112, 1000);
      ctx.textAlign = 'right'; ctx.fillText(storyboard.source_label, 1808, 1000); ctx.restore(); return;
    }
    if (phase.kind === 'ns') {
      ctx.fillStyle = '#59636e'; ctx.font = '500 37px ' + font; ctx.fillText(phase.date_display, 114, 222);
      ctx.save(); ctx.translate(112, 668); const scale = punch(elapsed); ctx.scale(scale, scale);
      ctx.fillStyle = '#0969da'; ctx.font = '800 500px ' + font; ctx.fillText('NS', 0, 0); ctx.restore();
      ctx.fillStyle = '#59636e'; ctx.font = '500 45px ' + font; ctx.fillText('Navier–Stokes', 915, 375);
      ctx.fillStyle = '#1f2328'; ctx.font = '600 96px ' + font; ctx.fillText('千禧难题', 907, 531); ctx.fillText('给出解法', 907, 653);
      ctx.fillStyle = '#59636e'; ctx.font = '36px ' + font; ctx.fillText(phase.summary, 114, 832);
      timelineRail(phase.year); ctx.restore(); return;
    }
    ctx.save(); ctx.translate(96, 524); const scale = punch(elapsed); ctx.scale(scale, scale);
    ctx.fillStyle = '#1f2328'; ctx.font = '800 340px ' + font; ctx.fillText(phase.year, 0, 0); ctx.restore();
    ctx.fillStyle = '#0969da'; ctx.font = '600 114px ' + font; ctx.fillText(phase.suffix!, 1048, 499);
    const rise = 24 * (1 - smooth(elapsed / .18));
    ctx.save(); ctx.globalAlpha *= smooth((elapsed + .055) / .18);
    ctx.fillStyle = '#1f2328'; ctx.font = '600 ' + (phase.id === 'TL_2025' ? 99 : 112) + 'px ' + font; ctx.fillText(phase.title, 106, 708 + rise);
    ctx.fillStyle = '#59636e'; ctx.font = '39px ' + font; ctx.fillText(phase.summary, 114, 802 + rise); ctx.restore();
    timelineRail(phase.year); ctx.restore();
  }
  function draw(seconds: number): void {
    ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0); ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1920, 1080);
    directoryScene(seconds);
    if (seconds < storyboard.intro_end) opening(seconds);
  }
  window.sourcePicture = {state: sourceState}; window.timelineDesign = {state: phaseAt};
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
