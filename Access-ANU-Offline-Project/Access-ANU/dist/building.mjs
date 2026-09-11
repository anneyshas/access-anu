import * as one from './geometry.mjs';
import * as two from './level2.mjs';
export const WIDTH=one.WIDTH,HEIGHT=one.HEIGHT,RISE=3.6;
export const floors={1:{id:1,name:'Level One',obstacles:one.obstacles,doors:one.doors,labels:one.labels},2:{id:2,name:'Level Two',obstacles:two.obstacles,doors:two.doors,labels:two.labels}};
// Portals are walkable landing/door points, never the solid centre of a shaft.
// Stair landing positions and storey height are inferred, not surveyed.
export const connectors=[
 {id:'lift-1',name:'Lift 1',type:'lift',a:[11.85,32.4,1],b:[11.85,32.4,2]},
 {id:'lift-2',name:'Lift 2',type:'lift',a:[15.7,32.4,1],b:[15.7,32.4,2]},
 {id:'lift-3',name:'Lift 3',type:'lift',a:[19.55,32.4,1],b:[19.55,32.4,2]},
 {id:'central-south',name:'Central stairs · south',type:'stairs',a:[17.7,22.65,1],b:[9.15,21.55,2]},
 {id:'central-north',name:'Central stairs · north',type:'stairs',a:[20.65,21.8,1],b:[20.15,12.7,2]},
 {id:'west-stairs',name:'West enclosed stairs',type:'stairs',a:[2.9,17.85,1],b:[5.4,17.55,2]},
 {id:'east-stairs',name:'East enclosed stairs',type:'stairs',a:[31,34.6,1],b:[30.6,34.8,2]}
];
export const entrances=one.entrances.map(e=>({...e,point:[...e.point,1]}));
export const defaultDestination=[31,8,2];
