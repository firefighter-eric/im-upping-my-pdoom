type Line = {line_number:number;en_proposed:string;zh_proposed:string;start_seconds:number;end_seconds:number;card_id:string};
type Note = {id:string;heading:string;body:string};
type Cue = {event_id:number;card_id:string;start:number;end:number;en:string;zh:string;line_numbers:number[]};
type Layout = {height:number;en:string[];zh:string[];heading:string[];body:string[];y:number;layer:HTMLCanvasElement};
type Emphasis = {en:string[];zh:string[];body?:string[]};
type HighlightMap = {lines:(Emphasis&{line_number:number})[];cards:(Emphasis&{id:string})[]};
type Span = {start:number;end:number;term:string};
declare global { interface Window {
  ready:Promise<void>;
  renderFrame:(seconds:number,variant?:string,includeSource?:boolean)=>Promise<string>;
  drawFrame:(seconds:number)=>void;
  getLayoutReport:()=>unknown;
  getFrameState:(seconds:number)=>unknown;
  getHighlightReport:()=>unknown;
} }

const canvas=document.querySelector<HTMLCanvasElement>('#stage')!;
const ctx=canvas.getContext('2d',{alpha:false})!;
const W=1920,H=1080,S=2,DURATION=156.650667,VIDEO_DURATION=9400/60;
const BG='#101012',FG='#f0ede7',MUTED='#d0cac1',ORANGE='#ff792b';
const FONT='"Noto SC"',EN='"Archivo", "Noto SC"';
const R={x:1378,w:494,top:104,bottom:1048,rail:1342,gap:34};
const PROGRESS={x:0,y:H-4,w:W,h:4};
const FOOTER={x:48,y:1006,timePx:21,chapterX:244,chapterPx:20};
const SUBTITLES={y:864,languageGap:14};
const NEXT={labelY:956,headingY:985};
const VIDEO={x:48,y:104,w:1232,h:693};
let notes:Note[]=[],lines:Line[]=[],cues:Cue[]=[],beats:number[]=[],layouts:Layout[]=[];
let highlights:HighlightMap={lines:[],cards:[]};
const base=document.createElement('canvas');base.width=W*S;base.height=H*S;
const baseCtx=base.getContext('2d',{alpha:false})!;
const measure=document.createElement('canvas').getContext('2d')!;
const original=document.createElement('video');original.preload='auto';original.muted=true;original.playsInline=true;
let originalReady:Promise<void>|null=null;

function font(c:CanvasRenderingContext2D,px:number,weight=400,english=false){c.font=`${weight} ${px}px ${english?EN:FONT}`;c.textBaseline='top';}
function wrap(text:string,px:number,width:number,weight=400,english=false):string[]{
  font(measure,px,weight,english);
  const tokens=text.match(/[A-Za-z0-9’'\-]+|\s+|[^\s]/gu)??[];
  const out:string[]=[];let line='';
  for(const token of tokens){
    const next=line+token;
    if(line&&measure.measureText(next.trimEnd()).width>width){
      if(/^[，。；：？！、）》”]$/.test(token)&&line.length>1){
        const last=Array.from(line).pop()!;out.push(line.slice(0,-last.length).trimEnd());line=last+token;
      }else{out.push(line.trimEnd());line=token.trimStart();}
    }else line=next;
  }
  if(line.trim())out.push(line.trimEnd());
  return out;
}
function spans(text:string,terms:string[]):Span[]{
  const hits:Span[]=[],lower=text.toLowerCase();
  for(const term of terms){
    const needle=term.toLowerCase();let at=lower.indexOf(needle);
    while(at>=0){
      const end=at+term.length;
      const leftOK=!/^[A-Za-z0-9]/.test(term)||at===0||!/[A-Za-z0-9_]/.test(text[at-1]);
      const rightOK=!/[A-Za-z0-9]$/.test(term)||end===text.length||!/[A-Za-z0-9_]/.test(text[end]);
      if(leftOK&&rightOK)hits.push({start:at,end,term});
      at=lower.indexOf(needle,end);
    }
  }
  hits.sort((a,b)=>a.start-b.start||b.end-a.end);
  const selected:Span[]=[];
  for(const hit of hits)if(!selected.length||hit.start>=selected[selected.length-1].end)selected.push(hit);
  return selected;
}
function block(c:CanvasRenderingContext2D,source:string,text:string[],x:number,y:number,px:number,lh:number,color=FG,weight=400,english=false,terms:string[]=[]){
  font(c,px,weight,english);const ranges=spans(source,terms);let cursor=0;
  for(const line of text){
    const at=source.indexOf(line,cursor);if(at<0)throw Error('Wrapped text lost its source offset.');
    c.fillStyle=color;c.fillText(line,x,y);
    // Repaint the original shaped line through span clips: kerning, wrapping and width stay unchanged.
    for(const range of ranges){
      const start=Math.max(range.start,at)-at,end=Math.min(range.end,at+line.length)-at;
      if(end<=start)continue;
      const left=c.measureText(line.slice(0,start)).width,right=c.measureText(line.slice(0,end)).width;
      c.save();c.beginPath();c.rect(x+left,y-4,right-left,lh+8);c.clip();
      c.fillStyle=ORANGE;c.fillText(line,x,y);c.restore();
    }
    cursor=at+line.length;y+=lh;
  }
  return y;
}
function rule(c:CanvasRenderingContext2D,x:number,y:number,w:number,color='#45413d'){c.fillStyle=color;c.fillRect(x,y,w,.65);}
function formatTime(t:number){const v=Math.floor(Math.max(0,t));return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;}
function ease(x:number){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
function noteFor(c:Cue){return notes.find(n=>n.id===c.card_id)!;}

function prepareCards(){
  let y=0;
  layouts=cues.map(c=>{
    const n=noteFor(c),en=wrap(c.en,26,R.w,700,true),zh=wrap(c.zh,24,R.w),heading=wrap(n.heading,25,R.w,700),body=wrap(n.body,24,R.w);
    const height=38+en.length*33+10+zh.length*33+22+heading.length*34+10+body.length*36+22;
    const layer=document.createElement('canvas');layer.width=R.w*S;layer.height=Math.ceil(height*S);
    const g=layer.getContext('2d')!;g.scale(S,S);
    const h=highlights.cards.find(h=>h.id===c.card_id)!;
    let cy=38;cy=block(g,c.en,en,0,cy,26,33,FG,700,true,h.en)+10;
    cy=block(g,c.zh,zh,0,cy,24,33,MUTED,400,false,h.zh)+22;
    cy=block(g,n.heading,heading,0,cy,25,34,FG,700,false,h.body)+10;
    cy=block(g,n.body,body,0,cy,24,36,MUTED,400,false,h.body)+22;
    rule(g,0,cy-1,R.w);
    const l={height,en,zh,heading,body,y,layer};y+=height+R.gap;return l;
  });
}
function staticBase(){
  baseCtx.scale(S,S);baseCtx.fillStyle=BG;baseCtx.fillRect(0,0,W,H);
  const glow=baseCtx.createRadialGradient(440,430,5,420,430,1100);glow.addColorStop(0,'#181513');glow.addColorStop(1,BG);
  baseCtx.fillStyle=glow;baseCtx.fillRect(0,0,1304,H);
  font(baseCtx,50,700,true);baseCtx.fillStyle=FG;baseCtx.fillText("I'm Upping My P(doom)",48,24);
  baseCtx.fillStyle='#090909';baseCtx.fillRect(VIDEO.x,VIDEO.y,VIDEO.w,VIDEO.h);
  baseCtx.strokeStyle='#77716a';baseCtx.lineWidth=.7;baseCtx.strokeRect(VIDEO.x-.5,VIDEO.y-.5,VIDEO.w+1,VIDEO.h+1);
  rule(baseCtx,1308,104,1,'#5c5751');baseCtx.fillStyle='#37342f';baseCtx.fillRect(1308,104,.8,R.bottom-R.top);
  baseCtx.fillStyle='#3e3934';baseCtx.fillRect(R.rail-.4,R.top,.8,R.bottom-R.top);
  baseCtx.fillStyle='#403c38';baseCtx.fillRect(PROGRESS.x,PROGRESS.y,PROGRESS.w,PROGRESS.h);
}
function state(t:number){
  let i=0;for(let j=0;j<cues.length;j++)if(t>=cues[j].start)i=j;
  let offset=layouts[Math.max(0,i-1)].y,incoming=-1,transition=0;
  if(i+1<cues.length&&t>cues[i+1].start-.45){
    incoming=i+1;transition=ease((t-(cues[i+1].start-.45))/.45);
    const end=layouts[Math.max(0,incoming-1)].y;offset+=(end-offset)*transition;
  }
  let li=-1;for(let j=0;j<lines.length;j++)if(t>=lines[j].start_seconds-.10)li=j;
  return {i,offset,incoming,transition,li};
}
function pulseAt(t:number){
  let b=-10;for(const beat of beats){if(beat>t)break;b=beat;}
  return Math.exp(-(t-b)*14);
}
function drawSubtitles(t:number,li:number){
  if(li<0||t>141.2)return;
  const line=lines[li],zh=wrap(line.zh_proposed,42,1232,700),en=wrap(line.en_proposed,34,1232,500,true);
  const h=highlights.lines.find(h=>h.line_number===line.line_number)!;
  const y=block(ctx,line.zh_proposed,zh,48,SUBTITLES.y,42,54,FG,700,false,h.zh)+SUBTITLES.languageGap;
  block(ctx,line.en_proposed,en,48,y,34,44,FG,500,true,h.en);
}
const chapters:[number,string][]=[[0,'火花与疑问'],[22.76,'风险与失控'],[38.62,'奇点与加速'],[59.13,'末日与狂热'],[74.06,'训练与对齐'],[95.47,'优化与失控'],[110.18,'算力与能力'],[124.52,'预言与悬念'],[140.55,'片尾彩蛋']];
function draw(t:number){
  t=Math.max(0,Math.min(DURATION,t));const s=state(t);
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(base,0,0);ctx.setTransform(S,0,0,S,0,0);
  drawSubtitles(t,s.li);
  ctx.fillStyle=ORANGE;ctx.fillRect(PROGRESS.x,PROGRESS.y,PROGRESS.w*t/VIDEO_DURATION,PROGRESS.h);
  font(ctx,FOOTER.timePx,500,true);ctx.fillStyle='#aca59b';ctx.fillText(`${formatTime(t)} / ${formatTime(Math.ceil(VIDEO_DURATION))}`,FOOTER.x,FOOTER.y);
  let chapter=chapters[0][1];for(const pair of chapters)if(t>=pair[0])chapter=pair[1];
  font(ctx,FOOTER.chapterPx);ctx.fillText('·  '+chapter,FOOTER.chapterX,FOOTER.y+1);
  ctx.save();ctx.beginPath();ctx.rect(1320,R.top,590,R.bottom-R.top);ctx.clip();
  const last=s.incoming>=0?s.incoming:s.i;
  for(let k=Math.max(0,s.i-2);k<=last;k++){
    const l=layouts[k],cy=R.top+l.y-s.offset;if(cy+l.height<R.top||cy>R.bottom)continue;
    ctx.drawImage(l.layer,R.x,cy,R.w,l.height);
    const active=k===s.i;const status=active?(t<cues[0].start?'即将开始':'正在解释'):k<s.i?'上一条 · 继续阅读':'接下来';
    font(ctx,20,active?700:400);ctx.fillStyle=active?ORANGE:'#bcb6ac';ctx.fillText(status,R.x,cy+2);
    font(ctx,17,500,true);ctx.fillStyle=active?'#dd935f':'#938c81';ctx.textAlign='right';ctx.fillText(`${cues[k].card_id} / 40`,1872,cy+5);ctx.textAlign='left';
    const dotY=cy+13;
    if(active){const p=pulseAt(t);ctx.fillStyle=`rgba(255,121,43,${.06+.10*p})`;ctx.beginPath();ctx.arc(R.rail,dotY,15+3*p,0,2*Math.PI);ctx.fill();}
    ctx.fillStyle=active?ORANGE:'#a6a099';ctx.beginPath();ctx.arc(R.rail,dotY,active?7:5.5,0,2*Math.PI);ctx.fill();
  }
  if(s.incoming<0&&s.i+1<cues.length){
    const nextY=R.top+layouts[s.i+1].y-s.offset;
    if(nextY<=NEXT.labelY&&NEXT.headingY+28<R.bottom){
      font(ctx,17);ctx.fillStyle='#969087';ctx.fillText('接下来',R.x,NEXT.labelY);
      font(ctx,20);ctx.fillStyle='#aaa399';ctx.fillText(noteFor(cues[s.i+1]).heading,R.x,NEXT.headingY);
      ctx.fillStyle='#8b847c';ctx.beginPath();ctx.arc(R.rail,NEXT.labelY+10,5.5,0,2*Math.PI);ctx.fill();
    }
  }
  ctx.restore();
}
async function sourceAt(t:number){
  if(!originalReady){
    originalReady=new Promise((resolve,reject)=>{original.addEventListener('loadeddata',()=>resolve(),{once:true});original.addEventListener('error',()=>reject(Error(original.error?.message??'Source video failed')),{once:true});});
    original.src='/sources/references/LLMV_001_source_v001.mp4';document.body.append(original);
  }
  await originalReady;
  const at=Math.min(t,original.duration-.04);
  if(Math.abs(original.currentTime-at)>.002){await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Source seek timeout')),15000);original.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});original.currentTime=at;});}
  ctx.drawImage(original,VIDEO.x,VIDEO.y,VIDEO.w,VIDEO.h);
}
function report(){
  const pairHeights=layouts.map((l,i)=>({event:i,card_id:cues[i].card_id,height:l.height,previous_and_current:i?layouts[i-1].height+R.gap+l.height:l.height}));
  const subtitleHeights=lines.map(l=>{const height=wrap(l.zh_proposed,42,1232,700).length*54+SUBTITLES.languageGap+wrap(l.en_proposed,34,1232,500,true).length*44;return {line:l.line_number,height,top:SUBTITLES.y,bottom:SUBTITLES.y+height,footer_gap:FOOTER.y-SUBTITLES.y-height};});
  const reading=cues.map((c,i)=>({event:i,card_id:c.card_id,visible_until:cues[i+2]?.start??DURATION,full_visible_seconds:(cues[i+2]?.start??DURATION)-c.start-.45,body_characters:Array.from(noteFor(c).body).length}));
  return {canvas:[canvas.width,canvas.height],viewport_height:R.bottom-R.top,pairHeights,subtitleHeights,reading,all_pairs_fit:pairHeights.every(p=>p.previous_and_current<=R.bottom-R.top),all_subtitles_fit:subtitleHeights.every(p=>p.footer_gap>=24),body_size_at_1080p:24,card_count:notes.length,cue_count:cues.length,lyric_line_count:lines.length,progress:{...PROGRESS,duration:VIDEO_DURATION,full_width:PROGRESS.w===W&&PROGRESS.x===0,bottom_flush:PROGRESS.y+PROGRESS.h===H},footer:{...FOOTER,standalone_strip:false},next_hint:{...NEXT,only_when_below_current_card:true},fonts_loaded:document.fonts.check('24px "Noto SC"')&&document.fonts.check('700 26px Archivo')};
}
window.ready=(async()=>{
  // Font URLs are served from the Vite public directory, independent of bundled JS location.
  const root=new URL('.',document.baseURI);
  const faces=[new FontFace('Noto SC',`url('${new URL('fonts/NotoSansCJKsc-Regular.otf',root).href}')`),new FontFace('Archivo',`url('${new URL('fonts/Archivo-500.ttf',root).href}')`,{weight:'500'}),new FontFace('Archivo',`url('${new URL('fonts/Archivo-700.ttf',root).href}')`,{weight:'700'})];
  for(const face of faces)document.fonts.add(await face.load());await document.fonts.ready;
  const dataRoot=new URL('../data/',root);
  const [copy,audio,emphasis]=await Promise.all([fetch(new URL('screen-copy.json',dataRoot)).then(r=>r.json()),fetch(new URL('beat-analysis.json',dataRoot)).then(r=>r.json()),fetch(new URL('highlight-map.json',dataRoot)).then(r=>r.json())]);
  notes=copy.cards;lines=copy.lines;cues=copy.events;beats=audio.beats;highlights=emphasis;
  prepareCards();staticBase();draw(0);
})();
window.drawFrame=draw;
window.renderFrame=async(t,_variant='companion',includeSource=false)=>{await window.ready;draw(t);if(includeSource)await sourceAt(t);return canvas.toDataURL('image/jpeg',.96).split(',')[1];};
window.getLayoutReport=report;
window.getHighlightReport=()=>({lines:lines.map(l=>{const h=highlights.lines.find(h=>h.line_number===l.line_number)!;return {line_number:l.line_number,en:spans(l.en_proposed,h.en),zh:spans(l.zh_proposed,h.zh)};}),cards:cues.map(c=>{const h=highlights.cards.find(h=>h.id===c.card_id)!;return {event:c.event_id,card:c.card_id,en:spans(c.en,h.en),zh:spans(c.zh,h.zh),body:spans(noteFor(c).body,h.body??[])};})});
window.getFrameState=(t)=>{const s=state(t);return {time:t,active_card:cues[s.i].card_id,current_event:s.i,previous_card:s.i?cues[s.i-1].card_id:null,incoming_event:s.incoming,scroll_offset:s.offset,lyric_line:s.li>=0?lines[s.li].line_number:null,current_bounds:[R.top+layouts[s.i].y-s.offset,R.top+layouts[s.i].y-s.offset+layouts[s.i].height],previous_bounds:s.i?[R.top+layouts[s.i-1].y-s.offset,R.top+layouts[s.i-1].y-s.offset+layouts[s.i-1].height]:null};};
