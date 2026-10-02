"""Include an independent karaoke lead-vocal alignment in confidence scoring."""
import common
import align
if not (common.KARAOKE / 'lead.wav').is_file():
    raise RuntimeError('Lead-vocal alignment requires an actual separated karaoke stem')
align.ALTS = align.ALTS + ('fused_lead',)
align.NOTES += ' Independent mel-band-roformer karaoke lead-vocal CTC cross-check included.'
align.main(plots=True)
