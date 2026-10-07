"""Acquire the explicitly selected public AAC stream and derive full 1.25x audio.

Public stream URLs remain in memory only. No cookies, browser state or credentials.
"""
import datetime
import hashlib
import json
import re
import subprocess
import time
import urllib.request
from pathlib import Path

VERSION = Path(__file__).resolve().parents[1]
PROJECT = VERSION.parents[1]
BVID = 'BV1cFG76nExW'
CANONICAL = 'https://www.bilibili.com/video/' + BVID + '/'
HEADERS = {'User-Agent': 'Mozilla/5.0', 'Referer': CANONICAL}
ORIGINAL = PROJECT / 'sources/audio/MATH_001_BGM_ORIGINAL_v001.m4a'
DERIVED = VERSION / 'audio/MATH_001_BGM_SPEED125_v001.1.m4a'
RECEIPT = VERSION / 'provenance/audio-intake-and-speed125.json'

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def api(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=45) as response:
        payload = json.load(response)
    if payload.get('code') != 0:
        raise RuntimeError('Public API returned code ' + str(payload.get('code')))
    return payload['data']

def sha(path):
    with path.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256')
    return digest.hexdigest()

def probe(path):
    data = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
    audio = next(stream for stream in data['streams'] if stream['codec_type'] == 'audio')
    return {'codec': audio['codec_name'], 'sample_rate': int(audio['sample_rate']), 'channels': audio['channels'], 'duration_seconds': float(audio['duration']), 'size_bytes': path.stat().st_size, 'sha256': sha(path)}

ORIGINAL.parent.mkdir(parents=True, exist_ok=True)
DERIVED.parent.mkdir(parents=True, exist_ok=True)
RECEIPT.parent.mkdir(parents=True, exist_ok=True)
record = {'schema_version': 1, 'project_id': 'MATH_001', 'version': 'v001.1', 'purpose': 'authorized-audio-intake-and-speed-change', 'started_at': now(), 'status': 'preparing', 'source_url': CANONICAL, 'bvid': BVID, 'user_instruction': '使用这里的音频，然后加速1.25倍。', 'processing': {'filter': 'atempo=1.25', 'speed': 1.25, 'preserve_pitch': True, 'trim': None, 'encoder': 'AAC 192 kbps'}, 'rights': {'status': 'TBD'}, 'network_chunks': []}

def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')

save()
try:
    if ORIGINAL.exists() or DERIVED.exists():
        raise RuntimeError('Input or derived audio already exists; do not overwrite')
    metadata = api('https://api.bilibili.com/x/web-interface/view?bvid=' + BVID)
    if len(metadata.get('pages', [])) != 1:
        raise RuntimeError('Selected source needs an explicit page identity')
    record['source_metadata'] = {key: metadata.get(key) for key in ['bvid', 'cid', 'title', 'duration', 'pubdate', 'desc']}
    record['source_metadata']['uploader_name'] = metadata.get('owner', {}).get('name', 'TBD')
    play = api('https://api.bilibili.com/x/player/playurl?bvid=' + BVID + '&cid=' + str(metadata['cid']) + '&fnval=16&qn=80&fourk=1')
    choices = [audio for audio in play.get('dash', {}).get('audio', []) if audio.get('mimeType', audio.get('mime_type')) == 'audio/mp4' and str(audio.get('codecs', '')).startswith('mp4a')]
    if not choices:
        raise RuntimeError('No publicly available AAC stream in selected source')
    audio = max(choices, key=lambda item: item.get('bandwidth', 0))
    record['public_stream'] = {key: audio.get(key) for key in ['id', 'bandwidth', 'codecs', 'mimeType']}
    stream_url = audio.get('baseUrl', audio.get('base_url'))
    request = urllib.request.Request(stream_url, headers={**HEADERS, 'Range': 'bytes=0-0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        first = response.read()
        status = response.status
        content_range = response.headers.get('Content-Range', '')
        content_length = response.headers.get('Content-Length')
    if status == 200:
        if content_length and len(first) != int(content_length):
            raise RuntimeError('Full public response is truncated')
        with ORIGINAL.open('xb') as target:
            target.write(first)
        total = len(first)
        record['network_chunks'].append({'status': status, 'received': total, 'complete_response': True})
    else:
        match = re.fullmatch(r'bytes 0-0/(\d+)', content_range)
        if status != 206 or not match or len(first) != 1:
            raise RuntimeError('Public source did not provide a valid byte-range identity')
        total = int(match[1])
        with ORIGINAL.open('xb') as target:
            for start in range(0, total, 2 * 1024 * 1024):
                end = min(total - 1, start + 2 * 1024 * 1024 - 1)
                chunk = None
                for attempt in range(1, 3):
                    try:
                        req = urllib.request.Request(stream_url, headers={**HEADERS, 'Range': 'bytes=' + str(start) + '-' + str(end)})
                        with urllib.request.urlopen(req, timeout=60) as response:
                            received_range = response.headers.get('Content-Range', '')
                            received_status = response.status
                            body = response.read()
                        if received_status != 206 or received_range != 'bytes ' + str(start) + '-' + str(end) + '/' + str(total) or len(body) != end - start + 1:
                            raise RuntimeError('Public byte range is incomplete')
                        chunk = body
                        record['network_chunks'].append({'from': start, 'to': end, 'total': total, 'received': len(body), 'status': received_status, 'attempt': attempt})
                        break
                    except Exception:
                        if attempt == 2:
                            raise RuntimeError('Public audio range download failed or remained incomplete')
                        time.sleep(1)
                target.write(chunk)
                print('Audio download ' + str(round((end + 1) / total * 100)) + '%', flush=True)
    if ORIGINAL.stat().st_size != total:
        raise RuntimeError('Downloaded source byte count mismatch')
    record['original'] = {**probe(ORIGINAL), 'path': str(ORIGINAL.relative_to(PROJECT))}
    if record['original']['codec'] != 'aac':
        raise RuntimeError('Selected source is not AAC')
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(ORIGINAL), '-map', '0:a:0', '-f', 'null', '-'], check=True)
    record['original']['full_decode'] = 'passed'
    record['tools'] = {'ffmpeg': subprocess.check_output(['ffmpeg', '-version'], text=True).splitlines()[0]}
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-n', '-i', str(ORIGINAL), '-map', '0:a:0', '-vn', '-af', 'atempo=1.25', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(DERIVED)]
    subprocess.run(command, check=True)
    record['derived'] = {**probe(DERIVED), 'path': str(DERIVED.relative_to(PROJECT))}
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(DERIVED), '-map', '0:a:0', '-f', 'null', '-'], check=True)
    record['derived']['full_decode'] = 'passed'
    expected = record['original']['duration_seconds'] / 1.25
    record['expected_duration_seconds'] = expected
    record['duration_difference_seconds'] = record['derived']['duration_seconds'] - expected
    if abs(record['duration_difference_seconds']) > .1:
        raise RuntimeError('Derived duration does not match the full 1.25x source')
    record['status'] = 'completed'
    record['finished_at'] = now()
    save()
    print(json.dumps({'title': record['source_metadata']['title'], 'original': record['original'], 'derived': record['derived'], 'speed': 1.25}, ensure_ascii=False), flush=True)
except Exception as error:
    record['status'] = 'failed'
    record['error'] = re.sub(r'https?://\S+', '[URL omitted]', str(error))
    record['finished_at'] = now()
    save()
    raise RuntimeError(record['error']) from None
