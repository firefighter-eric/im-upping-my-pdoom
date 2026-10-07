"""Make a full 58-second edit from the latest selected 1.25x candidate.

All existing originals/edits remain immutable. Excerpt selection and low-frequency
onsets are automatic analysis, not proof of a chorus or human listening approval.
"""
import array
import datetime
import hashlib
import json
import math
import statistics
import subprocess
import sys
from pathlib import Path

VERSION = Path(__file__).resolve().parents[1]
PROJECT = VERSION.parents[1]
INPUT = PROJECT / 'versions/v001.3/audio/MATH_001_BGM_003_SPEED125_v001.3.m4a'
EXPECTED = '0a94710b98f1a80d8c121d809f6cfb488dfb5a7eab182933c6f03b06e49e6abc'
OUTPUT = VERSION / 'audio/MATH_001_V002_R000_BGM_CLIP58.m4a'
RECEIPT = VERSION / 'provenance/audio-edit-58.json'
DURATION = 58.0
HZ = 100

def sha(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def envelope(band=False):
    cmd = ['ffmpeg', '-v', 'error', '-i', str(INPUT), '-map', '0:a:0']
    if band:
        cmd += ['-af', 'highpass=f=40,lowpass=f=180']
    cmd += ['-ac', '1', '-ar', '8000', '-f', 's16le', '-']
    raw = subprocess.check_output(cmd)
    samples = array.array('h')
    samples.frombytes(raw)
    if sys.byteorder != 'little':
        samples.byteswap()
    result = []
    for index in range(0, len(samples), 80):
        values = samples[index:index + 80]
        result.append(math.sqrt(sum(value * value for value in values) / len(values)) / 32768)
    return result

record = {'schema_version': 1, 'project_id': 'MATH_001', 'version': 'v002.0',
          'started_at': now(), 'status': 'preparing',
          'request': '一分钟以内，加入片头片尾，做精美的配乐目录视频。',
          'input': {'path': str(INPUT.relative_to(PROJECT)), 'sha256': EXPECTED},
          'selection': 'Latest third candidate at the previously requested 1.25x speed.',
          'originals_retention': 'all three full originals and both prior speed edits unchanged',
          'human_audio_review': 'pending', 'rights': {'status': 'TBD'}}
RECEIPT.parent.mkdir(parents=True, exist_ok=True)

def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')

save()
try:
    if sha(INPUT) != EXPECTED:
        raise RuntimeError('Selected audio input changed')
    if OUTPUT.exists():
        raise RuntimeError('58-second edit already exists; do not overwrite')
    full, bass = envelope(), envelope(True)
    # Detect positive low-frequency energy rises, using a short rolling baseline.
    rise = [max(0.0, bass[i] - sum(bass[max(0, i - 8):i]) / max(1, min(8, i)))
            for i in range(len(bass))]
    threshold = statistics.mean(rise) + 1.1 * statistics.pstdev(rise)
    peaks = []
    for i in range(8, len(rise) - 4):
        if rise[i] > threshold and rise[i] == max(rise[i - 4:i + 5]):
            if peaks and i - peaks[-1] < 22:
                if rise[i] > rise[peaks[-1]]:
                    peaks[-1] = i
            else:
                peaks.append(i)
    # Restrict this edit to an early region of the two-song upload. We make no
    # unverified claim that its boundaries match lyrics, verses or the chorus.
    candidates = [i for i in peaks if 15 <= i / HZ <= 75 and i + 5800 < len(full)]
    if not candidates:
        raise RuntimeError('No reliable onset-aligned excerpt start in planned search region')
    prefix = [0.0]
    for value in full:
        prefix.append(prefix[-1] + value)
    score = lambda i: (prefix[i + 5800] - prefix[i]) / 5800 + 0.3 * rise[i]
    start_i = max(candidates, key=score)
    start = start_i / HZ
    edited = full[start_i:start_i + 5800]
    peak_scale = max(edited) or 1.0
    onsets = [{'id': 'LF_' + str(n).zfill(4), 'seconds': round((i - start_i) / HZ, 4),
               'strength': round(rise[i] / max(rise), 5), 'verification': 'automatic-candidate'}
              for n, i in enumerate(peaks) if start_i <= i < start_i + 5800]
    def anchor(target):
        return min(onsets, key=lambda event: abs(event['seconds'] - target))
    intro_anchor, outro_anchor = anchor(3.0), anchor(53.0)
    intro_end = intro_anchor['seconds'] if abs(intro_anchor['seconds'] - 3) <= .3 else 3.0
    outro_start = outro_anchor['seconds'] if abs(outro_anchor['seconds'] - 53) <= .3 else 53.0
    features = {'schema_version': 1, 'project_id': 'MATH_001', 'version': 'v002.0',
                'duration_seconds': DURATION, 'sample_hz': HZ, 'analysis_to_audio_offset_seconds': 0,
                'audio_to_video_offset_seconds': 0, 'method': 'RMS and positive 40-180 Hz energy rises',
                'human_listening': 'pending', 'bpm': 'TBD',
                'lyric_sync': 'not-applicable: user chose directory visuals without lyric subtitles',
                'envelope': [round(v / peak_scale, 5) for v in edited], 'onsets': onsets,
                'scene_anchors': {'directory_enter': intro_anchor, 'directory_complete': outro_anchor}}
    (VERSION / 'data/music-features.json').write_text(json.dumps(features, ensure_ascii=False, indent=2) + '\n')
    storyboard = {'schema_version': 1, 'project_id': 'MATH_001', 'version': 'v002.0',
                  'duration_seconds': DURATION, 'seed': 722,
                  'intro_end': intro_end, 'outro_start': outro_start,
                  'source_count': 722, 'family_count': 372,
                  'headline': ['误闯', '数学天家'], 'closing': '数学的边界，还在延伸。',
                  'source_label': 'github.com/openai/math',
                  'scenes': [
                      {'id': 'S01', 'start': 0, 'end': intro_end, 'action': 'Ink-blue title and large 722, restrained mathematical linework.', 'anchor': intro_anchor['id']},
                      {'id': 'S02', 'start': intro_end, 'end': outro_start, 'action': 'All 722 real GitHub directory entries scroll in preserved API order; stable header, progress and count.', 'anchor': intro_anchor['id']},
                      {'id': 'S03', 'start': outro_start, 'end': DURATION, 'action': 'Return to 722, show preprints label and source; music fades to close.', 'anchor': outro_anchor['id']}],
                  'human_copy_approval': 'pending', 'music_anchor_validation': 'automatic-candidates; audible review pending'}
    (VERSION / 'data/storyboard.json').write_text(json.dumps(storyboard, ensure_ascii=False, indent=2) + '\n')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fade = 'atrim=start=' + str(start) + ':duration=58,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.12,afade=t=out:st=56.5:d=1.5'
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-n', '-i', str(INPUT), '-map', '0:a:0',
           '-vn', '-af', fade, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(OUTPUT)]
    subprocess.run(cmd, check=True)
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(OUTPUT)]))
    audio = next(stream for stream in probe['streams'] if stream['codec_type'] == 'audio')
    actual = float(audio['duration'])
    if abs(actual - DURATION) >= 1 / 30:
        raise RuntimeError('Edited audio duration differs from the 58-second plan')
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(OUTPUT), '-f', 'null', '-'], check=True)
    record.update({'status': 'completed', 'finished_at': now(),
                   'executed_script': {'path': str(Path(__file__).relative_to(VERSION)), 'sha256': sha(Path(__file__))},
                   'excerpt_start_seconds': start, 'excerpt_end_seconds': start + DURATION,
                   'excerpt_clock': 'seconds in the third, already 1.25x, candidate',
                   'processing': {'filter': fade, 'additional_speed_change': None, 'preserve_pitch': True,
                                  'duration_seconds': DURATION, 'encoder': 'AAC 192 kbps'},
                   'output': {'path': str(OUTPUT.relative_to(PROJECT)), 'sha256': sha(OUTPUT), 'size_bytes': OUTPUT.stat().st_size,
                              'duration_seconds': actual, 'codec': audio['codec_name'], 'sample_rate': int(audio['sample_rate']),
                              'channels': audio['channels'], 'full_decode': 'passed'},
                   'tools': {'ffmpeg': subprocess.check_output(['ffmpeg', '-version'], text=True).splitlines()[0]},
                   'data_hashes': {name: sha(VERSION / 'data' / name) for name in ['music-features.json', 'storyboard.json']}})
    save()
    print(json.dumps({'excerpt_start': start, 'duration': actual, 'intro_end': intro_end,
                      'outro_start': outro_start, 'onsets': len(onsets), 'output': record['output']}, ensure_ascii=False))
except Exception as error:
    record.update({'status': 'failed', 'finished_at': now(), 'error': str(error)})
    save()
    raise
