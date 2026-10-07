import * as THREE from 'three';

type Manifest = {settings: {width: number; height: number; fps: number; duration_seconds: number; sampling: {samples: number; shutter: number}}; variants: {id: string}[]};
type Milestone = {id: string; kind?: string; year: string; suffix?: string; date_display: string; start: number; end: number; title: string; summary: string; count?: number; count_unit?: string; fact_ids: string[]};
type Storyboard = {intro_end: number; outro_start: number; headline: string[]; closing: string; source_label: string; timeline: Milestone[]};
type Annotation = {index: number; folder: string; topic_zh: string; explanation_zh: string};
type Reference = {source_path: string; source_sha256: string; width: number; height: number; header_height_px: number; row_height_px: number; first_complete_row: number; first_complete_row_top_px: number; last_complete_row: number; source_global_offset_px: number; sample_seconds: number; note_column_x_px: number; mask_column_x_px: number};
type PictureState = {source_sha256: string; crop: number[]; visible_rows: number[]; original_english_layer: string; overlays: string[]};
declare global {interface Window {
  ready: Promise<void>;
  renderFrame: (seconds: number, variant: string, capture?: boolean) => string | null;
  renderDesignPng: (seconds: number, variant: string) => string;
  sourcePicture: {state: (seconds: number) => PictureState};
  timelineDesign: {state: (seconds: number) => Milestone};
}}

const canvas = document.querySelector('canvas')!;
window.ready = (async () => {
  const [manifest, storyboard, annotations, directory, reference] = await Promise.all([
    fetch('../manifest.json').then(r => r.json()) as Promise<Manifest>,
    fetch('../data/storyboard.json').then(r => r.json()) as Promise<Storyboard>,
    fetch('../data/annotations.zh.json').then(r => r.json()) as Promise<{items: Annotation[]}>,
    fetch('../data/directory.json').then(r => r.json()) as Promise<{entries: {name: string}[]}>,
    fetch('../data/screenshot-layout.json').then(r => r.json()) as Promise<Reference>,
  ]);
  const picture = new Image();
  await new Promise<void>((resolve, reject) => {picture.onload = () => resolve(); picture.onerror = () => reject(Error('Original GitHub screenshot unavailable')); picture.src = '../../../' + reference.source_path;});
  await document.fonts.ready;
  const headerPicture = document.createElement('canvas');
  headerPicture.width = reference.width; headerPicture.height = reference.header_height_px;
  headerPicture.getContext('2d')!.drawImage(picture, 0, 0);
  if (picture.naturalWidth !== reference.width || picture.naturalHeight !== reference.height) throw Error('Original screenshot dimensions changed');
  const notes = new Map(annotations.items.map(note => {
    if (directory.entries[note.index]?.name !== note.folder) throw Error('Chinese annotation mapped to wrong paper');
    return [note.index, note] as const;
  }));
  const {width, height, fps} = manifest.settings;
  const outputScale = width / 1920, imageScale = 1920 / reference.width;
  const headerHeight = reference.header_height_px * imageScale;
  const sourceBodyHeight = (1080 - headerHeight) / imageScale;
  const maximumOffset = 722 * reference.row_height_px - sourceBodyHeight;
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
  const punch = (elapsed: number) => 1 + .22 * Math.exp(-elapsed * 15);
  const shiftAt = (seconds: number) => maximumOffset * clamp((seconds - storyboard.intro_end) / (storyboard.outro_start - storyboard.intro_end)) - reference.source_global_offset_px;
  function sourceState(seconds: number): PictureState {
    const shift = shiftAt(seconds), firstTop = reference.first_complete_row_top_px;
    return {source_sha256: reference.source_sha256,
      crop: [0, reference.header_height_px + shift, reference.width, sourceBodyHeight],
      visible_rows: [Math.max(reference.first_complete_row, Math.floor((reference.header_height_px + shift - firstTop) / reference.row_height_px) + reference.first_complete_row), Math.min(reference.last_complete_row, Math.floor((reference.header_height_px + shift + sourceBodyHeight - firstTop) / reference.row_height_px) + reference.first_complete_row)],
      original_english_layer: 'actual source screenshot scaled and cropped; no redrawn English or folders',
      overlays: ['Chinese topic and explanation inside the original commit column only']};
  }
  function originalHeader(): void {
    ctx.drawImage(headerPicture, 0, 0, 1920, headerHeight);
  }
  function openingHeader(): void {
    ctx.fillStyle = '#59636e'; ctx.font = '500 25px ' + font;
    ctx.fillText('从对话，到数学前沿', 112, 106);
    ctx.textAlign = 'right'; ctx.fillStyle = '#0969da'; ctx.font = '600 29px ' + font;
    ctx.fillText('不到 4 年', 1808, 106); ctx.textAlign = 'left';
  }
  function timelineRail(year: string): void {
    for (const [i, label] of ['2022', '2023', '2024', '2025', '2026'].entries()) {
      ctx.fillStyle = label === year ? '#0969da' : '#8c959f';
      ctx.font = (label === year ? '600 ' : '400 ') + '26px ' + font;
      ctx.fillText(label, 114 + i * 160, 983);
      if (label === year) {ctx.fillStyle = '#0969da'; ctx.fillRect(114+i*160, 1000, 58, 4);}
    }
  }
  function opening(seconds: number): void {
    const phase = phaseAt(seconds), elapsed = Math.max(0, seconds - phase.start);
    openingHeader();
    if (phase.count !== undefined) {
      ctx.fillStyle = '#59636e'; ctx.font = '500 32px ' + font; ctx.fillText(phase.date_display, 112, 191);
      ctx.fillStyle = '#1f2328'; ctx.font = '600 68px ' + font; ctx.fillText(phase.title, 106, 294);
      ctx.save(); ctx.translate(960, 738); const scale = punch(elapsed); ctx.scale(scale, scale);
      ctx.textAlign = 'center'; ctx.fillStyle = '#0969da'; ctx.font = '800 492px ' + font;
      ctx.fillText(String(phase.count), 0, 0); ctx.restore();
      ctx.textAlign = 'center'; ctx.fillStyle = '#1f2328'; ctx.font = '600 58px ' + font;
      ctx.fillText(phase.count_unit!, 960, 843); ctx.font = '30px ' + font; ctx.fillStyle = '#59636e';
      ctx.fillText(phase.summary, 960, 920); ctx.textAlign = 'left';
      ctx.font = '22px ' + font; ctx.fillText('预印本合集 · 验证状态各异', 112, 1000);
      ctx.textAlign = 'right'; ctx.fillText(storyboard.source_label, 1808, 1000); ctx.textAlign = 'left';
      return;
    }
    if (phase.kind === 'ns') {
      ctx.fillStyle = '#59636e'; ctx.font = '500 37px ' + font; ctx.fillText(phase.date_display, 114, 222);
      ctx.save(); ctx.translate(112, 668); const scale = punch(elapsed); ctx.scale(scale, scale);
      ctx.fillStyle = '#0969da'; ctx.font = '800 500px ' + font; ctx.fillText('NS', 0, 0); ctx.restore();
      ctx.fillStyle = '#59636e'; ctx.font = '500 45px ' + font; ctx.fillText('Navier–Stokes', 915, 375);
      ctx.fillStyle = '#1f2328'; ctx.font = '600 96px ' + font;
      ctx.fillText('千禧难题', 907, 531); ctx.fillText('给出解法', 907, 653);
      ctx.fillStyle = '#59636e'; ctx.font = '36px ' + font; ctx.fillText(phase.summary, 114, 832);
      timelineRail(phase.year); return;
    }
    const scale = punch(elapsed);
    ctx.save(); ctx.translate(96, 524); ctx.scale(scale, scale);
    ctx.fillStyle = '#1f2328'; ctx.font = '800 340px ' + font; ctx.fillText(phase.year, 0, 0); ctx.restore();
    ctx.fillStyle = '#0969da'; ctx.font = '600 114px ' + font;
    ctx.fillText(phase.suffix!, 1048, 499);
    if (phase.id === 'TL_2026') {ctx.fillStyle = '#59636e'; ctx.font = '30px ' + font; ctx.fillText('截至', 1053, 366);}
    const rise = 24 * (1 - smooth(elapsed / .18));
    ctx.save(); ctx.globalAlpha *= smooth((elapsed + .055) / .18);
    ctx.fillStyle = '#1f2328'; ctx.font = '600 ' + (phase.id === 'TL_2025' ? 99 : 112) + 'px ' + font;
    ctx.fillText(phase.title, 106, 708 + rise);
    ctx.fillStyle = '#59636e'; ctx.font = '39px ' + font; ctx.fillText(phase.summary, 114, 802 + rise); ctx.restore();
    timelineRail(phase.year);
  }
  function directoryScene(seconds: number): void {
    const shift = shiftAt(seconds), sourceY = reference.header_height_px + shift;
    if (sourceY < reference.header_height_px - .01 || sourceY + sourceBodyHeight > reference.height + .01) throw Error('This still-only original screenshot does not cover the requested directory time');
    ctx.drawImage(picture, 0, Math.max(reference.header_height_px, sourceY), reference.width, sourceBodyHeight, 0, headerHeight, 1920, 1080 - headerHeight);
    ctx.save(); ctx.beginPath(); ctx.rect(0, headerHeight, 1920, 1080 - headerHeight); ctx.clip(); ctx.scale(imageScale, imageScale);
    for (let index = reference.first_complete_row - 1; index <= reference.last_complete_row; index++) {
      const top = reference.first_complete_row_top_px + (index - reference.first_complete_row) * reference.row_height_px - shift;
      if (top > 1080 / imageScale || top + reference.row_height_px < reference.header_height_px) continue;
      ctx.fillStyle = '#fff'; ctx.fillRect(reference.mask_column_x_px, top + 1, reference.width - reference.mask_column_x_px, reference.row_height_px - 4);
      const note = notes.get(index); if (!note) continue;
      ctx.fillStyle = '#1f2328'; ctx.font = '500 29px ' + font; ctx.fillText(note.topic_zh, reference.note_column_x_px, top + 30);
      ctx.fillStyle = '#59636e'; ctx.font = '23px ' + font; ctx.fillText(note.explanation_zh, reference.note_column_x_px, top + 62);
    }
    ctx.restore(); ctx.font = '500 22px ' + font; ctx.fillStyle = '#59636e';
    ctx.fillText('中文速览', reference.note_column_x_px * imageScale, headerHeight * .65);
  }
  function closing(seconds: number): void {
    ctx.save(); ctx.globalAlpha *= smooth((seconds - storyboard.outro_start + .15) / .85); ctx.textAlign = 'center';
    ctx.font = '700 260px ' + font; ctx.fillStyle = '#0969da'; ctx.fillText('722', 960, 487);
    ctx.font = '500 52px ' + font; ctx.fillStyle = '#1f2328'; ctx.fillText('篇数学预印本', 960, 592);
    ctx.font = '43px ' + font; ctx.fillText(storyboard.closing, 960, 747);
    ctx.font = '25px ' + font; ctx.fillStyle = '#59636e'; ctx.fillText(storyboard.source_label, 960, 939);
    ctx.font = '21px ' + font; ctx.fillText('预印本合集 · 验证状态各异', 960, 991); ctx.restore();
  }
  function draw(seconds: number): void {
    ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0); ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1920, 1080);
    if (seconds < storyboard.intro_end) opening(seconds);
    else {originalHeader(); if (seconds >= storyboard.outro_start) closing(seconds); else directoryScene(seconds);}
  }
  window.sourcePicture = {state: sourceState};
  window.timelineDesign = {state: phaseAt};
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
  window.renderFrame(.94, manifest.variants[0]!.id, false);
})();
