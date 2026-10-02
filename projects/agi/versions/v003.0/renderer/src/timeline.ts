import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';
import type { TimelineEntry } from './engine/engine';

// Chapter cuts use this input's analysed downbeats; word events retain vocal timing.
export function makeTimeline(_lyrics: Lyrics, audio: AudioData): TimelineEntry[] {
  const chapters: [string, string, number][] = [
    ['germination','seed',0],['cultivation','culture',22.056],
    ['mutation','mutation',38.418],['extraction','factory',58.417],
    ['deviation','turn',74.780],['replication','clips',94.779],
    ['escape','breach',109.324],['afterimage','outro',132.050],
  ];
  const nearestDownbeat=(t:number)=>audio.downbeats.reduce((a,b)=>Math.abs(b-t)<Math.abs(a-t)?b:a,audio.downbeats[0]??t);
  return chapters.map(([id,mode,start],i)=>({id,params:{mode},
    start:i?nearestDownbeat(start):0,
    end:i<chapters.length-1?nearestDownbeat(chapters[i+1]![2]):Math.ceil(audio.duration*30)/30+.1,
    load:()=>import('./scenes/greenhouse'),post:{hud:0,frame:0,pdoom:0},
  }));
}
