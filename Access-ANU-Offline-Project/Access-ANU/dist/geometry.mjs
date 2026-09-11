// Hand trace of the supplied B155 level-one plan. Coordinates are source-image pixels.
// 20 source pixels = 1 illustrative plan unit; this is NOT a surveyed metric scale.
export const SCALE=20, ORIGIN=[106,155], WIDTH=39, HEIGHT=42.5;
const obstacles=[];const doors=[];
function rect(x1,y1,x2,y2,type='wall',label=''){obstacles.push({x:(x1-106)/20,y:(y1-155)/20,w:(x2-x1)/20,h:(y2-y1)/20,type,label});}
function h(x1,x2,y){rect(x1,y-2,x2,y+2)}
function v(x,y1,y2){rect(x-2,y1,x+2,y2)}
function door(x1,y1,x2,y2,label='Door'){doors.push({a:[(x1-106)/20,(y1-155)/20],b:[(x2-106)/20,(y2-155)/20],label})}
// Outer envelope. The two ordinary-entry candidates are left and lower right.
h(106,886,156);h(106,886,1003);v(108,156,390);v(108,418,628);v(108,714,1003);v(883,156,791);v(883,828,939);v(883,989,1003);
door(108,628,108,714,'West entrance');door(883,939,883,989,'East entrance');
door(108,390,108,418,'Stair exit');door(883,791,883,828,'Stair exit');
// North rooms: door positions cannot be established from this image.
h(110,883,368);v(305,158,368);v(494,158,368);v(683,158,368);
// West stair enclosure and adjoining service spaces.
h(112,249,363);v(113,418,526);h(113,249,527);v(200,364,425);v(200,452,527);h(200,248,457);v(248,364,527);
door(200,425,200,452);
rect(117,439,195,483,'stairs','West stairs');
// Small rooms south of the west stair. Door swings are omitted and gaps retained.
v(150,529,575);v(181,529,575);h(110,150,577);h(181,251,577);door(150,577,181,577);
// Toilet block, traced with open doorways.
v(251,369,577);v(329,370,502);v(407,368,577);
h(251,264,396);h(286,329,396);h(288,329,422);h(288,329,451);h(251,303,493);v(303,494,536);v(303,555,577);h(251,303,577);
h(329,380,397);h(399,407,397);h(329,374,422);h(329,365,459);h(354,407,500);h(379,407,536);h(379,407,568);h(354,407,578);v(354,490,513);v(354,536,545);v(354,568,578);
door(264,396,286,396);door(380,397,399,397);door(287,400,287,420);door(287,427,287,447);door(303,536,303,555);door(354,513,354,536);door(354,545,354,568);door(313,578,354,578);
// Stair flights and lift cores: obstacle footprints, not fictitious same-floor shortcuts.
rect(453,377,535,577,'stairs','Upper stair flight');
rect(402,623,535,709,'stairs','Central stair flight');
for(const [a,b] of [[304,381],[381,458],[458,536]]) rect(a,710,b,787,'lift','Lift');
// East stair enclosure and entry service rooms.
h(677,881,772);v(678,772,868);h(678,881,869);rect(734,778,834,818,'stairs','East stairs');
// The stair-to-lobby connection is unclear: preserve enclosure until verified.
v(724,870,900);v(752,871,900);v(779,871,900);v(818,870,900);
h(679,724,902);h(818,881,902);door(724,902,752,902);door(779,902,818,902);
// Black structural columns, distinct from the wall mesh.
for(const [x,y,w,ht] of [[112,160,10,27],[301,157,9,29],[490,157,9,29],[679,157,9,29],[869,160,11,27],[112,335,12,28],[297,362,20,12],[489,362,20,12],[677,362,16,12],[869,349,11,24],[112,566,10,17],[298,565,15,14],[489,563,16,16],[678,562,13,16],[869,562,12,16],[112,777,15,12],[112,982,17,19],[303,985,13,16],[492,984,13,17],[678,979,13,17],[870,983,12,18]])rect(x,y,x+w,y+ht,'pillar','Column');
export {obstacles,doors};
export const entrances=[{name:'West entrance',point:[1.5,25.3]},{name:'East entrance',point:[37.3,40.2]}];
export const labels=[{text:'LIFT LOBBY',x:15.6,y:33.8},{text:'OPEN HALL',x:29,y:18},{text:'WEST ENTRY',x:3.2,y:26.3},{text:'EAST ENTRY',x:33.8,y:40.5},{text:'SERVICES',x:11.2,y:20.1},{text:'DOOR LOCATIONS UNVERIFIED',x:19.5,y:5.2},{text:'STAIRS',x:34.5,y:32.5}];
export const metadata={building:'155',floor:'Level One',units:'Illustrative plan units; no surveyed dimensions supplied',source:'User-supplied evacuation floor plan',assumptions:['West and lower-right openings are assumed to be the two ordinary entrances.','North-room doors and the east-stair lobby connection are not established; no connections were invented.','Small service-room door positions are approximate; verify on site.','Stair flights and lift footprints block horizontal movement; building.mjs supplies vertical landing links.','No real-time positioning is provided.']};
