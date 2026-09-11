import {route} from './router.mjs';
self.onmessage=({data})=>{const {id,start,end,options}=data;try{const shortest=route(start,end,{...options,weight:0});const best=options.weight===0?shortest:route(start,end,options);self.postMessage({id,shortest,best});}catch(error){self.postMessage({id,error:error.message});}};
