import * as THREE from 'three';

type Entry = {name: string; path: string; url: string; tree_sha: string};
type Directory = {source_id: string; ref: string; directory_count: number; commit_message: string; entries: Entry[]};
type Manifest = {settings: {width: number; height: number; fps: number; duration_seconds: number | null; sampling: {samples: number; shutter: number}}; variants: {id: string}[]};
type StreamOptions = {ws: string; from: number; to: number; fps: number; variant: string; inflight?: number};
declare global {interface Window {
  ready: Promise<void>;
  renderFrame: (seconds: number, variant: string, capture?: boolean) => string | null;
  streamFrames: (options: StreamOptions) => Promise<void>;
  scrollPreview: {duration: number; count: number; ref: string; seek: (seconds: number) => void; state: () => {time: number; offset: number; playing: boolean}};
}}

const canvas = document.querySelector('canvas')!;
const params = new URLSearchParams(location.search);
const exportMode = params.get('export') === '1';
if (exportMode) document.body.classList.add('export');
window.ready = (async () => {
  const [manifest, directory] = await Promise.all([
    fetch('../manifest.json').then(r => r.json()) as Promise<Manifest>,
    fetch('../data/directory.json').then(r => r.json()) as Promise<Directory>,
  ]);
  if (!directory.entries.length || directory.entries.length !== directory.directory_count) throw Error('Directory snapshot is incomplete');
  const {width, height, fps} = manifest.settings;
  const duration = manifest.settings.duration_seconds ?? 180;
  const scale = width / 1920, layoutHeight = height / scale;
  const headerHeight = 72, rowHeight = 72, commitX = 1380, nameX = 69;
  const nameWidth = commitX - nameX - 40, bodyHeight = layoutHeight - headerHeight;
  const maximumOffset = Math.max(0, directory.entries.length * rowHeight - bodyHeight);
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
  sampleCtx.font = '24px ' + font;
  const names = directory.entries.map(entry => {
    if (sampleCtx.measureText(entry.name).width <= nameWidth) return entry.name;
    let low = 0, high = entry.name.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (sampleCtx.measureText(entry.name.slice(0, middle) + '…').width <= nameWidth) low = middle;
      else high = middle - 1;
    }
    return entry.name.slice(0, low) + '…';
  });

  function offsetAt(seconds: number): number {
    const hold = Math.min(2, duration / 8), travel = Math.max(.001, duration - 2 * hold);
    const ramp = Math.min(1.5, travel / 4), elapsed = Math.max(0, Math.min(travel, seconds - hold));
    const velocity = maximumOffset / (travel - ramp);
    if (elapsed < ramp) return velocity * elapsed * elapsed / (2 * ramp);
    if (elapsed > travel - ramp) {
      const remaining = travel - elapsed;
      return maximumOffset - velocity * remaining * remaining / (2 * ramp);
    }
    return velocity * (elapsed - ramp / 2);
  }
  function folder(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#54aeff';
    ctx.beginPath(); ctx.roundRect(x, y + 4, 29, 24, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, y, 14, 9, 2); ctx.fill();
  }
  function drawSample(seconds: number): void {
    const ctx = sampleCtx;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1920, layoutHeight);
    const offset = offsetAt(seconds);
    const first = Math.max(0, Math.floor(offset / rowHeight));
    const last = Math.min(directory.entries.length, Math.ceil((offset + bodyHeight) / rowHeight));
    ctx.save(); ctx.beginPath(); ctx.rect(0, headerHeight, 1920, bodyHeight); ctx.clip();
    ctx.font = '24px ' + font; ctx.textBaseline = 'alphabetic';
    for (let index = first; index < last; index++) {
      const y = headerHeight + index * rowHeight - offset;
      folder(ctx, 23, y + 22);
      ctx.fillStyle = '#1f2328'; ctx.fillText(names[index]!, nameX, y + 46);
      ctx.fillStyle = '#59636e'; ctx.fillText(directory.commit_message, commitX, y + 46);
      ctx.strokeStyle = '#d1d9e0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + rowHeight - .5); ctx.lineTo(1920, y + rowHeight - .5); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#f6f8fa'; ctx.fillRect(0, 0, 1920, headerHeight);
    ctx.font = '600 26px ' + font;
    ctx.fillStyle = '#0969da'; ctx.fillText('math', 23, 46);
    ctx.fillStyle = '#59636e'; ctx.fillText('/', 97, 46);
    ctx.fillStyle = '#1f2328'; ctx.fillText('preprints', 118, 46);
    ctx.fillStyle = '#59636e'; ctx.fillText('/', 245, 46);
    ctx.strokeStyle = '#59636e'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(294, 25, 17, 19, 2); ctx.roundRect(302, 19, 17, 19, 2); ctx.stroke();
    ctx.strokeStyle = '#d1d9e0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, headerHeight - .5); ctx.lineTo(1920, headerHeight - .5); ctx.stroke();
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
    play.textContent = playing ? '暂停滚动' : '播放滚动';
  }
  play.addEventListener('click', () => {if (time >= duration) time = 0; playing = !playing; lastTime = performance.now(); update();});
  seek.addEventListener('input', () => {time = Number(seek.value); lastTime = performance.now(); update();});
  window.scrollPreview = {duration, count: directory.entries.length, ref: directory.ref,
    seek: seconds => {time = Math.max(0, Math.min(duration, seconds)); lastTime = performance.now(); update();},
    state: () => ({time, offset: offsetAt(time), playing})};
  update();
  if (!exportMode) {
    const animate = (now: number) => {
      if (playing) {time = Math.min(duration, time + (now - lastTime) / 1000); if (time >= duration) playing = false; update();}
      lastTime = now; requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
})();
