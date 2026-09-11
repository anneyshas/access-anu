import assert from 'node:assert/strict';
import {route,segmentClear,clearanceAt} from './dist/router.mjs';
import {entrances} from './dist/geometry.mjs';
const [a,b]=entrances.map(e=>e.point);
for(const radius of [.1,.22,.5,.7]){
 const shortest=route(a,b,{radius,weight:0});assert.ok(!shortest.error);
 for(const weight of [0,3,8]){
  const r=route(a,b,{radius,weight});assert.ok(!r.error);assert.ok(r.length>=shortest.length-1e-7);
  for(let i=1;i<r.points.length;i++)assert.ok(segmentClear(r.points[i-1],r.points[i],radius),'Route crosses obstacle buffer');
 }
}
const direct=route(a,b,{weight:0}),wide=route(a,b,{weight:3});
assert.ok(wide.meanClearance>direct.meanClearance);assert.ok(wide.minClearance>direct.minClearance);
assert.ok(route([5,5],a).error,'Unverified northern room must remain disconnected');
const column=[(684-106)/20,(569-155)/20];assert.equal(clearanceAt(...column),0);assert.ok(route(column,a).error);
for(const dest of [[9,15.8],[13,16],[13.8,20]]){
 const r=route([23,23],dest,{radius:.22,weight:3});assert.ok(!r.error,'Toilet door disconnected');
 for(let i=1;i<r.points.length;i++)assert.ok(segmentClear(r.points[i-1],r.points[i],.22));
}
assert.equal(route([22,30],[22,30]).length,0);
console.log('PASS: entrance routes at 12 settings, segment clearance, wider-route preference, unverified rooms, pillars, toilet doors, identical endpoints.');
// Multi-floor regressions: switches occur only on registered connector edges.
const {connectors,defaultDestination}=await import('./dist/building.mjs');
for(const transfer of ['any','lift','stairs'])for(const radius of [.22,.5]){
 for(const [start,end] of [[[...a,1],defaultDestination],[defaultDestination,[...a,1]]]){
  const r=route(start,end,{radius,weight:3,transfer});assert.ok(!r.error,r.error);assert.ok(r.transitions.length>=1);
  assert.equal(r.points[0][2],start[2]);assert.equal(r.points.at(-1)[2],end[2]);
  for(const t of r.transitions){assert.ok(connectors.some(c=>c.id===t.id));if(transfer!=='any')assert.equal(t.type,transfer);assert.notEqual(t.from[2],t.to[2]);}
  for(const seg of r.segments)for(let i=1;i<seg.points.length;i++)assert.ok(segmentClear(seg.points[i-1],seg.points[i],radius),'Floor segment crosses wall or void');
 }
}
assert.ok(route([2,26,1],[31,8,2],{allowTransfers:false}).error,'Floor changes without a connector must be impossible');
assert.equal(clearanceAt(12,16,2),0,'Stairwell void must be blocked');
const sameFloor=route([25,34,2],[31,8,2],{weight:2});assert.ok(!sameFloor.error);assert.equal(sameFloor.transitions.length,0);
const closedRoom=route([31,34.6,1],[3,26,1],{weight:0});assert.ok(!closedRoom.error);assert.equal(closedRoom.transitions.length,2,'Enclosed landing should reconnect through Level Two');
console.log('PASS: bidirectional inter-floor routes, lift/stair filters, connector-only transitions, void exclusion, Level Two routing and two-transfer route.');
