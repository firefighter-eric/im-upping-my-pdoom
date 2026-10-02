import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';
import type { TimelineEntry } from './engine/engine';
export function makeTimeline(_lyrics: Lyrics, audio: AudioData): TimelineEntry[] {
 return [{id:'probability-park',start:0,end:Math.ceil(audio.duration*30)/30+.05,params:{},load:()=>import('./scenes/probability-park'),post:{hud:0,frame:0,pdoom:0}}];
}
