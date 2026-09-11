import {WIDTH,HEIGHT,RISE,floors,connectors} from './building.mjs';
export const STEP=.18,COLS=Math.ceil(WIDTH/STEP),ROWS=Math.ceil(HEIGHT/STEP),SIZE=COLS*ROWS;
export function clearanceAt(x,y,floor=1){let d=Math.min(x,y,WIDTH-x,HEIGHT-y);for(const r of floors[floor].obstacles){const dx=Math.max(r.x-x,0,x-r.x-r.w),dy=Math.max(r.y-y,0,y-r.y-r.h);d=Math.min(d,Math.hypot(dx,dy));if(d===0)return 0;}return d;}
export const clearance=new Float32Array(SIZE*2);
export function point(i){const j=i%SIZE;return [(j%COLS+.5)*STEP,(Math.floor(j/COLS)+.5)*STEP,Math.floor(i/SIZE)+1]}
for(let i=0;i<clearance.length;i++)clearance[i]=clearanceAt(...point(i));
export function segmentClear(a,b,radius){if((a[2]||1)!==(b[2]||1))return false;const n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.025));for(let j=0;j<=n;j++){const t=j/n;if(clearanceAt(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]||1)<radius)return false;}return true;}
export function nearest(p,radius){let found=-1,best=.42;const cx=Math.floor(p[0]/STEP),cy=Math.floor(p[1]/STEP),offset=((p[2]||1)-1)*SIZE;for(let y=Math.max(0,cy-3);y<=Math.min(ROWS-1,cy+3);y++)for(let x=Math.max(0,cx-3);x<=Math.min(COLS-1,cx+3);x++){const i=offset+y*COLS+x,q=point(i),d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(clearance[i]>=radius&&d<best&&segmentClear(p,q,radius)){best=d;found=i;}}return found;}
class Heap{constructor(){this.a=[]}push(i,f){const v={i,f};let k=this.a.length;this.a.push(v);while(k){const p=(k-1)>>1;if(this.a[p].f<=f)break;this.a[k]=this.a[p];k=p;}this.a[k]=v;}pop(){const top=this.a[0],v=this.a.pop();if(this.a.length){let k=0;while(k*2+1<this.a.length){let c=k*2+1;if(c+1<this.a.length&&this.a[c+1].f<this.a[c].f)c++;if(this.a[c].f>=v.f)break;this.a[k]=this.a[c];k=c;}this.a[k]=v;}return top}get size(){return this.a.length}}
const moves=[[-1,0,1],[1,0,1],[0,-1,1],[0,1,1],[-1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[1,-1,Math.SQRT2],[1,1,Math.SQRT2]];
function metric(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],((a[2]||1)-(b[2]||1))*RISE)}
export function route(start,end,{radius=.22,weight=0,transfer='any',allowTransfers=true}={}){
 start=[start[0],start[1],start[2]||1];end=[end[0],end[1],end[2]||1];
 const s=nearest(start,radius),t=nearest(end,radius);if(s<0||t<0)return {error:'A selected point is too close to an obstacle. Move it into open space or reduce the clearance buffer.'};
 const links=new Map();if(allowTransfers)for(const c of connectors){if(transfer==='lift'&&c.type!=='lift'||transfer==='stairs'&&c.type!=='stairs')continue;const a=nearest(c.a,radius),b=nearest(c.b,radius);if(a<0||b<0)continue;const dist=metric(point(a),point(b))*(c.type==='stairs'?1.3:1);links.set(a,{target:b,connector:c,distance:dist});links.set(b,{target:a,connector:c,distance:dist});}
 const g=new Float64Array(clearance.length);g.fill(Infinity);const prev=new Int32Array(g.length);prev.fill(-1);const via=new Map(),closed=new Uint8Array(g.length),heap=new Heap();g[s]=0;heap.push(s,0);let expanded=0;
 function relax(i,j,cost,connector=null){if(closed[j])return;const ng=g[i]+cost;if(ng<g[j]){g[j]=ng;prev[j]=i;if(connector)via.set(j,connector);else via.delete(j);heap.push(j,ng+metric(point(j),point(t)));}}
 while(heap.size){const {i}=heap.pop();if(closed[i])continue;if(i===t)break;closed[i]=1;expanded++;const local=i%SIZE,x=local%COLS,y=Math.floor(local/COLS),offset=i-local;
 for(const [dx,dy,m] of moves){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;const j=offset+ny*COLS+nx;if(closed[j]||clearance[j]<radius)continue;if(dx&&dy&&(clearance[offset+y*COLS+nx]<radius||clearance[offset+ny*COLS+x]<radius))continue;
 const minC=Math.min(clearance[i],clearance[j]);if(minC-STEP*m/2<radius&&!segmentClear(point(i),point(j),radius))continue;
 relax(i,j,STEP*m*(1+weight/Math.pow(.3+Math.max(0,minC-radius),2)));}
 const link=links.get(i);if(link)relax(i,link.target,link.distance,link.connector);
 }
 if(!Number.isFinite(g[t]))return {error:'No connected route with these settings. Try a smaller buffer or another lift/stair option. Unverified doorways remain closed in this model.'};
 const ids=[];for(let j=t;j!==-1;j=prev[j]){ids.push(j);if(j===s)break;}ids.reverse();
 const raw=[start,...ids.map(point),end],pts=[];
 for(let i=0;i<raw.length;i++){if(i>0&&i<raw.length-1){const a=pts.at(-1),b=raw[i],c=raw[i+1];if(a[2]===b[2]&&b[2]===c[2]&&Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))<1e-8)continue;}pts.push(raw[i]);}
 const transitions=[];for(let k=1;k<ids.length;k++)if(Math.floor(ids[k]/SIZE)!==Math.floor(ids[k-1]/SIZE)){const c=via.get(ids[k]);transitions.push({...c,from:point(ids[k-1]),to:point(ids[k]),distance:links.get(ids[k-1]).distance});}
 let length=0,minClearance=Infinity,average=0,total=0;const segments=[];let current=null;
 for(const p of pts){if(!current||current.floor!==p[2]){current={floor:p[2],points:[]};segments.push(current)}current.points.push(p);}
 for(const seg of segments)for(let i=1;i<seg.points.length;i++){const a=seg.points[i-1],b=seg.points[i],d=metric(a,b);length+=d;const n=Math.max(1,Math.ceil(d/.05));for(let k=0;k<=n;k++){const c=clearanceAt(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n,a[2]);minClearance=Math.min(minClearance,c);average+=c;total++;}}
 const verticalLength=transitions.reduce((s,t)=>s+t.distance,0);return {points:pts,segments,transitions,length:length+verticalLength,walkingLength:length,verticalLength,minClearance,meanClearance:total?average/total:clearanceAt(...start),cost:g[t],expanded};
}
