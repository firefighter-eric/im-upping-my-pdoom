"""Optional lead-vocal karaoke model, separate from the Demucs four-stem pass."""
import common
import os
from audio_separator.separator import Separator
model = os.environ.get('VIDEO_LEAD_MODEL')
if not model:
    raise SystemExit('Provide --lead-model with an explicit compatible karaoke model filename')
common.KARAOKE.mkdir(parents=True, exist_ok=False)
separator = Separator(output_dir=str(common.KARAOKE), model_file_dir=str(common.CACHE/'separator'),
                      output_format='WAV', output_single_stem='Vocals', use_autocast=False)
separator.load_model(model_filename=model)
files = separator.separate(str(common.AUDIO))
if len(files) != 1:
    raise RuntimeError('Expected one explicit lead-vocal stem')
(common.KARAOKE / files[0]).rename(common.KARAOKE / 'lead.wav')
