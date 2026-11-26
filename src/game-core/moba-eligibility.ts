import {roles} from './attributes.ts';
import {countryRegions} from './countries.ts';
import type {Player} from './recruitment.ts';
import type {MatchStarter} from './matches.ts';

export type MobaRegion='cblol'|'lcs'|'lec'|'lck'|'lpl'|'lcp';
export const regionalPolicies:Record<MobaRegion,{limit:number;days:number}>={
 cblol:{limit:2,days:1095},lcs:{limit:2,days:1095},lec:{limit:2,days:1095},
 lck:{limit:2,days:1095},lpl:{limit:2,days:1095},lcp:{limit:2,days:1095},
};
const developmentRegions:Record<string,MobaRegion>={
 circuito_desafiante:'cblol',lrs:'cblol',nacl:'lcs',lrn:'lcs',ljl:'lcp',pcs:'lcp',vcs:'lcp',
 lck_challengers:'lck',wsci_classificatoria_chinesa:'lpl',
};
export function mobaRegion(country:string):MobaRegion{
 if(country==='KR')return 'lck';
 if(country==='CN')return 'lpl';
 const region=countryRegions[country];
 if(country==='BR'||region==='América do Sul')return 'cblol';
 if(region==='América do Norte')return 'lcs';
 return region==='Ásia'||region==='Oceania'?'lcp':'lec';
}
export function leagueMobaRegion(league:string):MobaRegion{
 return Object.hasOwn(regionalPolicies,league)?league as MobaRegion:developmentRegions[league]??'lec';
}
export function isMobaImport(player:Pick<Player,'country'|'mobaTenure'>,region:MobaRegion){
 return (!Object.hasOwn(countryRegions,player.country)||mobaRegion(player.country)!==region)&&
   (player.mobaTenure?.[region]??0)<regionalPolicies[region].days;
}
export function mobaImports(lineup:readonly MatchStarter[],region:MobaRegion){
 return lineup.filter(slot=>isMobaImport(slot.player,region)).length;
}
export function eligibleMobaLineup(candidates:readonly MatchStarter[],region:MobaRegion){
 const limit=regionalPolicies[region].limit;
 let best:Array<{slots:MatchStarter[];overall:number}|undefined>=[{slots:[],overall:0}];
 for(const role of roles.MOBA){
   const next:typeof best=[];
   for(const slot of candidates){
     if(slot.role!==role||slot.player.mode!=='MOBA'||slot.player.status)continue;
     const cost=Number(isMobaImport(slot.player,region));
     for(let imports=0;imports+cost<=limit;imports++){
       const previous=best[imports];
       if(!previous||previous.slots.some(member=>member.player.id===slot.player.id))continue;
       const overall=previous.overall+slot.player.overall,index=imports+cost;
       if(!next[index]||next[index]!.overall<overall)next[index]={slots:[...previous.slots,slot],overall};
     }
   }
   best=next;
 }
 return best.flatMap(row=>row?[row]:[]).sort((a,b)=>b.overall-a.overall)[0]?.slots??[];
}
export function registeredMobaLineup(players:Player[],teamId:string,day:number,region:MobaRegion){
 return eligibleMobaLineup(players.filter(player=>player.team===teamId).map(player=>({
   player,role:player.role,startDay:Math.min(day,player.history?.[0]?.day??-59),
 })),region);
}
