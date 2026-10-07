import * as THREE from 'three';

type Entry = {name: string; path: string; url: string; tree_sha: string};
type Directory = {source_id: string; ref: string; directory_count: number; commit_message: string; entries: Entry[]};
type Manifest = {settings: {width: number; height: number; fps: number; duration_seconds: number | null; sampling: {samples: number; shutter: number}}; variants: {id: string}[]};
type Storyboard = {intro_end: number; outro_start: number; headline: string[]; closing: string; family_count: number; source_label: string};
type Music = {sample_hz: number; envelope: number[]; onsets: {seconds: number; strength: number}[]};
type Annotation = {index: number; folder: string; topic_zh: string; explanation_zh: string};
type Annotations = {items: Annotation[]};
type StreamOptions = {ws: string; from: number; to: number; fps: number; variant: string; inflight?: number};
declare global {interface Window {
  ready: Promise<void>;
  renderFrame: (seconds: number, variant: string, capture?: boolean) => string | null;
  streamFrames: (options: StreamOptions) => Promise<void>;
  scrollPreview: {duration: number; count: number; ref: string; seek: (seconds: number) => void; state: () => {time: number; offset: number; playing: boolean; scene: string; visibleRange: number[]}};
}}

const canvas = document.querySelector('canvas')!;
const params = new URLSearchParams(location.search);
const exportMode = params.get('export') === '1';
if (exportMode) document.body.classList.add('export');
window.ready = (async () => {
  const [manifest, directory, storyboard, music, annotations] = await Promise.all([
    fetch('../manifest.json').then(r => r.json()) as Promise<Manifest>,
    fetch('../data/directory.json').then(r => r.json()) as Promise<Directory>,
    fetch('../data/storyboard.json').then(r => r.json()) as Promise<Storyboard>,
    fetch('../data/music-features.json').then(r => r.json()) as Promise<Music>,
    fetch('../data/annotations.zh.json').then(r => r.json()) as Promise<Annotations>,
  ]);
  if (!directory.entries.length || directory.entries.length !== directory.directory_count) throw Error('Directory snapshot is incomplete');
  const {width, height, fps} = manifest.settings;
  const duration = manifest.settings.duration_seconds ?? 180;
  const scale = width / 1920, layoutHeight = height / scale;
  const panelX = 88, panelY = 72, panelWidth = 1744, panelHeight = 866;
  const headerHeight = 108, rowHeight = 76, columnX = 1192, nameX = 148, noteX = 1222;
  const nameWidth = columnX - nameX - 28, bodyHeight = panelHeight - headerHeight;
  const maximumOffset = Math.max(0, directory.entries.length * rowHeight - bodyHeight);
  const notes = new Map(annotations.items.map(note => {
    if (directory.entries[note.index]?.name !== note.folder) throw Error('Chinese explanation is mapped to the wrong paper');
    return [note.index, note] as const;
  }));
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  const frameCanvas = document.createElement('canvas'), sampleCanvas = document.createElement('canvas');
  frameCanvas.width = sampleCanvas.width = width;
  frameCanvas.height = sampleCanvas.height = height;
  const frameCtx = frameCanvas.getContext('2d', {alpha: false})!, sampleCtx = sampleCanvas.getContext('2d', {alpha: false})!;
  const renderer = new THREE.WebGLRenderer({canvas, preserveDrawingBuffer: true, antialias: false});
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const texture = new THREE.CanvasTexture(frameCanvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-width/2, width/2, height/2, -height/2, .1, 10);
  camera.position.z = 1;
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({map: texture, toneMapped: false})));
  sampleCtx.font = '20px ' + font;
  const names = directory.entries.map(entry => {
    const lines: string[] = []; let text = entry.name;
    while (text.length) {
      if (sampleCtx.measureText(text).width <= nameWidth) {lines.push(text); break;}
      let cut = 1;
      while (cut < text.length && sampleCtx.measureText(text.slice(0, cut + 1)).width <= nameWidth) cut++;
      const separator = text.lastIndexOf('-', cut - 1);
      if (separator > cut * .6) cut = separator + 1;
      lines.push(text.slice(0, cut)); text = text.slice(cut);
    }
    if (lines.length > 2) throw Error('English title exceeds the two-line design limit: ' + entry.name);
    return lines;
  });

  const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smooth = (value: number) => {const x = clamp(value); return x * x * (3 - 2 * x);};
  function offsetAt(seconds: number): number {
    const travel = storyboard.outro_start - storyboard.intro_end;
    return maximumOffset * clamp((seconds - storyboard.intro_end) / travel);
  }
  function visibleRange(seconds: number): number[] {
    const offset = offsetAt(seconds);
    return [Math.max(0, Math.floor(offset / rowHeight)), Math.min(directory.entries.length, Math.ceil((offset + bodyHeight) / rowHeight))];
  }
  function pulseAt(seconds: number): number {
    let result = 0;
    for (const onset of music.onsets) {const age = seconds - onset.seconds; if (age >= 0 && age < .45) result = Math.max(result, Math.exp(-age * 12) * onset.strength);}
    return result;
  }
  function backdrop(ctx: CanvasRenderingContext2D, seconds: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
    gradient.addColorStop(0, '#091321'); gradient.addColorStop(.55, '#111e32'); gradient.addColorStop(1, '#091624');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1920, layoutHeight);
    const halo = ctx.createRadialGradient(1420, 480, 20, 1420, 480, 900);
    halo.addColorStop(0, 'rgba(54,108,197,.15)'); halo.addColorStop(1, 'rgba(54,108,197,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 1920, 1080);
    ctx.save(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(122,166,231,.10)';
    for (let line = -6; line < 7; line++) {
      const drift = Math.sin(seconds * .13) * 14;
      ctx.beginPath(); ctx.moveTo(960 + line * 55, -120);
      ctx.bezierCurveTo(870 + line * 18, 350 + drift, 1820 + line * 30, 640, 1390 + line * 64, 1230); ctx.stroke();
    }
    ctx.restore();
  }
  function kicker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
    ctx.font = '500 24px ' + font; ctx.fillStyle = '#a8bad4'; ctx.fillText(text, x, y);
  }
  function intro(ctx: CanvasRenderingContext2D, seconds: number): void {
    const appear = smooth((seconds + .15) / .75), shift = (1 - appear) * 20;
    ctx.save(); ctx.globalAlpha *= appear;
    kicker(ctx, 'OPENAI  /  MATH', 140, 136);
    ctx.fillStyle = '#f5f7fb'; ctx.font = '600 112px ' + font;
    ctx.fillText(storyboard.headline[0]!, 132, 445 + shift);
    ctx.fillText(storyboard.headline[1]!, 132, 585 + shift);
    ctx.fillStyle = '#6f9dff'; ctx.fillRect(140, 648, 78 + smooth(seconds / 1.2) * 94, 4);
    ctx.fillStyle = '#c1cede'; ctx.font = '400 30px ' + font;
    ctx.fillText('722 篇数学预印本  ·  372 个相关论文组', 140, 722);
    ctx.fillStyle = '#8bb3ff'; ctx.font = '400 25px ' + font;
    ctx.fillText('英文题名  /  中文速览', 140, 786);
    ctx.fillStyle = '#8bb3ff'; ctx.font = '700 278px ' + font;
    ctx.fillText('722', 1120, 589 + shift);
    kicker(ctx, 'PREPRINTS', 1144, 667);
    ctx.fillStyle = '#8194af'; ctx.font = '22px ' + font; ctx.fillText(storyboard.source_label, 140, 938);
    ctx.restore();
  }
  function folder(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#54aeff';
    ctx.beginPath(); ctx.roundRect(x, y + 4, 24, 19, 2.5); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, y, 12, 7, 2); ctx.fill();
  }
  function directoryScene(ctx: CanvasRenderingContext2D, seconds: number): void {
    const arrive = smooth((seconds - storyboard.intro_end + .18) / .7);
    ctx.save(); ctx.translate(0, (1 - arrive) * 26);
    ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = 38; ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 18); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.save(); ctx.beginPath(); ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 18); ctx.clip();
    const offset = offsetAt(seconds), [first, last] = visibleRange(seconds);
    ctx.save(); ctx.beginPath(); ctx.rect(panelX, panelY + headerHeight, panelWidth, bodyHeight); ctx.clip();
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f8faff'; ctx.fillRect(columnX, panelY + headerHeight, panelX + panelWidth - columnX, bodyHeight);
    const focus = Math.floor((offset + bodyHeight * .5) / rowHeight);
    for (let index = first!; index < last!; index++) {
      const y = panelY + headerHeight + index * rowHeight - offset;
      if (index === focus) {
        ctx.fillStyle = '#edf4ff'; ctx.fillRect(panelX, y, panelWidth, rowHeight);
        ctx.fillStyle = '#6a9ef4'; ctx.fillRect(panelX, y, 4, rowHeight);
      }
      folder(ctx, panelX + 22, y + 25);
      ctx.fillStyle = '#1f2328'; ctx.font = '20px ' + font;
      const title = names[index]!;
      title.forEach((line, lineIndex) => ctx.fillText(line, nameX, y + (title.length === 1 ? 45 : 31 + lineIndex * 27)));
      const note = notes.get(index);
      if (note) {
        ctx.fillStyle = index === focus ? '#1751a1' : '#24466f'; ctx.font = '600 25px ' + font;
        ctx.fillText(note.topic_zh, noteX, y + 30);
        ctx.fillStyle = '#626e7e'; ctx.font = '21px ' + font;
        ctx.fillText(note.explanation_zh, noteX, y + 57);
      }
      ctx.strokeStyle = '#d1d9e0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(panelX, y + rowHeight - .5); ctx.lineTo(panelX + panelWidth, y + rowHeight - .5); ctx.stroke();
    }
    ctx.strokeStyle = '#dbe2ec'; ctx.beginPath(); ctx.moveTo(columnX, panelY + headerHeight); ctx.lineTo(columnX, panelY + panelHeight); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#f6f8fa'; ctx.fillRect(panelX, panelY, panelWidth, headerHeight);
    ctx.font = '600 27px ' + font;
    ctx.fillStyle = '#0969da'; ctx.fillText('openai', panelX + 25, panelY + 44);
    ctx.fillStyle = '#59636e'; ctx.fillText('/', panelX + 125, panelY + 44);
    ctx.fillStyle = '#0969da'; ctx.fillText('math', panelX + 152, panelY + 44);
    ctx.fillStyle = '#59636e'; ctx.fillText('/', panelX + 235, panelY + 44);
    ctx.fillStyle = '#1f2328'; ctx.fillText('preprints', panelX + 263, panelY + 44);
    ctx.textAlign = 'right'; ctx.font = '22px ' + font; ctx.fillStyle = '#59636e';
    ctx.fillText('722 directories', panelX + panelWidth - 26, panelY + 43); ctx.textAlign = 'left';
    ctx.fillStyle = '#727e8d'; ctx.font = '500 19px ' + font; ctx.fillText('原始英文目录', nameX, panelY + 87);
    ctx.fillStyle = '#3f628d'; ctx.fillText('中文速览', noteX, panelY + 87);
    ctx.textAlign = 'right'; ctx.font = '18px ' + font; ctx.fillStyle = '#7d8795';
    ctx.fillText('研究内容简释', panelX + panelWidth - 26, panelY + 87); ctx.textAlign = 'left';
    ctx.strokeStyle = '#d1d9e0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(panelX, panelY + headerHeight - .5); ctx.lineTo(panelX + panelWidth, panelY + headerHeight - .5); ctx.stroke();
    ctx.restore();
    const progress = clamp(offset / maximumOffset), count = Math.min(722, Math.max(1, last!));
    ctx.fillStyle = '#41516b'; ctx.fillRect(panelX, 1034, panelWidth, 3);
    ctx.fillStyle = '#86afff'; ctx.fillRect(panelX, 1034, panelWidth * progress, 3);
    kicker(ctx, 'OPENAI  /  MATH  /  PREPRINTS', panelX, 1000);
    ctx.textAlign = 'right'; ctx.fillStyle = '#f5f7fb'; ctx.font = '500 36px ' + font;
    ctx.fillText(String(count).padStart(3, '0') + ' / 722', panelX + panelWidth, 1000); ctx.textAlign = 'left';
    const pulse = pulseAt(seconds);
    ctx.strokeStyle = 'rgba(122,166,231,' + (.11 + pulse * .16) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(panelX - 1, panelY - 1, panelWidth + 2, panelHeight + 2, 19); ctx.stroke();
    ctx.restore();
  }
  function outro(ctx: CanvasRenderingContext2D, seconds: number): void {
    const arrive = smooth((seconds - storyboard.outro_start + .15) / .85);
    ctx.save(); ctx.textAlign = 'center'; ctx.globalAlpha *= arrive;
    ctx.font = '500 24px ' + font; ctx.fillStyle = '#a8bad4'; ctx.fillText('OPENAI  /  MATH', 960, 146);
    ctx.font = '700 260px ' + font; ctx.fillStyle = '#8bb3ff'; ctx.fillText('722', 960, 485 + (1 - arrive) * 20);
    ctx.font = '500 52px ' + font; ctx.fillStyle = '#f5f7fb'; ctx.fillText('篇数学预印本', 960, 591);
    ctx.fillStyle = '#82a9eb'; ctx.fillRect(914, 650, 92, 3);
    ctx.font = '400 40px ' + font; ctx.fillStyle = '#dce5f3'; ctx.fillText(storyboard.closing, 960, 750);
    ctx.font = '24px ' + font; ctx.fillStyle = '#a8bad4'; ctx.fillText(storyboard.source_label, 960, 918);
    ctx.font = '21px ' + font; ctx.fillStyle = '#91a0b4'; ctx.fillText('预印本合集 · 验证状态各异', 960, 970);
    ctx.restore();
  }
  function drawSample(seconds: number): void {
    const ctx = sampleCtx;
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    backdrop(ctx, seconds);
    const introMix = smooth((seconds - storyboard.intro_end + .32) / .65);
    const outroMix = smooth((seconds - storyboard.outro_start + .32) / .65);
    if (introMix < 1) {ctx.save(); ctx.globalAlpha = 1 - introMix; intro(ctx, seconds); ctx.restore();}
    if (introMix > 0 && outroMix < 1) {ctx.save(); ctx.globalAlpha = introMix * (1 - outroMix); directoryScene(ctx, seconds); ctx.restore();}
    if (outroMix > 0) {ctx.save(); ctx.globalAlpha = outroMix; outro(ctx, seconds); ctx.restore();}
  }
  window.renderFrame = (seconds, variant, capture = true) => {
    if (!manifest.variants.some(v => v.id === variant)) throw Error('Unknown variant');
    const {samples, shutter} = manifest.settings.sampling;
    for (let index = 0; index < samples; index++) {
      const t = Math.max(0, Math.min(duration, seconds + ((index + .5) / samples - .5) * shutter / fps));
      drawSample(t); frameCtx.globalAlpha = 1 / (index + 1); frameCtx.drawImage(sampleCanvas, 0, 0);
    }
    frameCtx.globalAlpha = 1; texture.needsUpdate = true; renderer.render(scene, camera);
    return capture ? canvas.toDataURL('image/jpeg', .97).split(',')[1]! : null;
  };
  window.streamFrames = async options => {
    const ws = new WebSocket(options.ws); let acknowledged = 0;
    ws.onmessage = e => {if (typeof e.data === 'string') acknowledged = Number(e.data);};
    await new Promise<void>((resolve, reject) => {ws.onopen = () => resolve(); ws.onerror = () => reject(Error('Frame socket unavailable'));});
    const gl = renderer.getContext(), buffer = new Uint8Array(width * height * 4);
    const start = Math.round(options.from * options.fps), end = Math.round(options.to * options.fps);
    for (let index = start; index < end; index++) {
      while (index - start - acknowledged >= (options.inflight ?? 2)) {
        if (ws.readyState !== WebSocket.OPEN) throw Error('Frame socket closed');
        await new Promise(resolve => setTimeout(resolve, 2));
      }
      window.renderFrame(index / options.fps, options.variant, false);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer); ws.send(buffer);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    while (acknowledged < end - start || ws.bufferedAmount > 0) {
      if (ws.readyState !== WebSocket.OPEN) throw Error('Frame socket closed before acknowledgement');
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    ws.close();
  };

  const play = document.querySelector<HTMLButtonElement>('#play')!, seek = document.querySelector<HTMLInputElement>('#seek')!;
  const timeLabel = document.querySelector<HTMLElement>('#time')!, variant = manifest.variants[0]!.id;
  const format = (seconds: number) => Math.floor(seconds/60).toString().padStart(2, '0') + ':' + Math.floor(seconds%60).toString().padStart(2, '0');
  let time = Math.max(0, Math.min(duration, Number(params.get('t') ?? 0))), playing = false, lastTime = performance.now();
  seek.max = String(duration);
  function update(): void {
    window.renderFrame(time, variant, false); seek.value = String(time);
    timeLabel.textContent = format(time) + ' / ' + format(duration);
    play.textContent = playing ? '暂停预览' : '播放预览';
  }
  play.addEventListener('click', () => {if (time >= duration) time = 0; playing = !playing; lastTime = performance.now(); update();});
  seek.addEventListener('input', () => {time = Number(seek.value); lastTime = performance.now(); update();});
  window.scrollPreview = {duration, count: directory.entries.length, ref: directory.ref,
    seek: seconds => {time = Math.max(0, Math.min(duration, seconds)); lastTime = performance.now(); update();},
    state: () => ({time, offset: offsetAt(time), playing, scene: time < storyboard.intro_end ? 'intro' : time < storyboard.outro_start ? 'directory' : 'outro', visibleRange: visibleRange(time)})};
  update();
  if (!exportMode) {
    const animate = (now: number) => {
      if (playing) {time = Math.min(duration, time + (now - lastTime) / 1000); if (time >= duration) playing = false; update();}
      lastTime = now; requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
})();
