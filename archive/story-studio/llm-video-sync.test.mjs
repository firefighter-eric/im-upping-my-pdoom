import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createFixture } from './helpers.mjs';

test('LLM references publish playable media URLs and retain unavailable audio metadata', async (t) => {
  const fixture = await createFixture(t);
  const directory = '02_library/llm-video-references/LLMV_900_fixture';
  const metadata = {
    id: 'LLMV_900', title: '代码视频参考', status: 'review', version: 'v001',
    source_url: 'https://www.bilibili.com/video/example/', rights: { status: 'TBD' },
    video: { id: 'LLMV_900_SOURCE', label: '原片', path: 'references/video.mp4', duration_seconds: 12, codec: 'h264', sha256: 'a'.repeat(64) },
    audio: [{ id: 'LLMV_900_AUDIO_001', label: '音轨', path: 'audio/missing.wav', duration_seconds: 12, codec: 'pcm_s16le', sha256: 'b'.repeat(64) }],
    generations: [{ id: 'LLMV_900_MV_001', label: '科幻抽象版', path: 'generations/mv.mp4', duration_seconds: 12,
      codec: 'h264', sha256: 'c'.repeat(64), status: 'review', version: 'v001', description: '原创代码画面',
      width: 1920, height: 1080, frame_rate: '24/1', known_issues: ['待人工确认'], poster: 'analysis/mv.jpg' }],
  };
  await fixture.write(`${directory}/asset.yaml`, metadata);
  await fixture.write(`${directory}/references/video.mp4`, 'fixture media');
  await fixture.write(`${directory}/generations/mv.mp4`, 'fixture candidate');
  await fixture.write(`${directory}/analysis/mv.jpg`, 'fixture poster');
  const result = await fixture.run();
  assert.equal(result.code, 0, result.stderr);
  const index = JSON.parse(await readFile(path.join(fixture.app, 'src/generated/catalog-index.json'), 'utf8'));
  const reference = JSON.parse(await readFile(path.join(fixture.app, 'public', index.details.LLMV_900), 'utf8'));
  assert.equal(reference.id, 'LLMV_900');
  assert.match(reference.video.src, /^\/content\/llm-video-references\/LLMV_900\//);
  assert.equal(await readFile(path.join(fixture.app, 'public', reference.video.src), 'utf8'), 'fixture media');
  assert.equal(reference.audio[0].src, null);
  assert.match(reference.audio[0].sourcePath, /missing.wav$/);
  assert.equal(reference.rightsStatus, 'TBD');
  assert.equal(reference.generations[0].id, 'LLMV_900_MV_001');
  assert.equal(reference.generations[0].status, 'review');
  assert.deepEqual(reference.generations[0].knownIssues, ['待人工确认']);
  assert.equal(await readFile(path.join(fixture.app, 'public', reference.generations[0].src), 'utf8'), 'fixture candidate');
  assert.equal(await readFile(path.join(fixture.app, 'public', reference.generations[0].poster), 'utf8'), 'fixture poster');
  await fixture.write(`${directory}/asset.yaml`, { ...metadata, generations: [{ ...metadata.generations[0], path: '../../escape.mp4' }] });
  assert.equal((await fixture.run()).code, 1);
  assert.deepEqual(JSON.parse(await readFile(path.join(fixture.app, 'src/generated/catalog-index.json'), 'utf8')), index);
  await fixture.write(`${directory}/asset.yaml`, { ...metadata, video: { ...metadata.video, path: '../../escape.mp4' } });
  assert.equal((await fixture.run()).code, 1);
  assert.deepEqual(JSON.parse(await readFile(path.join(fixture.app, 'src/generated/catalog-index.json'), 'utf8')), index);
});
