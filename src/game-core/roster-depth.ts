import {definitions,attributeWeight,roles,overall,type Mode} from './attributes.ts';
import {playerCondition} from './development.ts';
import type {Player,Contract} from './recruitment.ts';

export function rosterDepth(players:Player[],contracts:Contract[],mode:Mode,day:number){
 const index=new Map(players.map(player=>[player.id,player]));
 const eligible=contracts.flatMap(contract=>{
   const player=index.get(contract.player_id);
   return !contract.academy&&player?.mode===mode&&!player.status?[{contract,player}]:[];
 });
 return roles[mode].map(role=>{
   const candidates=eligible.filter(entry=>entry.player.role===role).flatMap(entry=>{
     const rating=overall(entry.player.attributes,mode,role);
     return rating<1?[]:[{...entry,rating,condition:playerCondition(entry.player,day)}];
   });
   const starters=candidates.filter(entry=>entry.contract.starter);
   const reserves=candidates.filter(entry=>!entry.contract.starter).sort((a,b)=>b.rating-a.rating||a.condition.fatigue-b.condition.fatigue||b.condition.morale-a.condition.morale||a.player.id-b.player.id);
   const best=reserves[0],starter=starters[0];
   const label=!best?'Sem reserva':!starter||starter.rating-best.rating>10?'Cobertura limitada':'Cobertura adequada';
   const principal=definitions[mode].filter(key=>attributeWeight(role,key)===4);
   return {role,starters,reserves,label,principal};
 });
}
