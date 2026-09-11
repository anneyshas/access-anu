import {WIDTH,HEIGHT,floors,connectors,entrances,defaultDestination} from './building.mjs';
const $=id=>document.getElementById(id),canvas=$('map'),ctx=canvas.getContext('2d');
let start=[...entrances[0].point],end=[...defaultDestination],selection='start',mode='clearance',best=null,short=null;
let yaw=-.2,pitch=.96,zoom=1,low=true,top=false,view='all',cw=800,ch=700,scale=12,centre=[0,0],hover=null,drag=null,moved=false,renderFloor=1,requestId=0,timer;
const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
function clearanceAt(x,y,floor=1){let d=Math.min(x,y,WIDTH-x,HEIGHT-y);for(const r of floors[floor].obstacles){d=Math.min(d,Math.hypot(Math.max(r.x-x,0,x-r.x-r.w),Math.max(r.y-y,0,y-r.y-r.h)));if(d===0)return 0;}return d;}
function pointName(p){if(!p)return 'Choose on map';const entry=entrances.find(e=>e.point[2]===p[2]&&Math.hypot(e.point[0]-p[0],e.point[1]-p[1])<.1);return `L${p[2]} · ${entry?entry.name:p[0].toFixed(1)+', '+p[1].toFixed(1)+' u'}`;}
function updateSelection(){ $('startButton').classList.toggle('active',selection==='start');$('endButton').classList.toggle('active',selection==='end');$('startText').textContent=pointName(start);$('endText').textContent=pointName(end);if(start)$('startFloor').value=String(start[2]);if(end)$('endFloor').value=String(end[2]);$('instruction').innerHTML=`<span>${selection==='start'?'A':'B'}</span> Click ${view==='all'?'either floor':'Level '+view} to set your ${selection==='start'?'start':'destination'}`;}
function setFloor(v){view=v;zoom=1;hover=null;$('showAll').classList.toggle('selected',v==='all');$('show1').classList.toggle('selected',v===1);$('show2').classList.toggle('selected',v===2);$('mapEyebrow').textContent=v==='all'?'LEVELS ONE + TWO':'LEVEL '+(v===1?'ONE':'TWO');$('mapHeading').textContent=v==='all'?'Two connected levels':floors[v].name;updateSelection();draw();}
function calculate(){clearTimeout(timer);const id=++requestId;best=null;short=null;$('message').textContent='';$('routeResult').hidden=true;
 if(!start||!end){$('navigate').disabled=false;$('navigate').innerHTML='Find route <span>→</span>';$('message').textContent='Choose a start and destination on either floor.';draw();return;}
 $('navigate').disabled=true;$('navigate').textContent='Finding your route…';draw();
 timer=setTimeout(()=>worker.postMessage({id,start,end,options:{radius:+$('radius').value,weight:mode==='shortest'?0:+$('weight').value,transfer:$('transfer').value}}),90);
}
worker.onmessage=({data})=>{if(data.id!==requestId)return;$('navigate').disabled=false;$('navigate').innerHTML='Find route <span>→</span>';if(data.error){$('message').textContent='The route could not be calculated. '+data.error;return;}best=data.best;short=data.shortest;showResult();draw();};
worker.onerror=()=>{$('navigate').disabled=false;$('navigate').textContent='Retry route';$('message').textContent='The route engine could not load. Refresh this page and try again.'};
function showResult(){ $('routeResult').hidden=!!best.error;$('shortLegend').style.display=mode==='shortest'||+$('weight').value===0?'none':'flex';if(best.error){$('message').textContent=best.error;return;}
 $('length').textContent=best.length.toFixed(1)+' u';$('space').textContent=best.meanClearance.toFixed(1)+' u';$('routeTitle').textContent=best.transitions.length?'Your route across floors':mode==='shortest'?'Shortest route':'Route with more clearance';
 const extra=short.error?0:best.length-short.length;$('comparison').textContent=(mode==='shortest'?'Shortest modelled route.':`${Math.max(0,extra).toFixed(1)} u longer than shortest.`)+` Minimum floor clearance: ${best.minClearance.toFixed(2)} u.`;
 const j=$('journey');j.replaceChildren();for(let i=0;i<best.segments.length;i++){const seg=best.segments[i],b=document.createElement('button');b.textContent=i===best.segments.length-1?`Level ${seg.floor} · continue to destination B`:`Level ${seg.floor} · walk to ${best.transitions[i]?.name||'the connection'}`;b.onclick=()=>setFloor(seg.floor);j.append(b);if(best.transitions[i]){const t=best.transitions[i],b=document.createElement('button');b.className='transferstep';b.textContent=`${t.type==='lift'?'↕':'↗'} ${t.name} → Level ${t.to[2]}`;b.onclick=()=>setFloor('all');j.append(b);}}
}
function visibleFloors(){return view==='all'?[1,2]:[view]}
function offset(f){if(view!=='all')return [0,0,0];return f===1?[0,0,0]:[top?WIDTH+7:WIDTH*.96,top?0:-2,top?0:13];}
function rawProjection(x,y,z=0,f=renderFloor){const o=offset(f);x=x-WIDTH/2+o[0];y=y-HEIGHT/2+o[1];z+=o[2];return [Math.cos(yaw)*x-Math.sin(yaw)*y,Math.sin(pitch)*(Math.sin(yaw)*x+Math.cos(yaw)*y)-Math.cos(pitch)*z];}
function project(x,y,z=0,f=renderFloor){const p=rawProjection(x,y,z,f);return [cw/2+(p[0]-centre[0])*scale,ch/2+(p[1]-centre[1])*scale];}
function unproject(sx,sy,f){const o=offset(f),u=(sx-cw/2)/scale+centre[0],v=((sy-ch/2)/scale+centre[1]+Math.cos(pitch)*o[2])/Math.sin(pitch);return [Math.cos(yaw)*u+Math.sin(yaw)*v+WIDTH/2-o[0],-Math.sin(yaw)*u+Math.cos(yaw)*v+HEIGHT/2-o[1],f];}
function hit(sx,sy){for(const f of [...visibleFloors()].reverse()){const p=unproject(sx,sy,f);if(p[0]>=0&&p[1]>=0&&p[0]<=WIDTH&&p[1]<=HEIGHT)return p;}return null;}
function depth(x,y,z){return Math.cos(pitch)*(Math.sin(yaw)*(x-WIDTH/2)+Math.cos(yaw)*(y-HEIGHT/2))+Math.sin(pitch)*z}
function poly(vertices,fill,stroke,width=1){ctx.beginPath();vertices.forEach((v,i)=>{const p=project(...v);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function line(a,b,color,width=1,dash=[]){const p=project(...a),q=project(...b);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
function path(points,color,width,dash=[]){if(!points?.length)return;ctx.beginPath();points.forEach((p,i)=>{const s=project(p[0],p[1],.06,p[2]);i?ctx.lineTo(...s):ctx.moveTo(...s)});ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([])}
function floorText(text,x,y,size=10,color='#7b8e9b'){const p=project(x,y,.07);ctx.font=`600 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,...p)}
function marker(p,label,color){if(!p||p[2]!==renderFloor)return;const q=project(p[0],p[1],.1,p[2]);ctx.save();ctx.shadowColor=color+'40';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(...q,11,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.shadowBlur=0;ctx.lineWidth=2.5;ctx.strokeStyle='#fff';ctx.stroke();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 12px system-ui';ctx.fillText(label,q[0],q[1]+.5);ctx.restore()}
function renderLayer(f){renderFloor=f;const {obstacles,doors,labels}=floors[f],accent=f===1?'#168add':'#168f86';
 poly([[.4,.8,-.3],[WIDTH+.4,.8,-.3],[WIDTH+.4,HEIGHT+.8,-.3],[.4,HEIGHT+.8,-.3]],'#193d5013');
 poly([[0,0,-.3],[WIDTH,0,-.3],[WIDTH,HEIGHT,-.3],[0,HEIGHT,-.3]],f===1?'#9cbbce':'#90b9b0');
 poly([[0,0,0],[WIDTH,0,0],[WIDTH,HEIGHT,0],[0,HEIGHT,0]],f===1?'#fcfdfe':'#f7fcfa',f===1?'#aebfcc':'#a1c5bb',1.2);
 if(f===1)poly([[.3,.3,.001],[38.6,.3,.001],[38.6,10.45,.001],[.3,10.45,.001]],'#edf2f6');
 for(let x=2;x<WIDTH;x+=2)line([x,0,.003],[x,HEIGHT,.003],'#e3ebef',.5);for(let y=2;y<HEIGHT;y+=2)line([0,y,.003],[WIDTH,y,.003],'#e3ebef',.5);
 for(const d of doors)line([...d.a,.018],[...d.b,.018],'#4eae9d',2.5);
 if(short&&!short.error&&mode!=='shortest'&&+$('weight').value>0)for(const seg of short.segments.filter(s=>s.floor===f))path(seg.points,'#c99546',1.6,[4,4]);
 if(best&&!best.error)for(const seg of best.segments.filter(s=>s.floor===f)){path(seg.points,accent+'25',9);path(seg.points,accent,3)}
 const faces=[];
 for(const r of obstacles){const z=top?.05:r.type==='wall'?(low?.7:2.5):r.type==='pillar'?(low?1.15:2.8):r.type==='lift'?1.05:r.type==='void'?.03:.28;
 const colors=r.type==='pillar'?['#36536c','#223d55','#456680']:r.type==='lift'?['#81bccd','#4e92ab','#aed4df']:r.type==='stairs'?['#c6d5dd','#a6bac6','#dce5ea']:r.type==='void'?['#a7b8c2','#92a6b2','#c2cfd7']:['#c4d0d9','#9db0bf','#edf2f5'];
 const {x,y,w,h}=r,v=[[x,y,0],[x+w,y,0],[x+w,y+h,0],[x,y+h,0],[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]];
 for(const [ids,c] of [[[0,1,5,4],colors[1]],[[1,2,6,5],colors[0]],[[2,3,7,6],colors[0]],[[3,0,4,7],colors[1]],[[4,5,6,7],colors[2]]]){const pts=ids.map(i=>v[i]);faces.push({pts,color:c,z:pts.reduce((s,p)=>s+depth(...p),0)/4});}}
 faces.sort((a,b)=>a.z-b.z);for(const face of faces)poly(face.pts,face.color,'#657f9225',.5);
 for(const r of obstacles){if(r.type==='stairs'){for(let i=1;i<11;i++){if(r.w>r.h)line([r.x+r.w*i/11,r.y,.3],[r.x+r.w*i/11,r.y+r.h,.3],'#8ca4b3',.65);else line([r.x,r.y+r.h*i/11,.3],[r.x+r.w,r.y+r.h*i/11,.3],'#8ca4b3',.65)}}if(r.type==='lift'){const q=project(r.x+r.w/2,r.y+r.h/2,top?.1:1.1);ctx.font='600 9px system-ui';ctx.fillStyle='#2a6078';ctx.textAlign='center';ctx.fillText('LIFT',q[0],q[1]);}}
 for(const l of labels)floorText(l.text,l.x,l.y,Math.max(7,Math.min(10,scale*.8)),l.text.includes('UNVERIFIED')?'#8b9ba7':'#7a909d');
 marker(start,'A','#167cbd');marker(end,'B','#137f75');
 // A small floor label sits just below the slab in both stacked and focused views.
 const p=project(2,HEIGHT+1.3,.1);ctx.font='700 13px system-ui';ctx.textAlign='left';ctx.fillStyle=f===1?'#2e6b95':'#2d7f6a';ctx.fillText(`0${f}  LEVEL ${f===1?'ONE':'TWO'}`,p[0],p[1]);
}
function bridge(t,ghost=false){const a=project(t.from[0],t.from[1],.2,t.from[2]),b=project(t.to[0],t.to[1],.2,t.to[2]);ctx.save();ctx.beginPath();ctx.moveTo(...a);ctx.bezierCurveTo(a[0]+25,a[1]-35,b[0]-25,b[1]+35,...b);ctx.strokeStyle=ghost?'#c9954670':'#247a9c';ctx.lineWidth=ghost?1.2:2.5;ctx.setLineDash(ghost?[3,6]:[6,5]);ctx.stroke();ctx.setLineDash([]);
 if(!ghost){for(const p of [a,b]){ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#247a9c';ctx.lineWidth=2;ctx.stroke();}const text=`${t.type==='lift'?'↕':'↗'} ${t.name}`,x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;ctx.font='600 11px system-ui';const w=ctx.measureText(text).width+18;ctx.fillStyle='#fff';ctx.strokeStyle='#b8d4df';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x-w/2,y-12,w,25,6);ctx.fill();ctx.stroke();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#2b647e';ctx.fillText(text,x,y+1);}
 ctx.restore();}
function draw(){if(!cw||!ch)return;const dpr=Math.min(window.devicePixelRatio||1,2);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
 const vs=visibleFloors(),bounds=[];for(const f of vs)for(const x of [0,WIDTH])for(const y of [0,HEIGHT+2])for(const z of [0,3])bounds.push(rawProjection(x,y,z,f));
 const xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);centre=[(minX+maxX)/2,(minY+maxY)/2];scale=Math.min((cw-65)/(maxX-minX),(ch-48)/(maxY-minY))*zoom;
 for(const f of vs)renderLayer(f);
 if(view==='all'){if(short&&!short.error&&mode!=='shortest'&&+$('weight').value>0)for(const t of short.transitions)bridge(t,true);if(best&&!best.error)for(const t of best.transitions)bridge(t);}
 if(hover&&!drag&&vs.includes(hover[2])){const q=project(hover[0],hover[1],.1,hover[2]),ok=clearanceAt(...hover)>=+$('radius').value;ctx.beginPath();ctx.arc(...q,7,0,Math.PI*2);ctx.strokeStyle=ok?'#1686d1':'#c67451';ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);}}
function resize(){const box=canvas.getBoundingClientRect();cw=box.width;ch=box.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);draw()}
new ResizeObserver(resize).observe(canvas);
function place(p){if(!p||clearanceAt(...p)<+$('radius').value){$('message').textContent='Choose open floor space, away from walls, stairs and the stairwell void.';return;}if(selection==='start'){start=p;selection='end'}else end=p;updateSelection();calculate()}
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top,yaw,pitch,pointer:e.pointerId};moved=false;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;hover=hit(x,y);if(drag){const dx=x-drag.x,dy=y-drag.y;if(Math.hypot(dx,dy)>5)moved=true;if(moved){yaw=drag.yaw+dx*.007;if(!top)pitch=Math.max(.45,Math.min(1.45,drag.pitch+dy*.005));}}draw()});
canvas.addEventListener('pointerup',e=>{if(!drag)return;const r=canvas.getBoundingClientRect(),p=hit(e.clientX-r.left,e.clientY-r.top);drag=null;if(!moved)place(p);draw()});
canvas.addEventListener('pointercancel',()=>{drag=null;hover=null;draw()});canvas.addEventListener('pointerleave',()=>{hover=null;draw()});canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.55,Math.min(2.7,zoom*Math.exp(-e.deltaY*.001)));draw()},{passive:false});
$('startButton').onclick=()=>{selection='start';updateSelection()};$('endButton').onclick=()=>{selection='end';updateSelection()};
for(const key of ['start','end'])$(key+'Floor').onchange=()=>{selection=key;if(key==='start')start=null;else end=null;setFloor(+$(key+'Floor').value);calculate()};
$('showAll').onclick=()=>setFloor('all');$('show1').onclick=()=>setFloor(1);$('show2').onclick=()=>setFloor(2);
$('swap').onclick=()=>{[start,end]=[end,start];updateSelection();calculate()};$('clear').onclick=()=>{start=end=null;selection='start';updateSelection();calculate()};$('navigate').onclick=calculate;$('transfer').onchange=calculate;
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));$('preference').classList.toggle('disabled',mode==='shortest');$('weight').disabled=mode==='shortest';calculate()};
$('weight').oninput=()=>{$('weightValue').textContent=+$('weight').value===0?'Direct':+$('weight').value<5?'Balanced':'More space';calculate()};$('radius').oninput=()=>{$('radiusValue').textContent=(+$('radius').value).toFixed(2)+' u';calculate()};
function setView(v){top=v;pitch=v?Math.PI/2:.96;yaw=v?0:-.2;zoom=1;$('view2d').classList.toggle('selected',v);$('view3d').classList.toggle('selected',!v);draw()}
$('view3d').onclick=()=>setView(false);$('view2d').onclick=()=>setView(true);$('resetView').onclick=()=>setView(top);$('zoomIn').onclick=()=>{zoom=Math.min(2.7,zoom*1.15);draw()};$('zoomOut').onclick=()=>{zoom=Math.max(.55,zoom/1.15);draw()};$('cutaway').onchange=()=>{low=$('cutaway').checked;draw()};
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(e.key))return;e.preventDefault();hover=hover||[WIDTH/2,HEIGHT/2,view==='all'?+$(selection+'Floor').value:view];const delta=e.shiftKey?1:.3;if(e.key==='ArrowLeft')hover[0]-=delta;if(e.key==='ArrowRight')hover[0]+=delta;if(e.key==='ArrowUp')hover[1]-=delta;if(e.key==='ArrowDown')hover[1]+=delta;if(e.key==='Enter')place([...hover]);draw()});
updateSelection();calculate();resize();
