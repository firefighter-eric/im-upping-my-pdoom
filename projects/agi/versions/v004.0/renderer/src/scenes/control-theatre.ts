import * as T from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { F, font, measure, glyphX, smart } from '../engine/type';

const C={ink:'#12151D',paper:'#F2EFE6',blue:'#315CFF',yellow:'#E0EF43',red:'#C93D45',gray:'#697480'};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{x=clamp(x);return x*x*(3-2*x);};
const ramp=(t:number,a:number,b:number)=>smooth((t-a)/(b-a));
const hit=(t:number,a:number)=>t<a?0:Math.exp(-(t-a)*12);
const rnd=(i:number)=>{const x=Math.sin(i*127.1+33.4)*43758.5453;return x-Math.floor(x);};
type P=[number,number];
type Shot={line_id:number;title:string;proposed_line_breaks:string[];layout:string;display_interval:{start:number;end:number};scene_interval:{start:number;end:number};transition_interval:{start:number;end:number};word_timing:{w:string;start:number;end:number;conf:number}[];events:{time:number;word:string;action:string}[]};
const families=['scan','scan','warnings','loss','boss','eat','hook1','foom','room','shrooms','peel','reveal','stable','loop','optimize','atoms','exit','hook2','basilisk','capital','omega','compute','stamp','network','bus','turn','review','grip','hook3','clips','pto','blocked','fuse','goals','transformer','disobey','density','fences','gpu','reward','hook4','loom','mask','upgrade','unknown','backstage'];
const lightShots=new Set([2,3,4,8,9,12,14,19,21,22,23,24,25,26,30,33,41,42]);

export default class ControlTheatre extends Scene {
 private bg=new Layer2D(); private fg=new Layer2D();
 private world=new T.Scene();
 private camera=new T.OrthographicCamera(-960,960,540,-540,.1,5000);
 private models=new Map<string,T.Group>(); private script:{shots:Shot[];music_cues:{id:string;vocal_time:number;accent_time:number}[]}|null=null;
 private key=new T.DirectionalLight(0xffffff,2.2);
 private paper=new T.MeshStandardMaterial({color:C.paper,roughness:.6,metalness:.2});
 private metal=new T.MeshStandardMaterial({color:0x697480,roughness:.3,metalness:.75});
 private blue=new T.MeshStandardMaterial({color:C.blue,roughness:.4,metalness:.4,emissive:C.blue,emissiveIntensity:.2});
 private yellow=new T.MeshStandardMaterial({color:C.yellow,roughness:.5,metalness:.2});
 private dummy=new T.Object3D();
 private lastIndex=-1; private lastBoxes:{x:number;y:number;width:number;height:number;text:string}[]=[];
 private lastVisual='';
 override async init(){
  const response=await fetch('../data/storyboard-v004.0.json');if(!response.ok)throw Error('Missing bound V4 script');this.script=await response.json();
  if(this.script!.shots.length!==46)throw Error('V4 requires all 46 lyric events');
  this.camera.position.set(0,0,2000);this.world.add(new T.AmbientLight(0xd9e3ff,1.1));this.key.position.set(-600,900,1400);this.world.add(this.key);
  const rim=new T.DirectionalLight(0x315cff,1.8);rim.position.set(800,300,-600);this.world.add(rim);
  this.buildModels();
  (window as any).__v4={coverage:()=>this.coverage(),state:()=>({line_id:this.lastIndex,family:this.lastVisual,lyric_boxes:this.lastBoxes})};
 }
 private box(g:T.Group,w:number,h:number,d:number,x=0,y=0,z=0,mat:T.Material=this.paper){
  const geo=new T.BoxGeometry(w,h,d),m=new T.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);
  const lines=new T.LineSegments(new T.EdgesGeometry(geo),new T.LineBasicMaterial({color:0x12151d,transparent:true,opacity:.65}));m.add(lines);return m;
 }
 private model(name:string){const g=new T.Group();this.models.set(name,g);this.world.add(g);return g;}
 private buildModels(){
  const scan=this.model('scan');for(const x of [-160,160]){
   const mount=new T.Mesh(new T.TorusGeometry(135,23,10,60),this.metal);mount.position.x=x;scan.add(mount);
   const rim=new T.Mesh(new T.TorusGeometry(106,4,6,60),this.blue);rim.position.set(x,0,20);scan.add(rim);
   const lens=new T.Mesh(new T.CylinderGeometry(100,100,65,48),this.blue);lens.rotation.x=Math.PI/2;lens.position.set(x,0,-20);scan.add(lens);
  }
  this.box(scan,730,75,110,0,-190,0,this.metal);for(const x of [-350,350])this.box(scan,25,400,90,x,0,-50,this.paper);
  const levers=this.model('levers');this.box(levers,620,42,75,0,-190,0,this.metal);for(const x of [-200,200]){
   const a=new T.Group();a.position.x=x;levers.add(a);this.box(a,120,100,110,0,0,0,x<0?this.paper:this.blue);this.box(a,25,300,25,0,-150,0,this.metal);
   const knob=new T.Mesh(new T.SphereGeometry(36,20,16),x<0?this.yellow:this.blue);knob.position.y=90;a.add(knob);
  }
  const eat=this.model('eat');for(const y of [-100,100]){const roller=new T.Mesh(new T.CylinderGeometry(70,70,590,40),this.metal);roller.rotation.z=Math.PI/2;roller.position.y=y;eat.add(roller);}for(const x of [-350,350])this.box(eat,50,390,190,x,0,-40,this.paper);
  const shoggoth=this.model('shoggoth');for(let i=0;i<20;i++){
   const pts=[];for(let j=0;j<7;j++){const a=i*2.399+j*.35;pts.push(new T.Vector3(Math.cos(a)*(95+j*31),Math.sin(a)*(50+j*25),Math.sin(j+i)*75));}
   const mesh=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),40,10+i%4*3,7,false),i%4===0?this.blue:this.paper);shoggoth.add(mesh);
  }
  const transformer=this.model('blocks');for(let i=0;i<10;i++){const g=new T.Group();g.position.y=(i-4.5)*56;transformer.add(g);this.box(g,430,35,150,0,0,0,i%3===0?this.blue:this.paper);this.box(g,440,5,160,0,-23,0,this.metal);}
  const clipPts=[[-45,-85],[-65,-60],[-65,120],[-40,150],[35,150],[65,120],[65,-85],[35,-120],[-15,-120],[-35,-85],[-35,90],[-10,110],[30,90],[30,-50]].map(([x,y])=>new T.Vector3(x!,y!,0));
  const clips=this.model('clips');const mesh=new T.InstancedMesh(new T.TubeGeometry(new T.CatmullRomCurve3(clipPts),44,7,7,false),this.paper,180);mesh.userData.kind='clips';clips.add(mesh);
  const gpu=this.model('gpu');const inst=new T.InstancedMesh(new T.BoxGeometry(70,50,14),this.paper,768);gpu.add(inst);
  for(let i=0;i<768;i++){this.dummy.position.set((i%32-15.5)*83,(Math.floor(i/32)-11.5)*63,rnd(i)*30);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();inst.setMatrixAt(i,this.dummy.matrix);inst.setColorAt(i,new T.Color(i%7===0?C.blue:C.paper));}inst.instanceMatrix.needsUpdate=true;
  const upgrade=this.model('upgrade');for(let j=0;j<4;j++){const g=new T.Group();g.position.z=j*70;g.scale.setScalar(1-j*.17);upgrade.add(g);this.box(g,580,25,30,0,260,0,this.blue);this.box(g,580,25,30,0,-260,0,this.paper);this.box(g,25,520,30,-290,0,0,this.paper);this.box(g,25,520,30,290,0,0,this.blue);for(let k=0;k<6;k++)this.box(g,150,35,55,(k%2-.5)*230,(Math.floor(k/2)-1)*110,0,k%2?this.paper:this.blue);}
 }
 private line(c:CanvasRenderingContext2D,pts:P[],color:string,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
 private rect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,fill:string,stroke?:string){c.fillStyle=fill;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.strokeRect(x,y,w,h);}}
 private round(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
 private circle(c:CanvasRenderingContext2D,x:number,y:number,r:number,fill?:string,stroke?:string,width=2){c.beginPath();c.arc(x,y,Math.max(.01,r),0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke();}}
 private txt(c:CanvasRenderingContext2D,text:string,x:number,y:number,size=24,color=C.gray,mono=true,align:CanvasTextAlign='left'){c.fillStyle=color;c.font=font(mono?F.mono(500):F.archivo(100,700),size);c.textAlign=align;c.fillText(text,x,y);c.textAlign='left';}
 private arrow(c:CanvasRenderingContext2D,a:P,b:P,color:string,width=3){this.line(c,[a,b],color,width);const ang=Math.atan2(b[1]-a[1],b[0]-a[0]),len=13;this.line(c,[[b[0]-Math.cos(ang-.55)*len,b[1]-Math.sin(ang-.55)*len],b,[b[0]-Math.cos(ang+.55)*len,b[1]-Math.sin(ang+.55)*len]],color,width);}
 private hatch(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string,step=14){c.save();c.beginPath();c.rect(x,y,w,h);c.clip();for(let z=-h;z<w;z+=step)this.line(c,[[x+z,y+h],[x+z+h,y]],color,1);c.restore();}
 private iso(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,d:number,fill:string,stroke:string){
  c.fillStyle=fill;c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.lineTo(x+w+d,y-d);c.lineTo(x+d,y-d);c.closePath();c.fill();c.strokeStyle=stroke;c.lineWidth=2;c.stroke();
  this.rect(c,x,y,w,h,fill,stroke);c.beginPath();c.moveTo(x+w,y);c.lineTo(x+w+d,y-d);c.lineTo(x+w+d,y+h-d);c.lineTo(x+w,y+h);c.closePath();c.fill();c.stroke();this.hatch(c,x,y,w,h,stroke+'30',18);
 }
 private person(c:CanvasRenderingContext2D,x:number,y:number,s=1,color=C.paper){c.save();c.translate(x,y);c.scale(s,s);this.circle(c,0,-96,28,color);this.round(c,-38,-57,76,100,22,color);this.line(c,[[-20,36],[-31,135]],color,21);this.line(c,[[20,36],[31,135]],color,21);this.line(c,[[-32,-33],[-85,31]],color,17);this.line(c,[[32,-33],[85,20]],color,17);c.restore();}
 private clip(c:CanvasRenderingContext2D,x:number,y:number,s:number,rot:number,color:string){c.save();c.translate(x,y);c.rotate(rot);c.scale(s,s);c.strokeStyle=color;c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(20,40);c.lineTo(20,-35);c.bezierCurveTo(20,-65,-20,-65,-20,-35);c.lineTo(-20,60);c.bezierCurveTo(-20,88,45,88,45,57);c.lineTo(45,-48);c.bezierCurveTo(45,-88,-45,-88,-45,-48);c.lineTo(-45,38);c.stroke();c.restore();}
 private wordTime(i:number,word:string){const norm=(x:string)=>x.toLowerCase().replace(/[^a-z0-9()]/g,'');const w=this.script!.shots[i]!.word_timing.find(w=>norm(w.w)===norm(word));if(!w)throw Error('Missing event word '+i+' '+word);return w.start;}
 private q(t:number,i:number,word:string,d=.35){
  const impacts:Record<string,string>={'3:drop':'loss-drop','4:boss':'boss-lock','7:FOOM':'foom','18:boom':'basilisk','22:reckoned':'safe-stamp','25:turn':'left-turn','30:PTO':'pto'};
  const cue=this.script!.music_cues.find(c=>c.id===impacts[i+':'+word]);const a=this.wordTime(i,word);
  return ramp(t,a,a+(cue?Math.max(1/60,cue.accent_time-a):d));
 }
 private location(layout:string):P{if(['LEFT','LOWER_LEFT','TL'].includes(layout))return[1350,560];if(layout==='RIGHT')return[560,560];if(layout==='BOTTOM')return[960,410];if(layout==='SPLIT')return[960,680];return[960,640];}
 private render3D(f:Frame,i:number,family:string,out:T.WebGLRenderTarget){
  this.models.forEach(g=>{g.visible=false;g.rotation.set(0,0,0);g.scale.setScalar(1);});
  this.models.get('blocks')!.children.forEach((b,k)=>{b.position.set(0,(k-4.5)*56,0);b.rotation.set(0,0,0);});
  const t=f.t,[x,y]=this.location(this.script!.shots[Math.max(0,i)]!.layout);let name='';
  if(family==='scan'||family==='basilisk'||family==='backstage'||family==='tail')name='scan';
  if(family==='boss')name='levers';if(family==='eat')name='eat';if(family==='peel'||family==='reveal')name='shoggoth';
  if(['transformer','disobey','density'].includes(family))name='blocks';if(['clips','blocked'].includes(family))name='clips';if(family==='gpu')name='gpu';if(family==='upgrade')name='upgrade';
  const g=this.models.get(name);if(!g)return;g.visible=true;g.position.set(x-960,540-y,0);g.rotation.set(.12,-.23,0);g.scale.setScalar(.92);
  if(family==='scan'){g.rotation.y=i===1?.2:-.35+this.q(t,0,'eyes',.5)*.4;g.scale.setScalar(.8);}
  if(family==='basilisk'){g.scale.setScalar(1.1+this.q(t,18,'boom',.16)*.32);g.rotation.y=.1;}
  if(family==='boss'){const a=g.children.filter(x=>x instanceof T.Group);a.forEach((x,k)=>{x.position.y=(k===0?-1:1)*this.q(t,4,k===0?'servant':'boss',.5)*125;});}
  if(family==='eat'){g.rotation.y=.35;g.children.slice(0,2).forEach((o,k)=>{o.rotation.y=t*1.2;const close=this.q(t,5,'eat',.15);o.position.y=(k===0?-1:1)*(100-close*33);});}
  if(family==='peel'||family==='reveal'){g.scale.setScalar(.9*(family==='peel'?.15+.85*this.q(t,10,'through',.7):1));g.rotation.z=Math.sin(t*.27)*.06;}
  if(family==='transformer'){g.rotation.y=-.38;g.scale.setScalar(.9+this.q(t,34,'transformers',1.4)*.15);}
  if(family==='disobey'){g.children.forEach((b,k)=>{b.rotation.z=k===4?this.q(t,35,'disobey',.3)*.45:0;b.position.x=k===4?this.q(t,35,'disobey',.3)*155:0;});}
  if(family==='density'){g.children.forEach((b,k)=>{b.rotation.z=0;b.position.x=0;b.position.y=(k-4.5)*(56-25*this.q(t,36,'super-dense',.6));});g.rotation.y=.35;}
  if(family==='clips'||family==='blocked'){
   const inst=g.children[0] as T.InstancedMesh;const p=family==='clips'?this.q(t,29,'paperclips',1.5):1;
   const count=Math.ceil(1+p*179);inst.count=count;
   for(let k=0;k<count;k++){this.dummy.position.set((rnd(k+3)-.5)*1200,(rnd(k+33)-.5)*650,(rnd(k+303)-.5)*300);this.dummy.rotation.set(rnd(k)*.8,rnd(k+4)*1.2,rnd(k+9)*Math.PI);this.dummy.scale.setScalar(.35+p*.28);this.dummy.updateMatrix();inst.setMatrixAt(k,this.dummy.matrix);}inst.instanceMatrix.needsUpdate=true;g.rotation.y=.08;
  }
  if(family==='gpu'){const p=this.q(t,38,'thousand',.6);g.scale.setScalar(1.35-p*.97);g.rotation.set(.25,-.1,-.04);}
  if(family==='upgrade'){g.children.forEach((b,k)=>{const a=[130.681,131.141,131.594,131.951][k]!;b.rotation.z=(k%2?1:-1)*ramp(t,a,a+.12)*.23;b.scale.setScalar((1-k*.17)*(1+hit(t,a)*.06));b.position.z=k*70;});g.rotation.y=-.35+this.q(t,43,'recursive',.5)*.2;}
  if(family==='backstage'||family==='tail'){g.scale.setScalar(family==='tail'?.8:.7);g.position.set(200,-80,0);g.rotation.y=.3*(1-ramp(t,154.776,155.25));}
  const impact=Math.max(0,...this.script!.music_cues.map(c=>hit(t,c.accent_time)));
  g.scale.multiplyScalar(1+impact*.018);this.key.intensity=1.8+Math.max(f.a.kick,f.a.snare)*.35+impact*.4;
  this.ctx.renderer.setRenderTarget(out);this.ctx.renderer.render(this.world,this.camera);
 }
 private graphics(f:Frame,i:number,family:string){
  const t=f.t,shot=this.script!.shots[Math.max(0,i)]!,light=lightShots.has(i),ink=light?C.ink:C.paper,dim=light?'#8A9096':'#647080',accent=light?C.blue:C.yellow;
  this.bg.clear(light?C.paper:C.ink);const c=this.bg.ctx;const [x,y]=this.location(shot.layout);
  // Precise engraved construction details, confined to the visual region.
  c.save();c.globalAlpha=.18;for(let k=0;k<8;k++)this.line(c,[[x-440,y-280+k*75],[x+440,y-280+k*75]],dim,1);c.restore();
  const label=(s:string,xx=x,yy=y)=>this.txt(c,s,xx,yy,23,dim,true,'center');
  const node=(xx:number,yy:number,r=22,col=ink)=>{this.circle(c,xx,yy,r,light?C.paper:C.ink,col,3);this.circle(c,xx,yy,4,col);};
  const wire=(a:P,b:P,col=accent)=>this.arrow(c,a,b,col,4);
  const pulse=(a:P,b:P,speed=1,col=accent)=>{const p=((t*speed)%1+1)%1;this.circle(c,a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p,7,col);};
  const paper=(xx:number,yy:number,w:number,h:number)=>{this.rect(c,xx+10,yy+10,w,h,light?'#D7D4CA':'#05080D');this.rect(c,xx,yy,w,h,C.paper,C.gray);};
  if(i<0||family==='scan'){
   this.line(c,[[x-480,y+180],[x-350,y+180],[x-350,y],[x-170,y]],C.blue,5);
   for(let k=0;k<24;k++){const a=k*Math.PI/12;this.line(c,[[x+Math.cos(a)*320,y+Math.sin(a)*240],[x+Math.cos(a)*338,y+Math.sin(a)*254]],dim,2);}
   if(i===1){const p=this.q(t,1,'circuits',.5);this.line(c,[[x-190,y+200],[x-400,y+200],[x-470,y+340],[x-800,y+340]],accent,3);this.person(c,x-680,y+270,.4,ink);const jitter=Math.sin((t-7.04)*40)*hit(t,7.04)*8;this.line(c,[[x-800,y+340],[x-680+jitter,y+300]],accent,4);label('EXTERNAL CONTROL',x,y+325);c.globalAlpha=p;c.globalAlpha=1;}
   if(i===0&&t>=3.677){c.save();c.globalAlpha=this.q(t,0,'AGI',.35)*.7;this.txt(c,'AGI',x,y+115,70,C.blue,false,'center');c.restore();}
   if(i===0&&t>=2.739)for(let k=0;k<10;k++){const p=((t-2.739)*2+k*.1)%1;this.circle(c,x-160+Math.cos(k)*p*110,y+Math.sin(k)*p*100,3,C.blue);}
  }else if(family==='warnings'){
   const start=210,yy=390;for(let k=0;k<5;k++){const yy2=yy+k*80;paper(start,yy2,1460,68);this.txt(c,['ANOMALY DETECTED','CONTROL SIGNAL REVERSED','TRAINING UPDATE','REVIEW REQUIRED','ARCHIVED — NO ACTION'][k]!,start+40,yy2+43,28,k===4?C.blue:C.gray);this.circle(c,start+1390,yy2+33,12,k===4?C.yellow:C.gray);}
   const p=this.q(t,2,'surprise',.15);this.rect(c,1440,760-p*30,170,55,C.blue);this.txt(c,'FILED',1525,797-p*30,25,C.paper,true,'center');
  }else if(family==='loss'){
   const ax=300,ay=850;this.line(c,[[ax,330],[ax,ay],[1700,ay]],ink,3);for(let k=0;k<8;k++){this.line(c,[[ax,380+k*60],[1700,380+k*60]],dim+'50',1);label(String(7-k),ax-30,386+k*60);}
   const p=this.q(t,3,'drop',.32),points:P[]=[];for(let k=0;k<80;k++){const xx=ax+20+k*17;let yy=430+Math.sin(k*2)*8;if(k>37)yy+=p*340;points.push([xx,yy]);}this.line(c,points,C.blue,6);
   this.circle(c,points[points.length-1]![0],points[points.length-1]![1],9,C.blue);this.txt(c,'LOSS',ax+15,360,25,C.gray);this.txt(c,'TRAINING STEP',1480,905,24,C.gray);this.iso(c,1030,820,420,42,35,C.paper,C.gray);const fold=this.q(t,3,'drop',.32);c.save();c.globalAlpha=fold*.32;this.rect(c,980,830,460,60,C.blue);c.restore();this.line(c,[[990,830],[990,830+fold*80],[1450,830+fold*80]],C.ink,3);this.arrow(c,[1260,530],[1260,760],C.blue,5);this.txt(c,'CONTROL LEVER',1280,785,23,C.gray);
  }else if(family==='boss'){
   const p=this.q(t,4,'boss',.45),a=this.q(t,4,'servant',.4);this.person(c,x-330,y+110+a*130,.6,C.ink);this.txt(c,'HUMAN / RECEIVER',x-330,y+280,24,C.gray,true,'center');this.txt(c,'SYSTEM / CONTROLLER',x+220,y-200-p*60,24,C.blue,true,'center');wire([x+200,y-100-p*120],[x-200,y+90+a*100],C.blue);
  }else if(family==='eat'){
   const p=this.q(t,5,'eat',.2),feed=this.q(t,5,'please',2);c.save();c.translate(x-350-feed*200,y+175);c.rotate(-.12);paper(0,0,600*(1-p*.7),115);this.txt(c,t>=20.6?'DON’T EAT ME':'PLEASE',30,70,28,C.ink);this.line(c,[[0,94],[450*(1-p*.7),94]],C.blue,3);c.restore();this.line(c,[[x-900,y+350],[x-350,y+220],[x,y+40]],C.blue,3);label('INPUT →',x-440,y-210);
  }else if(family.startsWith('hook')){
   const n=family==='hook1'?1:family==='hook2'?2:family==='hook3'?3:4;
   const p=this.q(t,i,i===28?'P(doom),':'P(doom)',.2);
   if(n===1){this.round(c,300,245,1320,600,18,'#18254B',C.blue);this.line(c,[[300,845],[1620,845]],C.yellow,6);}
   if(n===2){for(let k=0;k<5;k++){const size=420+k*95;this.round(c,960-size,540-size*.48,size*2,size*.96,12,'#00000000',k%2?C.gray:C.blue);}for(let k=0;k<8;k++)this.iso(c,80+k*230,890,180,60,18,C.blue,C.gray);}
   if(n===3){this.round(c,410,280,1100,470,14,'#18254B',C.blue);for(let k=0;k<58;k++){const edge=k%4,pp=Math.floor(k/4)/14;const cx=edge<2?180+pp*1560:edge===2?170:1750,cy=edge<2?edge===0?160:910:180+pp*690;this.clip(c,cx,cy,.48+p*.18,rnd(k)*1.2,C.paper);}this.line(c,[[130,230],[130,850],[1790,850],[1790,230]],C.gray,5);}
   if(n===4){for(let k=0;k<7;k++){const sc=1-k*.07;this.rect(c,960-850*sc,540-440*sc,1700*sc,880*sc,'#00000000',k%2?C.blue:C.gray);}for(let k=0;k<6;k++){this.rect(c,70+k*310,140,240,12,k%2?C.yellow:C.blue);this.line(c,[[190+k*310,160],[190+k*310,910]],C.gray+'70',2);}this.line(c,[[90,940],[1830,940]],C.blue,4);this.txt(c,'DISPLAY / SELF-WRITTEN',130,1020,22,C.gray);}
  }else if(family==='foom'){
   const p=this.q(t,7,'FOOM',.26);const layers=7;for(let j=0;j<layers;j++){const w=90+j*100*(.3+p),h=55+j*58*(.3+p);c.save();c.translate(x,y);c.rotate((j%2?1:-1)*.07*p);this.rect(c,-w,-h,w*2,h*2,j===0?C.blue:'#00000000',j%2?C.yellow:C.blue);c.restore();}for(let k=0;k<32;k++){const a=k*Math.PI/16;this.line(c,[[x+Math.cos(a)*90,y+Math.sin(a)*70],[x+Math.cos(a)*(120+p*900),y+Math.sin(a)*(80+p*600)]],C.blue,2);}
  }else if(family==='room'||family==='shrooms'){
   const xx=520,yy=300;this.iso(c,xx,yy,900,420,170,C.paper,C.ink);this.person(c,690,580,.55,C.ink);this.line(c,[[770,625],[810,625]],C.blue,3);this.rect(c,810,520,400,145,'#DAD8CC',C.ink);this.txt(c,'RULE INDEX',1010,568,28,C.ink,true,'center');
   for(let j=0;j<5;j++){paper(850+j*55,595,42,42);this.txt(c,['A','B','C','D','E'][j]!,872+j*55,625,23,C.ink,true,'center');}
   wire([430,600],[820,600],C.blue);wire([1210,600],[1540,600],C.blue);this.rect(c,1460,480,70,180,'#171C2A',C.gray);this.txt(c,'LOCKED',1495,705,22,C.blue,true,'center');
   for(let k=0;k<5;k++){const px=((t*.4+k/5)%1)*300;paper(440+px,552,50,60);this.txt(c,k%2?'文':'字',465+px,590,25,C.blue,true,'center');}
   if(family==='shrooms'){const p=this.q(t,9,'bag',.3);c.save();c.translate(1120,455+(1-p)*-180);c.rotate(Math.sin(t*2)*.03*this.q(t,9,'shrooms',.3));this.round(c,-100,-70,200,180,12,C.yellow,C.ink);for(let j=0;j<4;j++){this.line(c,[[j*42-66,50],[j*42-66,-4]],C.ink,8);c.beginPath();c.ellipse(j*42-66,-8,29,17,0,Math.PI,0);c.fillStyle=C.paper;c.fill();c.strokeStyle=C.ink;c.stroke();}c.restore();if(t>29.124){c.save();c.globalAlpha=.17;this.line(c,[[490+Math.sin(t*8)*20,320],[1520,320],[1690,550],[520,760]],C.blue,12);c.restore();}}
  }else if(family==='peel'||family==='reveal'){
   const p=family==='peel'?this.q(t,10,'through',.7):1;
   c.save();c.translate(x+90,y-180);c.rotate(-.06-p*.5);paper(-260,-130,600*(1-p*.55),440);this.txt(c,'HELPFUL / HARMLESS',-225,-50,28,C.ink);this.txt(c,'OUTPUT: READY',-225,20,28,C.blue);for(let k=0;k<6;k++)this.line(c,[[-225,60+k*32],[180-p*250,60+k*32]],C.gray,2);c.restore();
   for(let k=0;k<7;k++){const xx=x+(rnd(k)-.5)*430,yy=y+(rnd(k+15)-.5)*300;this.circle(c,xx,yy,11,C.ink,C.yellow,2);this.circle(c,xx,yy,4,C.yellow);}
   if(family==='reveal'){for(let k=0;k<7;k++){const xx=x+(rnd(k)-.5)*600,yy=y+(rnd(k+15)-.5)*380;this.circle(c,xx,yy,12,C.yellow);this.line(c,[[xx,yy],[xx+60,yy-55],[xx+170,yy-55]],C.yellow,2);this.txt(c,'HIDDEN '+String(k+1).padStart(2,'0'),xx+65,yy-65,20,C.yellow);}}
  }else if(family==='stable'||family==='loop'){
   const xx=430,yy=480;this.iso(c,xx,yy,1050,260,60,C.paper,C.gray);for(let k=0;k<12;k++){const px=xx+40+k*78;this.rect(c,px,yy+45,54,160,k%2?C.blue:'#A6B7FF',C.gray);}
   this.line(c,[[220,790],[420,790],[420,610],[1480,610],[1650,610]],accent,5);pulse([460,610],[1450,610],.5);
   if(family==='loop'){const p=this.q(t,13,"singularity's",1.1);c.save();c.translate(x,y);c.scale(1+p*.15,1+p*.15);for(let k=0;k<5;k++){c.beginPath();c.ellipse(0,0,360-k*50,240-k*27,k*.08,0,Math.PI*2);c.strokeStyle=k===0?C.yellow:C.blue;c.lineWidth=5;c.stroke();}c.restore();this.line(c,[[220,790],[380,790]],C.red,5);label('EXTERNAL INPUT / DISCONNECTED',x,y+300);}
  }else if(family==='optimize'){
   const p=this.q(t,14,'optimizing',.7),fast=this.q(t,14,'accelerating',1.2);const a:P=[350,620],b:P=[1580,620];
   const complex:P[]=[a,[570,350],[740,850],[950,430],[1100,820],b];this.line(c,complex,C.gray,4);this.line(c,[a,[600+200*p,620-160*(1-p)],[1100,620+150*(1-p)],b],C.blue,7);
   for(let j=0;j<1+Math.floor(fast*5);j++){const yy=640+j*47;wire([350,yy],[1570,yy],j%2?C.blue:C.gray);pulse([350,yy],[1570,yy],.5+fast*2,C.blue);}this.txt(c,'SHORTER PATH / PARALLEL EXECUTION',960,390,27,C.ink,true,'center');
  }else if(family==='atoms'){
   const p=this.q(t,15,'rearranging',1.2);for(let k=0;k<260;k++){const row=Math.floor(k/13),col=k%13,px=x+(col-6)*12,py=y+(row-10)*18;const ax=x+(col-6)*37,ay=y+(row-10)*23;this.circle(c,px*(1-p)+ax*p+Math.sin(k)*p*(1-p)*220,py*(1-p)+ay*p,3.6,k%4?C.paper:C.blue);}
   c.save();c.globalAlpha=1-p;this.person(c,x,y,.95,C.paper);c.restore();this.rect(c,x-260,y-260,520,520,'#00000000',C.blue);label('REASSEMBLY',x,y+310);
  }else if(family==='exit'){
   const p=this.q(t,16,'please',2),closed=this.q(t,16,'free',.25);for(let k=0;k<6;k++){const sc=1-k*.12-p*.1,w=660*sc,h=530*sc;this.rect(c,x-w/2,y-h/2,w,h,'#00000000',k===5?C.yellow:C.gray);}
   this.person(c,x-280+p*180,y+190,.45,C.paper);this.txt(c,'EXIT',x,y-40,65,C.yellow,false,'center');if(closed>0){this.line(c,[[x-110,y-110],[x+110,y+110]],C.red,closed*12);this.line(c,[[x+110,y-110],[x-110,y+110]],C.red,closed*12);}wire([x-440,y+330],[x+440,y+330],C.blue);
  }else if(family==='basilisk'){
   for(let k=0;k<14;k++){const xx=x-500+k*77;this.line(c,[[xx,y-290],[xx+30,y+280]],C.gray,2);}const p=this.q(t,18,'boom',.2);this.circle(c,x,y,150+p*270,undefined,C.blue,4);this.person(c,x-410,y+260,.35,C.paper);label('OBSERVATION IS NOT NEUTRAL',x,y+350);
  }else if(family==='capital'){
   const p=this.q(t,19,'NVDA',1.25);for(let k=0;k<6;k++){const xx=850+k*100;this.iso(c,xx,850-k*65,78,50,18,k/6<p?C.blue:C.paper,C.gray);}
   this.line(c,[[1280,820],[1280,290]],C.blue,6);paper(1160,780-p*470,240,120);this.txt(c,'NVDA',1280,855-p*470,45,C.ink,false,'center');this.circle(c,1280,225,53,C.paper,C.gray);this.circle(c,1300,214,48,light?C.paper:C.ink);this.txt(c,'CAPITAL → COMPUTE',1300,970,25,C.gray,true,'center');
  }else if(family==='omega'){
   const p=this.q(t,20,'soon',.5);for(let k=0;k<40;k++){const a=k/40*Math.PI*2;this.line(c,[[x+Math.cos(a)*600,y+Math.sin(a)*340],[x+Math.cos(a)*(90*(1-p)),y+Math.sin(a)*(90*(1-p))]],k%4?C.blue:C.yellow,2);}this.circle(c,x,y,12+hit(t,65.556)*30,C.yellow);label('CONVERGENCE',x,y+300);
  }else if(family==='compute'){
   const p=this.q(t,21,'FLOPs',.3);for(let r=0;r<9;r++){const yy=360+r*60;wire([970,yy],[1690+p*120,yy],r%2?C.blue:C.gray);for(let k=0;k<7;k++)this.circle(c,970+((t*(200+p*700)+k*100)%700),yy,4,C.blue);}
   this.rect(c,940,310,770,580,'#00000000',C.ink);this.txt(c,'10³⁰',1320,980,95,C.blue,false,'center');
  }else if(family==='stamp'){
   paper(430,350,1060,520);this.txt(c,'SAFETY EVALUATION',500,430,32,C.ink);for(let k=0;k<4;k++){this.rect(c,500,470+k*67,26,26,'#00000000',C.gray);this.line(c,[[560,488+k*67],[1330,488+k*67]],C.gray,2);}
   const p=this.q(t,22,'reckoned',.14);c.save();c.translate(1050,580-(1-p)*200);c.rotate(-.11);this.rect(c,-250,-75,500,150,'#00000000',C.blue);this.txt(c,'SAFE ENOUGH',0,22,55,C.blue,false,'center');c.restore();
   if(t>71.45)this.line(c,[[820,350],[920,470],[860,600],[1030,740],[930,870]],C.red,4);this.txt(c,'APPROVED',520,816,23,C.gray);
  }else if(family==='network'){
   const repeat=t>=76.845;const nodes:P[][]=[];for(let j=0;j<5;j++){nodes[j]=[];for(let k=0;k<4;k++)nodes[j]!.push([430+j*260,300+k*125]);}
   for(let j=0;j<4;j++)for(const a of nodes[j]!)for(const b of nodes[j+1]!){this.line(c,[a,b],repeat&&Math.abs(a[1]-b[1])<50?C.blue:C.gray+'65',repeat&&Math.abs(a[1]-b[1])<50?4:1.5);}
   const back=t>=76.12&&t<76.845,p=Math.max(0,((t-(back?76.12:repeat?76.845:74.06))/(back?.19:.7))%4),layer=back?4-p:p;
   nodes.forEach((row,j)=>row.forEach(([xx,yy])=>{node(xx,yy,28,Math.abs(j-layer)<.65?(back?C.blue:C.ink):C.gray);}));
   this.arrow(c,back?[1470,820]:[430,820],back?[430,820]:[1470,820],C.blue,5);this.txt(c,back?'ERROR / UPDATE':repeat?'UPDATED FORWARD SIGNAL':'FORWARD SIGNAL',960,880,28,C.blue,true,'center');
  }else if(family==='bus'){
   const p=this.q(t,24,'obsolete',.5);this.iso(c,1020,390,220,150,30,C.paper,C.gray);this.iso(c,1450,640,220,150,30,C.paper,C.gray);this.txt(c,'COMPUTE',1130,480,24,C.ink,true,'center');this.txt(c,'MEMORY',1560,730,24,C.ink,true,'center');
   this.line(c,[[1240,470],[1350,470],[1350,710],[1450,710]],C.gray,8);if(p>0){this.line(c,[[1080,530],[1550,380],[1690,560]],C.blue,5);this.line(c,[[1290,520],[1410,680]],C.red,p*10);}label('OLD BUS / BYPASSED',1340,900);
  }else if(family==='turn'||family==='review'){
   const xx=360,yy=650;for(let k=0;k<6;k++){node(xx+k*210,yy,16,C.gray);this.txt(c,['INPUT','TRAIN','TEST','CDR','DEPLOY','OUTPUT'][k]!,xx+k*210,yy+65,23,C.gray,true,'center');}
   this.line(c,[[xx,yy],[1620,yy]],C.gray,3);const p=family==='turn'?this.q(t,25,'turn',.23):1;this.line(c,[[xx,yy],[900,yy],[900,yy-p*310],[1570,yy-p*310]],C.blue,6);this.circle(c,900+this.q(t,25,'there',.6)*500,yy-p*310,10,C.blue);
   this.rect(c,920,290,670,450,'#00000000',C.gray+'80');if(family==='review'){const q=this.q(t,26,'CDR',.4);this.circle(c,990,650,47,undefined,C.red,3);this.txt(c,'NOT HELD',990,800,35,C.red,false,'center');this.arrow(c,[1070,420],[1550,420],C.blue,4);c.globalAlpha=q;c.globalAlpha=1;}
  }else if(family==='grip'){
   const p=this.q(t,27,'go',.5),slide=this.q(t,27,'please',3.7);this.rect(c,x-40,y-220,80,250,C.gray,C.paper);this.line(c,[[x,y],[x-140,y+110+slide*80]],C.blue,8);this.round(c,x-120-p*70,y+10,85,45,15,C.paper);this.round(c,x+35+p*70,y+10,85,45,15,C.paper);this.person(c,x-140,y+220+p*140,.65,C.paper);this.txt(c,'LAST CONNECTION',x,y-290,24,C.gray,true,'center');
  }else if(family==='clips'||family==='blocked'){
   this.rect(c,230,280,1460,500,'#00000000',C.gray);for(let k=0;k<7;k++)this.line(c,[[230+k*240,280],[230+k*240,780]],C.gray+'60',2);
   const p=family==='blocked'?this.q(t,31,'nowhere',.6):0;this.rect(c,800,300,300,420,C.blue+'22',C.blue);this.txt(c,'EXIT',950,520,55,C.yellow,false,'center');if(p>0)for(let k=0;k<18;k++)this.clip(c,820+(k%6)*50,350+Math.floor(k/6)*120,.5,Math.sin(k)*.4,C.paper);if(family==='blocked')this.line(c,[[800,300],[1100,720]],C.red,8*p);
  }else if(family==='pto'){
   this.iso(c,1030,670,600,70,50,C.paper,C.gray);this.round(c,1260,520,140,140,20,'#00000000',C.gray);this.line(c,[[1330,660],[1330,810]],C.gray,6);this.line(c,[[1250,810],[1410,810]],C.gray,6);
   const p=this.q(t,30,'PTO',.15);c.save();c.translate(1280,420-(1-p)*100);c.rotate(-.05);paper(-310,-120,620,240);this.txt(c,'OUT OF OFFICE',0,-42,34,C.ink,true,'center');this.txt(c,'PTO',0,53,95,C.blue,false,'center');c.restore();wire([940,870],[1190,870],C.blue);label('NO OPERATOR',1350,920);
  }else if(family==='fuse'){
   const p=this.q(t,32,'lit',2.2),sx=250,ex=1650,yy=640;const points:P[]=[];for(let k=0;k<90;k++)points.push([sx+k*(ex-sx)/89,yy+Math.sin(k*.18)*55]);this.line(c,points,C.gray,13);this.line(c,points.slice(0,Math.max(2,Math.floor(p*90))),C.red,11);
   const xx=sx+p*(ex-sx),fy=yy+Math.sin(p*89*.18)*55;this.circle(c,xx,fy,11,C.yellow);for(let k=0;k<24;k++){const a=k*2.4,rr=((t*80+k*13)%120);this.circle(c,xx+Math.cos(a)*rr,fy+Math.sin(a)*rr,2,C.yellow);}this.txt(c,'IRREVERSIBLE',250,880,28,C.red);
  }else if(family==='goals'){
   for(let k=0;k<2;k++){const xx=430+k*650;this.circle(c,xx,620,190,C.paper,C.gray);for(let j=0;j<20;j++){const a=-Math.PI*.8+j*Math.PI*.08;this.line(c,[[xx+Math.cos(a)*150,620+Math.sin(a)*150],[xx+Math.cos(a)*170,620+Math.sin(a)*170]],C.gray,2);}const p=k===0?ramp(t,105.96,109.8):.2;const a=-Math.PI*.8+p*Math.PI*1.6;this.line(c,[[xx,620],[xx+Math.cos(a)*140,620+Math.sin(a)*140]],C.blue,6);this.txt(c,k===0?'CAPABILITY':'OBJECTIVE',xx,890,29,C.ink,true,'center');}
   this.clip(c,1080,620,.65,0,C.ink);this.txt(c,'MORE CAPABLE ≠ DIFFERENT GOAL',970,970,26,C.gray,true,'center');
  }else if(['transformer','disobey','density'].includes(family)){
   for(let k=0;k<5;k++){const yy=y-220+k*100;wire([x-360,yy],[x-245,yy],C.blue);this.line(c,[[x+250,yy],[x+355,yy],[x+355,yy+100],[x+250,yy+100]],C.gray,2);this.txt(c,['ATTENTION','ADD + NORM','FEED FORWARD','RESIDUAL','OUTPUT'][k]!,x+405,yy+8,21,C.gray);}
   if(family==='disobey'){const p=this.q(t,35,'disobey',.3);this.line(c,[[x-450,y-20],[x-210,y-20]],C.red,5);this.line(c,[[x+50,y],[x+490,y+p*180]],C.yellow,6);label('SELF-ROUTED',x,y+330);}
   if(family==='density')label('SAME VOLUME / MORE CONNECTIONS',x,y+310);
  }else if(family==='fences'){
   for(let k=0;k<3;k++){const p=this.q(t,37,['Breaking','through','fence'][k]!,.2);const xx=540+k*330;this.rect(c,xx,y-230,80,480,'#00000000',C.gray);if(k===0)this.line(c,[[xx-100,y+120],[xx-100,y+300*p],[xx+190,y+300*p]],C.blue,5);if(k===1){this.circle(c,xx+40,y,45,undefined,C.yellow,4);this.line(c,[[xx+40,y],[xx+110*p,y-80*p]],C.yellow,6);}if(k===2){this.line(c,[[xx,y-230],[xx+80+p*120,y+250]],C.red,5);}
    this.txt(c,['BYPASS','UNLOCK','REMOVE'][k]!,xx+40,y+340,24,C.gray,true,'center');}
  }else if(family==='gpu'){
   this.txt(c,'100,000',1300,950,94,C.yellow,false,'center');this.line(c,[[890,920],[1720,920]],C.gray,2);
  }else if(family==='reward'){
   const p=this.q(t,39,'askew',.25);paper(240,400,490,280);this.txt(c,'HUMAN FEEDBACK',485,460,25,C.ink,true,'center');this.txt(c,p>.5?'PASS':'FAIL',485,595,94,p>.5?C.blue:C.red,false,'center');this.line(c,[[760,520],[1040,520],[1040,770],[300,770],[300,680]],p>.5?C.yellow:C.gray,6);this.iso(c,820,420,230,230,40,C.blue,C.gray);label('SELF-APPROVAL',520,900);
  }else if(family==='loom'){
   const root:P=[300,720];for(let j=0;j<6;j++){const mid:P=[650,350+j*105];wire(root,mid,j===3?C.blue:C.gray);for(let k=0;k<3;k++){const end:P=[1150+k*200,300+j*105+(k-1)*35];this.line(c,[mid,end],j===3?C.blue:C.gray+'80',2);node(end[0],end[1],6,j===3?C.blue:C.gray);}}
   this.txt(c,'LOOM',1470,670,62,C.blue,false,'center');
  }else if(family==='mask'){
   for(let k=0;k<5;k++){const xx=990+(k%3)*240,yy=410+Math.floor(k/3)*200,p=this.q(t,42,'pre-training',.5+k*.05);paper(xx,yy,210,120);this.rect(c,xx+18,yy+28,174*(1-p),65,C.ink);this.txt(c,['INPUT','TOKEN','CONTEXT','PREDICT','UPDATE'][k]!,xx+105,yy+78,25,C.blue,true,'center');}
  }else if(family==='upgrade'){
   for(let k=0;k<3;k++){this.arrow(c,[x-400,y+230-k*160],[x-300,y+100-k*160],C.yellow,4);this.txt(c,'GEN '+String(k+1),x+380,y+220-k*180,24,C.gray);}this.arrow(c,[x+360,y-300],[x-360,y-300],C.blue,6);
  }else if(family==='unknown'){
   const open=this.q(t,44,'see',.22)*(1-this.q(t,44,'know',1));this.rect(c,1220,300,330,610,'#252C3B',C.gray);this.rect(c,1360,330,30+open*90,540,C.paper);this.person(c,1080,760,.85,C.paper);const grad=c.createLinearGradient(1380,550,1000,800);grad.addColorStop(0,'#F2EFE688');grad.addColorStop(1,'#F2EFE600');c.fillStyle=grad;c.beginPath();c.moveTo(1390,400);c.lineTo(1020,600);c.lineTo(1030,930);c.lineTo(1390,840);c.fill();this.txt(c,'CONTENTS WITHHELD',1450,985,24,C.gray,true,'center');
  }else if(family==='backstage'||family==='tail'){
   const p=family==='backstage'?ramp(t,137.38,141.78):ramp(t,141.78,153);const sc=1-p*.5;c.save();c.translate(1100,680);c.scale(sc,sc);for(let k=0;k<4;k++){if(family==='tail'&&t>=[142.049,143.867,145.685,151.14][k]!)continue;const xx=-630+k*360;this.rect(c,xx,-360,250,540,k%2?'#18254B':'#232C3D',C.gray);this.line(c,[[xx+125,-360],[xx+125,-550]],C.blue,4);this.circle(c,xx+125,-560,24,C.paper,C.gray);this.line(c,[[xx+125,-560],[650,-560]],C.blue,3);}
   this.line(c,[[-720,250],[720,250]],C.gray,5);for(let k=0;k<5;k++)this.circle(c,-620+k*310,280,20,C.gray);c.restore();this.txt(c,'CONTROL OF THE PRESENTATION',1120,985,23,C.gray,true,'center');
   if(family==='tail'){this.person(c,580,760,.65,C.paper);wire([1270,690],[670,740],C.blue);if(t>=147.504){for(let k=0;k<3;k++){this.circle(c,660+k*70,840,22,C.gray,C.paper);const a=(t-147.504)*(k+1)*.7;this.line(c,[[660+k*70,840],[660+k*70+Math.cos(a)*18,840+Math.sin(a)*18]],C.blue,3);}}if(t>=149.322){this.line(c,[[1270,690],[1600,690],[1600,380],[1270,380],[1270,500]],C.blue,3);this.txt(c,'SELF-CONTROL',1460,360,21,C.blue,true,'center');}for(let k=0;k<5;k++)this.clip(c,450+k*120,925,.25,rnd(k),C.gray);const fade=ramp(t,156.3,156.651);c.fillStyle=`rgba(18,21,29,${fade*.75})`;c.fillRect(0,0,1920,1080);}
  }
  return {light,ink,dim,accent};
 }
 private transition(c:CanvasRenderingContext2D,f:Frame,i:number,colors:{light:boolean;ink:string;dim:string;accent:string}){
  if(i<0)return;const tr=this.script!.shots[i]!.transition_interval;if(tr.end<=tr.start||f.t<tr.start||f.t>=tr.end)return;
  const p=ramp(f.t,tr.start,tr.end),[x,y]=this.location(this.script!.shots[i]!.layout),[nx,ny]=this.location(this.script!.shots[Math.min(i+1,45)]!.layout);
  // Object-carrying wipes: retain the last words over an outgoing physical boundary.
  if([0,1,11,44].includes(i)){c.save();c.globalAlpha=p*.8;const r=720*(1-p)+120;this.circle(c,x,y,r,undefined,colors.accent,10);this.line(c,[[x-r,y],[nx,ny]],colors.accent,4);c.restore();}
  else if([3,5,9,22,33].includes(i)){c.save();c.translate(x,y);c.rotate(-p*.22);this.rect(c,-560,-280,1120,560*p,colors.light?C.ink:C.paper,colors.accent);this.hatch(c,-560,-280,1120,560*p,colors.light?'#697480':'#315CFF',22);c.restore();}
  else if([6,7,17,28,40,43].includes(i)){for(let k=0;k<4;k++){const xx=960+(k-1.5)*420;this.rect(c,xx-100,540-550*p,200,1100*p,k%2?C.blue:colors.dim);}}
  else{this.line(c,[[x-450,y+260],[x-450+(nx-x+900)*p,y+260+(ny-y)*p]],colors.accent,6);this.circle(c,x-450+(nx-x+900)*p,y+260+(ny-y)*p,13,colors.accent);}
 }
 private typography(f:Frame,i:number,colors:{light:boolean;ink:string;dim:string;accent:string}){
  this.fg.clear();const c=this.fg.ctx;this.lastBoxes=[];
  this.transition(c,f,i,colors);
  const impact=Math.max(0,...this.script!.music_cues.map(cue=>hit(f.t,cue.accent_time)));
  if(impact>.001){c.globalAlpha=impact*.7;this.line(c,[[40,1040],[1880,1040]],colors.accent,3);c.globalAlpha=1;}
  if(i<0)return this.fg.upload();const s=this.script!.shots[i]!,t=f.t;
  if(t>=s.display_interval.start&&t<s.display_interval.end){
   const hero=[6,7,17,28,40].includes(i);let rows=s.proposed_line_breaks.map(smart),width=800,x=116,y=390,base=78;
   if(s.layout==='TOP'){width=1660;x=130;y=145;base=80;}
   if(s.layout==='BOTTOM'){width=1600;x=160;y=882;base=76;}
   if(s.layout==='TL'){width=860;x=116;y=175;base=80;}
   if(s.layout==='LEFT'){width=800;x=116;y=365;base=80;}
   if(s.layout==='RIGHT'){width=790;x=1020;y=370;base=80;}
   if(s.layout==='LOWER_LEFT'){width=1000;x=116;y=810;base=78;}
   if(s.layout==='SPLIT'){width=1640;x=140;y=155;base=86;}
   if(s.layout==='CENTER'){width=1500;x=210;y=420;base=94;}
   if(s.layout==='HERO'){width=1600;x=160;y=440;base=154;}
   if(i===28){base=112;y=448;}
   if(i===40){y=410;}
   if(hero&&i!==7)y-=this.q(t,i,'upping',.4)*28;
   // Entire phrase is kerned first. Colour changes are clipped over the complete run.
   const family=F.archivo(100,hero?900:700);let size=Math.min(base,...rows.map(text=>width/Math.max(1,measure(text,family,100))*100));size=Math.max(46,size);
   const lineGap=size*1.15;let wordIndex=0;
   rows.forEach((text,ri)=>{
    let xx=x,yy=y+ri*lineGap;
    if(hero||s.layout==='CENTER')xx=(1920-measure(text,family,size))/2;
    if(hero&&ri===1){yy+=this.q(t,i,i===7?'FOOM':i===28?'P(doom),':'P(doom)',.2)*12;}
    const ww=measure(text,family,size),h=size*1.13;
    // Keep the reading area quiet even when spatial typography is swallowed or folded.
    c.fillStyle=colors.light?'rgba(242,239,230,.97)':'rgba(18,21,29,.94)';c.fillRect(xx-18,yy-size*.96,ww+36,h+24);
    c.font=font(family,size);c.fillStyle=colors.light?'#6A7078':'#ACB4C5';c.fillText(text,xx,yy);
    let cursor=0;const tokens=text.split(' ');
    for(const token of tokens){const w=s.word_timing[wordIndex++];if(!w)throw Error('Lyric layout lost a word');const a=glyphX(text,cursor,family,size),b=glyphX(text,cursor+token.length,family,size);
     if(t>=w.start){c.save();c.beginPath();c.rect(xx+a-1,yy-size*1.1,b-a+2,size*1.4);c.clip();c.fillStyle=t<w.end?(colors.light?C.blue:C.yellow):colors.ink;c.fillText(text,xx,yy);c.restore();}
     cursor+=token.length+1;
    }
    this.lastBoxes.push({x:xx,y:yy-size,width:ww,height:h,text});
   });
  }
  // Non-lexical vocal tails are marked as sustained sounds, not invented word onsets.
  const ah=(t>=34.9&&t<38.3)||(t>=122.4&&t<125.9),oh=t>=141.56&&t<153.58;
  if(ah||oh){c.font=font(F.archivo(100,500),35);c.fillStyle=colors.dim;c.fillText(oh?'oh…':'ah…',130,995);}
  if(t>=108.5&&t<110.15){/* Suspected repeated Just is not asserted without listening confirmation. */}
  return this.fg.upload();
 }
 coverage(){return this.script!.shots.map(s=>({line_id:s.line_id,text:s.proposed_line_breaks.join(' '),display:s.display_interval,events:s.events.map(e=>({time:e.time,word:e.word})),layout:s.layout,family:families[s.line_id],word_count:s.word_timing.length}));}
 render(f:Frame,out:T.WebGLRenderTarget):PostOverrides{
  const t=f.t;let i=this.script!.shots.findIndex(s=>t>=s.scene_interval.start&&t<s.scene_interval.end);if(t>=141.783)i=45;const family=t>=141.783?'tail':i<0?'scan':families[i]!;
  this.lastIndex=i;this.lastVisual=family;const colors=this.graphics(f,i,family);clearRT(this.ctx.renderer,out);
  this.ctx.comp.draw(this.ctx.renderer,this.bg.upload(),out,{mode:'replace'});this.render3D(f,i,family,out);this.ctx.comp.draw(this.ctx.renderer,this.typography(f,i,colors),out,{mode:'normal'});
  return {bloom:.08,bloomThreshold:1.1,halation:0,ca:0,grain:.014,vignette:.05,exposure:1,hud:0,frame:0,pdoom:0,shake:[0,0],zoom:1,flash:0,fade:ramp(t,156.3,156.651)};
 }
 override dispose(){this.world.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();}});this.paper.dispose();this.metal.dispose();this.blue.dispose();this.yellow.dispose();this.bg.texture.dispose();this.fg.texture.dispose();}
}
