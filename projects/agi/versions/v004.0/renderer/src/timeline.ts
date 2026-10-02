import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';
import type { TimelineEntry } from './engine/engine';
// A stateless director keeps matching objects across shots; the 46 exact lyric
// windows and their transitions are selected inside the director from the bound script.
export function makeTimeline(_lyrics: Lyrics, audio: AudioData): TimelineEntry[] {
 return [{id:'control-theatre',start:0,end:Math.ceil(audio.duration*30)/30+.05,
  params:{},load:()=>import('./scenes/control-theatre'),post:{hud:0,frame:0,pdoom:0}}];
}
