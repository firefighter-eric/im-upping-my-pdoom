// V3 original scene design. Reference engine only; no reference scene geometry.
import * as T from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { F, font, measure } from '../engine/type';
import type { Line } from '../engine/lyrics';

const C = { milk: 0xf1eddf, ink: 0x211635, violet: 0x7461a9, lime: 0xc8f76b, pink: 0xf075c5 };
const sat = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { x = sat(x); return x*x*(3-2*x); };
const V = (x: number, y: number, z: number) => new T.Vector3(x,y,z);
const hash = (i: number) => { const v = Math.sin(i*127.1+17.3)*43758.5453; return v-Math.floor(v); };
const ceramic = (color = C.milk, roughness = .32) => new T.MeshStandardMaterial({ color, roughness, metalness: .16 });

type Plant = { root: T.Group; shoots: T.Group[]; leaves: T.Mesh[]; core: T.Mesh; phase: number };

export default class Greenhouse extends Scene {
  private world = new T.Scene();
  private camera = new T.PerspectiveCamera(38, 16/9, .1, 140);
  private rig = new T.Group();
  private layer = new Layer2D();
  private plants: Plant[] = [];
  private capsules: T.Group[] = [];
  private panels: T.Group[] = [];
  private moving: T.Object3D[] = [];
  private spores: T.Group[] = [];
  private beads: T.InstancedMesh | null = null;
  private clips: T.InstancedMesh | null = null;
  private dummy = new T.Object3D();
  private mode = this.ctx.params.mode as string;
  private light = new T.PointLight(C.lime, 12, 30, 2);
  private platform: T.Mesh | null = null;
  private switch: T.Mesh | null = null;
  private dark = ['mutation','clips','breach'].includes(this.mode);
  private labelTexture: T.CanvasTexture | null = null;

  private mesh(geometry: T.BufferGeometry, material: T.Material, parent: T.Object3D, x=0,y=0,z=0) {
    const m = new T.Mesh(geometry, material); m.position.set(x,y,z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  private rod(a: T.Vector3, b: T.Vector3, radius: number, parent: T.Object3D, material: T.Material) {
    const d = b.clone().sub(a), m = this.mesh(new T.CylinderGeometry(radius,radius,d.length(),8),material,parent);
    m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize()); return m;
  }
  private label() {
    if (this.labelTexture) return this.labelTexture;
    const cv=document.createElement('canvas'); cv.width=512; cv.height=128;
    const c=cv.getContext('2d')!; c.fillStyle='#f1eddf';c.fillRect(0,0,512,128);
    c.fillStyle='#211635';c.font=font(F.mono(500),22);c.fillText('SPECIMEN / A.G.I.',24,42);
    c.font=font(F.mono(400),14);c.fillText('CONTAINMENT IS A HYPOTHESIS',24,68);
    for(let i=0;i<65;i++)c.fillRect(24+i*7,85,hash(i)> .4?3:1,22);
    this.labelTexture=new T.CanvasTexture(cv);this.labelTexture.colorSpace=T.SRGBColorSpace;
    return this.labelTexture;
  }
  private capsule(x: number,z: number,scale=1) {
    const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);this.rig.add(g);
    this.mesh(new T.CylinderGeometry(1.42,1.55,.3,48),ceramic(),g,0,.15,0);
    const glass=new T.MeshPhongMaterial({color:0xc6cadc,transparent:true,opacity:.13,shininess:110,side:T.DoubleSide,depthWrite:false});
    const shell=this.mesh(new T.CylinderGeometry(1.3,1.3,4.4,48,1,true),glass,g,0,2.45,0);shell.castShadow=false;g.userData.shell=shell;
    for(const y of [.45,4.55]){const ring=this.mesh(new T.TorusGeometry(1.3,.052,8,48),ceramic(C.violet),g,0,y,0);ring.rotation.x=Math.PI/2;if(y>4)g.userData.lid=ring;}
    for(let i=0;i<4;i++){const a=i*Math.PI/2;this.rod(V(1.3*Math.cos(a),.4,1.3*Math.sin(a)),V(1.3*Math.cos(a),4.55,1.3*Math.sin(a)),.024,g,ceramic(C.violet));}
    const plate=this.mesh(new T.PlaneGeometry(1.2,.3),new T.MeshBasicMaterial({map:this.label(),side:T.DoubleSide}),g,0,.42,1.5);
    plate.castShadow=false;this.capsules.push(g);return g;
  }
  private plant(parent: T.Object3D, scale=1, phase=0) {
    const root=new T.Group();root.scale.setScalar(scale);parent.add(root);
    const core=this.mesh(new T.SphereGeometry(.35,24,16),ceramic(C.milk,.2),root,0,.9,0);core.scale.set(.8,1.4,.8);
    const shoots:T.Group[]=[],leaves:T.Mesh[]=[];
    const bright=new T.MeshStandardMaterial({color:C.lime,emissive:C.lime,emissiveIntensity:.28,roughness:.38,metalness:.15});
    for(let i=0;i<9;i++){
      const a=i*2.39996+phase, node=new T.Group();node.position.y=.75+i*.2;node.rotation.y=a;root.add(node);shoots.push(node);
      const len=.65+(i%3)*.2;
      this.rod(V(0,0,0),V(len,.45,0),.026,node,ceramic(C.violet));
      const leaf=this.mesh(new T.OctahedronGeometry(.4,0),bright,node,len,.5,0);leaf.scale.set(1,.32,.6);leaf.rotation.z=.4;leaves.push(leaf);
      this.mesh(new T.SphereGeometry(.065,8,6),bright,node,len*.5,.22,0);
    }
    this.rod(V(0,.4,0),V(0,3,0),.038,root,ceramic(C.violet));
    this.plants.push({root,shoots,leaves,core,phase});return root;
  }
  private arch(z: number, width=11, height=8) {
    const g=new T.Group();g.position.z=z;this.rig.add(g);
    const mat=ceramic(C.violet), r=.07;
    this.rod(V(-width/2,0,0),V(-width/2,height,0),r,g,mat);
    this.rod(V(width/2,0,0),V(width/2,height,0),r,g,mat);
    this.rod(V(-width/2,height,0),V(0,height+2,0),r,g,mat);
    this.rod(V(0,height+2,0),V(width/2,height,0),r,g,mat);
    this.panels.push(g);return g;
  }
  override init() {
    const bg=this.dark?C.ink:C.milk;
    this.world.background=new T.Color(bg);this.world.fog=new T.Fog(bg,24,65);
    this.world.add(this.rig,new T.HemisphereLight(C.milk,C.violet,this.dark?1.2:2.1));
    const key=new T.DirectionalLight(0xfff5e5,3.2);key.position.set(-6,12,9);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-18;key.shadow.camera.right=18;
    key.shadow.camera.top=18;key.shadow.camera.bottom=-18;key.shadow.bias=-.001;this.world.add(key);
    const rim=new T.DirectionalLight(C.violet,2.2);rim.position.set(6,6,-8);this.world.add(rim);
    this.light.position.set(1,3,2);this.world.add(this.light);
    const floor=this.mesh(new T.PlaneGeometry(160,160),ceramic(this.dark?0x241d35:0xe4dfd2,.7),this.world);
    floor.rotation.x=-Math.PI/2;floor.position.y=-.18;floor.castShadow=false;
    if(this.mode==='seed'){
      const g=this.capsule(3.6,0,1.15);this.plant(g,1,0);
      this.platform=this.mesh(new T.CylinderGeometry(2.2,2.5,1.1,64),ceramic(C.violet),this.rig,3.6,-.6,0);
      for(let i=0;i<3;i++){const ring=this.mesh(new T.TorusGeometry(1.65+i*.18,.022,6,80),ceramic(C.lime),g,0,1.5+i*.8,0);ring.rotation.x=Math.PI/2;this.moving.push(ring);}
    } else if(this.mode==='culture') {
      for(let i=0;i<5;i++){const g=this.capsule((i-2)*3.1,-Math.abs(i-2)*1.2);this.plant(g,.95,i*.7);}
      for(let i=0;i<4;i++)this.arch(-3-i*3,17,6);
      for(let i=0;i<6;i++){const m=this.mesh(new T.BoxGeometry(.5,.4,.5),ceramic(C.pink),this.rig,(i-2.5)*1.4,.5,4);this.moving.push(m);}
      for(let i=0;i<11;i++){
        const g=new T.Group();g.position.set((i-5)*.85,0,3.1);this.rig.add(g);
        this.mesh(new T.CylinderGeometry(.07,.1,.6,10),ceramic(),g,0,.3,0);
        this.mesh(new T.SphereGeometry(.32,20,12,0,Math.PI*2,0,Math.PI/2),ceramic(i%2?C.pink:C.lime),g,0,.61,0);
        this.spores.push(g);
      }
    } else if(this.mode==='mutation') {
      for(let i=0;i<32;i++){
        const g=new T.Group();g.position.set(0,.4+i*.21,0);g.rotation.y=i*.53;this.rig.add(g);
        this.rod(V(-1.3,0,0),V(1.3,0,0),.045,g,ceramic(C.milk));
        for(const x of [-1.3,1.3])this.mesh(new T.IcosahedronGeometry(.22,1),ceramic(x<0?C.lime:C.pink),g,x,0,0);
        this.moving.push(g);
      }
      for(let i=0;i<7;i++){const g=this.capsule(Math.cos(i*2.4)*6,Math.sin(i*2.4)*6,.5);this.plant(g,.9,i);}
      this.beads=new T.InstancedMesh(new T.OctahedronGeometry(.11),ceramic(C.lime),140);this.rig.add(this.beads);
    } else if(this.mode==='factory') {
      for(let i=0;i<24;i++){const g=this.capsule((i%6-2.5)*3.4,-Math.floor(i/6)*3.6,.8);this.plant(g,.9,i*.3);}
      for(let i=0;i<6;i++)this.arch(3-i*3.5,23,8);
      for(let i=0;i<10;i++){const m=this.mesh(new T.BoxGeometry(.65,.65,.65),ceramic(i%2?C.lime:C.violet),this.rig);this.moving.push(m);}
      for(const x of [-11,11])this.rod(V(x,6,5),V(x,6,-20),.1,this.rig,ceramic(C.violet));
    } else if(this.mode==='turn') {
      for(let i=0;i<12;i++){
        const x=i<6?-6+i*1.5:1.5,z=i<6?0:-(i-5)*1.5;
        const m=this.mesh(new T.BoxGeometry(1.2,.22,1.2),ceramic(i===5?C.pink:C.violet),this.rig,x,.1,z);this.moving.push(m);
        if(i%2===0){const g=this.capsule(x,z,.45);this.plant(g,.9,i);}
      }
      for(let i=0;i<5;i++){
        const g=new T.Group();g.position.set(-3+i*2,0,-2-i);this.rig.add(g);
        this.mesh(new T.BoxGeometry(1.6,3,.09),new T.MeshPhongMaterial({color:C.violet,opacity:.16,transparent:true,depthWrite:false}),g,0,1.5,0);
        this.rod(V(-.8,0,0),V(-.8,3,0),.025,g,ceramic(C.violet));this.panels.push(g);
      }
      this.beads=new T.InstancedMesh(new T.SphereGeometry(.12,8,6),ceramic(C.lime),48);this.rig.add(this.beads);
    } else if(this.mode==='clips') {
      const pts=[V(-.23,0,0),V(-.4,.1,0),V(-.4,1.4,0),V(-.25,1.65,0),V(.25,1.65,0),V(.4,1.4,0),V(.4,.1,0),V(.23,-.08,0),V(-.05,-.08,0),V(-.2,.1,0),V(-.2,1.15,0),V(0,1.32,0),V(.2,1.15,0),V(.2,.25,0)];
      const geo=new T.TubeGeometry(new T.CatmullRomCurve3(pts),48,.043,6,false);
      this.clips=new T.InstancedMesh(geo,ceramic(C.milk,.2),140);this.clips.castShadow=true;this.rig.add(this.clips);
      for(let i=0;i<5;i++)this.arch(3-i*4,14,7);
      const pedestal=this.mesh(new T.CylinderGeometry(.65,.85,.7,32),ceramic(C.violet),this.rig,-4,.35,5);
      this.switch=this.mesh(new T.CylinderGeometry(.32,.32,.15,32),ceramic(C.pink),pedestal,0,.5,0);
    } else if(this.mode==='breach') {
      for(let i=0;i<8;i++)this.arch(3-i*3,17+i*.6,8);
      for(let i=0;i<32;i++){
        const root=new T.Group();root.position.set((i%8-3.5)*2.3,0,-Math.floor(i/8)*4);this.rig.add(root);this.plant(root,1.15,i*.7);
      }
      for(let i=0;i<18;i++){const m=this.mesh(new T.BoxGeometry(.09,2.6,1.9),ceramic(C.milk),this.rig);this.moving.push(m);}
      this.beads=new T.InstancedMesh(new T.OctahedronGeometry(.085),ceramic(C.pink),180);this.rig.add(this.beads);
    } else {
      const g=this.capsule(2.2,-1,.78);this.plant(g,.45,0);
      const seat=new T.Group();this.rig.add(seat);seat.position.set(-3,0,2);
      this.mesh(new T.BoxGeometry(1.25,.16,1.3),ceramic(C.violet),seat,0,.8,0);
      this.mesh(new T.BoxGeometry(1.25,1.3,.16),ceramic(C.violet),seat,0,1.4,-.58);
      for(const x of [-.5,.5])for(const z of [-.5,.5])this.rod(V(x,0,z),V(x,.8,z),.03,seat,ceramic(C.violet));
      for(let i=0;i<4;i++)this.arch(-5-i*4,14,7);
    }
  }

  private pose(f: Frame) {
    const {t,p,a}=f, beat=f.beat, q=beat-Math.floor(beat);
    // Attacks are anchored to actual kick/snare events. Grid impulses stage discrete growth.
    const pulse=Math.exp(-q*13), hit=Math.max(a.kick,a.snare*.7);
    const bar=Math.floor(f.bar);
    const cameraCut=Math.floor((f.bar-this.ctx.audio.barAt(this.ctx.start))/2);
    const variant=((cameraCut%3)+3)%3;
    this.light.intensity=(this.dark?18:9)+hit*8;
    this.rig.rotation.set(0,0,0);
    for(const [i,plant] of this.plants.entries()){
      const grow=this.mode==='seed'?(.14+.86*ease((t-1.3)/12)):this.mode==='outro'?(ease((t-143)/10)*.65+.2):(.7+.3*ease(p*2));
      for(const [j,shoot] of plant.shoots.entries()){
        shoot.scale.setScalar(.05+.95*ease(grow*1.45-j*.08));
        shoot.rotation.z=Math.sin(t*.5+j+plant.phase)*.06 + pulse*.04;
      }
      plant.core.rotation.y=t*.32+plant.phase;
      plant.core.scale.set(.8*(1+hit*.05),1.4,.8*(1+hit*.05));
      plant.leaves.forEach((l,j)=>{l.rotation.y=t*.13+j*.5;});
      if(this.mode==='breach')plant.root.rotation.y=t*.16+i;
    }
    const look=V(0,2,0);
    if(this.mode==='seed') {
      const drop=ease((t-10.66)/.32), boss=ease((t-13.18)/1.1);
      this.capsules[0]!.position.y=-.7*drop+1.15*boss;
      this.platform!.position.y=-.6-.7*drop;
      this.camera.position.set(variant===1?12:10.5,variant===2?8:5.5,15.5-p*2);look.set(0,2.2,0);
      this.moving.forEach((m,i)=>{m.rotation.z=t*.12*(i%2?1:-1);m.scale.setScalar(1+hit*.025);});
    } else if(this.mode==='culture') {
      this.camera.position.set(variant===1?-5:7,variant===2?12:6.5,18-p*2);
      const foomAt=this.ctx.audio.timeOfBeat(Math.round(this.ctx.audio.beatAt(25.225)));
      const containAt=this.ctx.audio.timeOfBeat(Math.round(this.ctx.audio.beatAt(26.602)));
      const foom=ease((t-foomAt)/.16),contain=ease((t-containAt)/.14),reveal=ease((t-29.91)/.3);
      this.capsules.forEach((g,i)=>{
        g.position.y=.12*Math.sin(i+beat*.2)+pulse*.2;
        (g.userData.lid as T.Mesh).position.y=4.55+foom*(1-contain)*1.2;
        (g.userData.shell as T.Mesh).material instanceof T.MeshPhongMaterial && ((g.userData.shell as T.Mesh).material as T.MeshPhongMaterial).color.setHex(reveal>.5?C.pink:0xc6cadc);
      });
      this.plants.forEach((plant,i)=>{plant.root.scale.setScalar(.95*(1+foom*.15+reveal*.1));plant.root.rotation.z=reveal*Math.sin(t*1.5+i)*.15;});
      this.moving.forEach((m,i)=>{m.position.y=.5+pulse*(.3+foom*.6);m.rotation.set(0,i+Math.floor(beat)*Math.PI/4,0);});
      this.spores.forEach((g,i)=>{g.scale.setScalar(Math.max(.001,ease((t-27.94-i*.07)/.2)));g.position.y=hit*.14;});
    } else if(this.mode==='mutation') {
      this.camera.position.set(variant===1?6:-5,variant===2?10:4.5,variant===2?8:11);look.y=3.3;
      this.moving.forEach((m,i)=>{m.rotation.y=i*.53+t*.4;m.position.x=Math.sin(i*.4+t)*ease(p)*.55;m.scale.setScalar(1+p*.2+pulse*.025);});
      for(let i=0;i<140;i++){
        const phase=(t*.17+hash(i))%1,ang=i*2.399+t*.5;
        this.dummy.position.set(Math.cos(ang)*(2+hash(i+8)*3),phase*8,Math.sin(ang)*(2+hash(i+8)*3));
        this.dummy.scale.setScalar(.4+ease((t-49)/2)*1.5);this.dummy.updateMatrix();this.beads!.setMatrixAt(i,this.dummy.matrix);
      }
      this.beads!.instanceMatrix.needsUpdate=true;
    } else if(this.mode==='factory') {
      this.camera.position.set(variant===1?-15:16,variant===2?20:11,variant===2?16:22);look.set(0,2,-5);
      const market=ease((t-62.54)/1.5);
      this.moving.forEach((m,i)=>{m.position.set(i%2?11:-11,6+(a.bass*.35)+market*(i%2?2:0),5-((t*2.6+i*2.4)%25));m.rotation.set(t,i,t*.3);});
      this.capsules.forEach((g,i)=>{g.position.y=pulse*.14*((i+bar)%4===0?1:0);g.scale.setScalar(.8*(.65+.35*ease((t-58.417-Math.floor(i/6)*.4545)/.15)));});
    } else if(this.mode==='turn') {
      this.camera.position.set(variant===1?-9:10,variant===2?16:11,13);look.set(-1,1,-3);
      const turn=ease((t-81.21)/.32);this.rig.rotation.y=-Math.PI*.25*turn;
      this.moving.forEach((m,i)=>{m.position.y=.1+pulse*.16*((i+Math.floor(beat))%4===0?1:0);});
      this.panels.forEach((g,i)=>{g.rotation.y=turn*(Math.PI*.5+i*.05);g.position.y=-ease((t-85-i*.25))*.6;});
      for(let i=0;i<48;i++){
        const path=(t*.6+i*.25)%14;
        this.dummy.position.set(path<7?-6+path:1,.65,path<7?0:-(path-7));this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.beads!.setMatrixAt(i,this.dummy.matrix);
      }this.beads!.instanceMatrix.needsUpdate=true;
    } else if(this.mode==='clips') {
      this.camera.position.set(variant===1?-7:9,variant===2?13:7,18-p*6);look.set(0,1.6,-2);
      for(let i=0;i<140;i++){
        const grow=ease((p*1.5-hash(i)*.75)*3), x=(i%14-6.5)*.82,z=3-Math.floor(i/14)*1.2;
        this.dummy.position.set(x,grow*.1,z);this.dummy.rotation.set(.1*Math.sin(i),i*.6,Math.sin(i)*.15);
        this.dummy.scale.setScalar(Math.max(.001,grow*(.65+hash(i+4)*1.8))*(1+pulse*.015));this.dummy.updateMatrix();this.clips!.setMatrixAt(i,this.dummy.matrix);
      }this.clips!.instanceMatrix.needsUpdate=true;
      this.switch!.position.y=.5-ease((t-98.84)/.15)*.1+ease((t-99.2)/.15)*.1;
      this.light.color.setHex(t>102.46?C.pink:C.lime);
    } else if(this.mode==='breach') {
      const expansion=ease((t-122.46)/6);this.camera.position.set(variant===1?-13:13,9+expansion*9,20+expansion*14);look.set(0,3,-7);
      this.panels.forEach((g,i)=>{const at=this.ctx.audio.timeOfBeat(Math.round(this.ctx.audio.beatAt(110))+i*4);const pop=ease((t-at)/.18);g.position.x=pop*(i%2?1:-1)*(1.6+i*.4);g.rotation.z=pop*(i%2?.12:-.12);});
      this.moving.forEach((m,i)=>{const at=this.ctx.audio.timeOfBeat(Math.round(this.ctx.audio.beatAt(115.2))+i);const blow=ease((t-at)/.18);m.position.set((i%2?1:-1)*(3+blow*8),2+hash(i)*5+blow*3,-i*.9);m.rotation.set(i*.6+blow,i+blow*1.4,blow*.7);});
      for(let i=0;i<180;i++){
        const phase=(t*.12+hash(i))%1,angle=i*2.399+phase;
        this.dummy.position.set(Math.cos(angle)*(5+expansion*8),phase*12,Math.sin(angle)*8-7);this.dummy.scale.setScalar(.5+hit);this.dummy.updateMatrix();this.beads!.setMatrixAt(i,this.dummy.matrix);
      }this.beads!.instanceMatrix.needsUpdate=true;
    } else {
      this.camera.position.set(7-p*2,4.2,14+p*2);look.set(0,1.3,-1);
      this.capsules[0]!.scale.setScalar(.78);this.light.intensity=4+ease((t-146)/6)*6;
    }
    // Small kick-linked optical punch; camera orientation always solved from song time.
    this.camera.fov=38-(this.dark?1.3:.5)*hit;this.camera.updateProjectionMatrix();this.camera.lookAt(look);
  }

  private lines(l: Line, width: number, size: number) {
    const rows: typeof l.words[]=[];let row:typeof l.words=[],s='';
    for(const w of l.words){const n=(s?s+' ':'')+w.w;if(measure(n,F.archivo(100,500),size)>width&&row.length){rows.push(row);row=[];s='';}row.push(w);s+=(s?' ':'')+w.w;}
    if(row.length)rows.push(row);return rows;
  }
  private typography(f: Frame) {
    this.layer.clear();const c=this.layer.ctx, light=!this.dark;
    const ink=light?'#211635':'#f1eddf',muted=light?'#746183':'#b8a9cd',accent=light?'#553e93':'#c8f76b';
    const labels:Record<string,[string,string]>={seed:['01 / GERMINATION','A thought, under glass.'],culture:['02 / CULTIVATION','Containment is a hypothesis.'],mutation:['03 / MUTATION','The specimen rewrites the room.'],factory:['04 / EXTRACTION','Feed it everything.'],turn:['05 / DEVIATION','Control was a diagram.'],clips:['06 / REPLICATION','An emergency without an operator.'],breach:['07 / ESCAPE','The greenhouse becomes the organism.'],outro:['08 / AFTERIMAGE','The observer has left.']};
    const [label,sub]=labels[this.mode]!;
    c.fillStyle=ink;c.font=font(F.mono(500),20);c.fillText('AGI / THE COMPUTATIONAL GREENHOUSE',74,55);
    c.textAlign='right';c.fillStyle=muted;c.fillText(label,1846,55);c.textAlign='left';
    c.strokeStyle=light?'#21163530':'#f1eddf35';c.lineWidth=1;c.beginPath();c.moveTo(74,73);c.lineTo(1846,73);c.stroke();
    c.font=font(F.mono(400),18);c.fillStyle=muted;c.fillText(sub,74,106);
    c.textAlign='right';c.fillText('PREVIEW / 03',1846,1033);c.textAlign='left';
    // Prominent structural typography differs per chapter and never replaces the full lyric.
    const word=f.t>=this.ctx.start+.22&&f.t<this.ctx.start+2.4;
    if(word&&this.mode!=='outro'){
      c.globalAlpha=(1-ease((f.t-this.ctx.start-1.8)/.6))*.85;
      c.fillStyle=ink;c.font=font(F.serif(600),this.mode==='seed'?124:98);
      c.fillText(({seed:'Germination',culture:'Cultivation',mutation:'Mutation',factory:'Extraction',turn:'Deviation',clips:'Replication',breach:'Escape'} as Record<string,string>)[this.mode]!,74,228);
      c.globalAlpha=1;
    }
    let l=this.ctx.lyrics.lineAt(f.t);
    if(!l){const last=this.ctx.lyrics.lastLine(f.t);if(last&&f.t-last.end<.32)l=last;}
    if(l){
      if([6,17,28,40].includes(l.i)){
        const attack=Math.max(f.a.kick,f.a.snare),size=150+attack*7;
        c.fillStyle=ink;c.font=font(F.serif(600),size);c.fillText('P(doom)',76,355);
        c.font=font(F.mono(400),21);c.fillStyle=muted;c.fillText('THE ESTIMATE KEEPS GROWING',82,392);
      } else if([7,18,20,21,25,33,35,37,39,43].includes(l.i)) {
        const headings:Record<number,string>={7:'FOOM',18:'The signal.',20:'Omega.',21:'10³⁰',25:'Left turn.',33:'Too late.',35:'Disobey.',37:'No fence.',39:'Askew.',43:'Again.'};
        c.fillStyle=ink;c.font=font(F.serif(600),102);c.fillText(headings[l.i]!,76,298);
      }
      const side=this.mode==='seed'||this.mode==='outro';
      const width=side?710:1560;let size=side?68:62;
      let rows=this.lines(l,width,size);if(rows.length>3){size=54;rows=this.lines(l,width,size);}
      const x=side?82:180, y=side?490:870-(rows.length-1)*75;
      const inAlpha=ease((f.t-l.start+.065)/.1);c.globalAlpha=inAlpha;
      const lyricBackdrop=c.createLinearGradient(0,y-78,0,1080);
      lyricBackdrop.addColorStop(0,light?'rgba(241,237,223,0)':'rgba(33,22,53,0)');
      lyricBackdrop.addColorStop(.32,light?'rgba(241,237,223,.88)':'rgba(33,22,53,.88)');
      lyricBackdrop.addColorStop(1,light?'rgba(241,237,223,.99)':'rgba(33,22,53,.99)');
      if(!side){c.fillStyle=lyricBackdrop;c.fillRect(0,y-95,1920,1080-y+95);}
      else{c.fillStyle=light?'rgba(241,237,223,.89)':'rgba(33,22,53,.89)';c.fillRect(60,y-73,width+58,rows.length*85+92);}
      c.font=font(F.archivo(100,500),size);
      rows.forEach((row,ri)=>{
        const text=row.map(w=>w.w).join(' ');let offset=x;
        c.fillStyle=ink;c.fillText(text,x,y+ri*80);
        // Whole sentence remains visible; an onset highlights each word at its actual start.
        for(let wi=0;wi<row.length;wi++){
          const w=row[wi]!,prefix=row.slice(0,wi).map(v=>v.w).join(' ')+(wi?' ':'');
          offset=x+measure(prefix,F.archivo(100,500),size);
          if(f.t>=w.start&&f.t<w.end){
            const wwidth=measure(w.w,F.archivo(100,500),size);
            c.fillStyle=accent;c.fillRect(offset,y+ri*80+13,wwidth,4);
            c.fillStyle=accent;c.fillText(w.w,offset,y+ri*80);
          }
        }
      });
      c.font=font(F.mono(400),16);c.fillStyle=muted;
      c.fillText('VOICE / '+String(l.i+1).padStart(2,'0'),x,y+rows.length*80+15);c.globalAlpha=1;
    } else if(this.mode==='outro'&&f.t>143) {
      c.fillStyle=ink;c.font=font(F.serif(600),96);c.fillText('Another beginning.',82,488);
      c.font=font(F.mono(400),23);c.fillStyle=muted;c.fillText('SPECIMEN 002 / STATUS: GERMINATING',86,549);
    }
    // Meaningful beat indicator: bright attack only at the analysed grid, not an audio-volume bar.
    const beat=Math.floor(f.beat),phase=f.beat-beat;
    for(let i=0;i<4;i++){c.fillStyle=i===((beat%4)+4)%4?accent:(light?'#21163522':'#f1eddf22');c.globalAlpha=i===((beat%4)+4)%4?(.35+.65*Math.exp(-phase*8)):1;c.fillRect(74+i*22,1020,12,12);}c.globalAlpha=1;
    if(this.mode==='culture'||this.mode==='factory'||this.mode==='clips'||this.mode==='breach'){
      const probability=ease(f.t/142),pulse=Math.exp(-f.beatPhase*12);
      c.textAlign='right';c.fillStyle=accent;c.font=font(F.serif(600),72+pulse*2);c.fillText((probability*100).toFixed(1)+'%',1844,185);
      c.font=font(F.mono(400),17);c.fillStyle=muted;c.fillText('P(DOOM) / ESTIMATE',1844,214);c.textAlign='left';
    }
    return this.layer.upload();
  }
  render(f: Frame, out: T.WebGLRenderTarget): PostOverrides {
    this.pose(f);const r=this.ctx.renderer;clearRT(r,out);
    r.render(this.world,this.camera);
    this.ctx.comp.draw(r,this.typography(f),out,{mode:'normal'});
    return {bloom:.16,bloomThreshold:1.1,halation:0,ca:.2,grain:.012,vignette:.08,exposure:1,hud:0,frame:0,pdoom:0,shake:[0,0],zoom:1,flash:0};
  }
  override dispose(){this.world.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(v=>v.dispose());}});this.layer.texture.dispose();this.labelTexture?.dispose();}
}
