import {overall,type Mode} from './attributes.ts';
import type {Player} from './recruitment.ts';
import {assignTraits} from './traits.ts';
import {rankedCountries,rankedStats} from './ranked.ts';

export const generationVersion=5;
export function generateWorld(base:Player[],seed:number):Player[]{
  let state=seed>>>0;
  function random(){
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/4294967296;
  }
  const bound=(value:number)=>Math.max(1,Math.min(100,value));
  const generated=base.map(player=>{
    const variation=Math.round((random()+random()-1)*10);
    const attributes=Object.fromEntries(Object.entries(player.attributes).map(([key,value])=>{
      const adjusted=bound(value+variation+(random()*6-3));
      return [key,Math.round(adjusted*100)/100];
    }));
    const rating=overall(attributes,player.mode as Mode,player.role);
    if(rating<1)throw Error('Atributos incompatíveis no catálogo.');
    const shift=Math.round(rating-player.overall);
    return {...player,attributes,overall:rating,
      estimateLow:player.estimateLow===null?null:bound(player.estimateLow+shift),
      estimateHigh:player.estimateHigh===null?null:bound(player.estimateHigh+shift)};
  });
  return addWorldTraits(generated,seed);
}

export function addWorldTraits(players:Player[],seed:number){
  return players.map(player=>{
    let state=(Math.imul(player.id,2654435761)^seed)>>>0;
    const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
    if(player.perks&&player.temperament)return player;
    const midpoint=player.estimateLow===null||player.estimateHigh===null?player.overall:(player.estimateLow+player.estimateHigh)/2;
    const ceiling=Math.min(100,Math.max(player.overall,midpoint+Math.round(random()*10-5)));
    if(player.perks)return {...player,temperament:assignTraits(player,random).temperament};
    return {...player,ceiling,...assignTraits(player,random)};
  });
}

export function addRankedProspects(players:Player[],seed:number,day=1):Player[]{
  return fillRankedCoverage(players,seed,day,3);
}

export function fillRankedCoverage(players:Player[],seed:number,day:number,minimum:number):Player[]{
  const modes=(['MOBA','FPS'] as const).filter(mode=>players.some(player=>player.mode===mode&&!player.team&&!player.status));
  const counts=new Map<string,number>();
  for(const player of players){
    if(player.status!=='ranked')continue;
    const key=player.mode+':'+player.country;
    counts.set(key,(counts.get(key)??0)+1);
  }
  const slots=modes.flatMap(mode=>rankedCountries.flatMap(country=>
    Array.from({length:Math.max(0,minimum-(counts.get(mode+':'+country)??0))},()=>({mode,country}))));
  if(!slots.length)return players;
  const pools=new Map(modes.map(mode=>[mode,players.filter(player=>player.mode===mode&&!player.team&&!player.status)]));
  const local=new Map<string,Player[]>();
  for(const [mode,pool] of pools)for(const player of pool){
    const key=mode+':'+player.country;
    const list=local.get(key)??[];
    list.push(player);
    local.set(key,list);
  }
  const maxId=players.reduce((max,player)=>Math.max(max,player.id),0);
  let state=(seed^0x6480a325)>>>0;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const prospects=slots.map(({mode,country},index):Player=>{
    const localPool=local.get(mode+':'+country);
    const pool=localPool??pools.get(mode)!;
    const base=pool[Math.floor(random()*pool.length)];
    const attributes=Object.fromEntries(Object.entries(base.attributes).map(([key,value])=>
      [key,Math.max(1,Math.round((value*0.83+random()*5)*100)/100)]));
    const rating=overall(attributes,base.mode as Mode,base.role);
    const ceiling=Math.min(97,Math.max(52,rating+Math.round(8+random()*28)+(index%19===0?13:0)));
    const estimate=Math.round(ceiling+random()*8-4);
    const id=maxId+index+1;
    const nickname=base.nickname+' R'+id;
    return {
      id,name:localPool?base.name:nickname,nickname,country,
      mode,role:base.role,team:null,organization:null,status:'ranked',attributes,
      overall:rating,ceiling,birthDay:day-Math.floor(365.25*(17+random()*4)),portraitIndex:base.portraitIndex,
      estimateLow:Math.max(Math.ceil(rating),estimate-8),estimateHigh:Math.min(100,estimate+8),
      rankedPerformance:rankedStats({id,overall:rating}),
    };
  });
  return [...players,...addWorldTraits(prospects,seed)];
}
