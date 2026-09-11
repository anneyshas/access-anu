// Level Two: perspective-corrected photo rotated 90 degrees anticlockwise.
// Trace coordinates are relative to a 780x850 image aligned to Level One.
// Lift shafts are registered to the exact Level One shaft footprints.
import {obstacles as first} from './geometry.mjs';
export const obstacles=[],doors=[];
function r(x,y,w,h,type='wall',label=''){obstacles.push({x:x/20,y:y/20,w:w/20,h:h/20,type,label})}
function h(x1,x2,y){r(x1,y-2,x2-x1,4)}function v(x,y1,y2){r(x-2,y1,4,y2-y1)}
function door(x1,y1,x2,y2,label='Door'){doors.push({a:[x1/20,y1/20],b:[x2/20,y2/20],label})}
h(0,780,2);h(0,780,847);v(2,0,850);v(777,0,850);
// West enclosed stairwell. The east-facing doorway leads to the common hall.
h(3,144,212);v(145,212,343);v(145,374,430);h(3,145,430);h(3,145,378);
// Opening between the stair landing and the corridor: no door-swing arcs.
// Split the stair boundary at its landing, and retain adjoining service rooms.
obstacles.pop();h(3,120,378);v(95,214,310);h(95,145,310);h(95,145,274);
r(10,270,80,65,'stairs','West stair flight');door(145,343,145,374,'West stair door');
// Central atrium/stair core. The blank rectangle is a void, not walkable floor.
r(216,225,93,201,'void','Stairwell void');r(309,225,75,201,'stairs','Upper central stairs');
r(199,429,69,126,'stairs','Lower central stairs');r(268,429,28,126,'void','Stairwell void');
r(296,429,88,50,'void','Stair landing / void');r(296,479,88,76,'stairs','Central return flight');
// Northern partition and visible door opening.
h(387,538,212);h(570,778,212);door(538,212,570,212,'North hall door');
// Small northern flight: its destination is not established by the supplied plans.
r(173,24,80,70,'stairs','Unlinked stair flight');
// Lifts align across floors. Use the registered Level One footprints.
obstacles.push(...first.filter(o=>o.type==='lift').map(o=>({...o})));
// Right-side glazed screen ends at an open passage beside the lift bank.
h(431,540,636);
// East stair enclosure and service rooms. West-facing entry at the landing.
h(575,777,625);v(576,625,675);v(576,714,752);h(576,777,721);
r(665,634,65,78,'stairs','East stair flight');door(576,675,576,714,'East stair door');
v(673,722,757);v(716,722,782);h(576,674,752);h(716,777,751);
door(674,752,716,752);door(716,782,716,816);v(716,816,847);
// Columns matched by position to the Level One structural grid.
for(const o of first.filter(o=>o.type==='pillar')) {
 // Exclude the extra stair/service columns which are not visible on this level.
 if(o.x<1||o.x>37||[9.9,19.15,28.55].some(x=>Math.abs(o.x-x)<.5))obstacles.push({...o});
}
export const labels=[{text:'NORTH HALL',x:26,y:5.8},{text:'OPEN HALL',x:25,y:17.5},{text:'LIFT LOBBY',x:15.8,y:34.6},{text:'WEST STAIRS',x:4.7,y:18.1},{text:'EAST STAIRS',x:33,y:36.4},{text:'STAIRWELL VOID',x:12.9,y:16}];
