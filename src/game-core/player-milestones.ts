import type {Player} from './recruitment.ts';
import type {Season} from './competitions.ts';
import type {MatchResult} from './matches.ts';

export type PlayerMilestone={id?:string;day:number;text:string;kind:'Vínculo'|'Partida'|'Título'|'Evolução'|'Histórico'};
export const rosterEventNames={hired:'Início do contrato',expired:'Fim do contrato',starter:'Promovido a titular',sold:'Vendido',released:'Dispensado',renewed:'Contrato renovado',match:'Partida concluída'};

export function participated(match:MatchResult,id:number,team?:string){
 return match.stats.some(stat=>stat.playerId===id&&(!team||match.teams[stat.team].id===team));
}

export function competitionMilestones(seasons:Season[],id:number):PlayerMilestone[]{
 return seasons.flatMap(season=>season.editions.flatMap(edition=>{
   const fixtures=edition.fixtures.flatMap(fixture=>{
     const series=fixture.result;
     if(!series?.maps.some(map=>participated(map,id)))return [];
     const mvp=series.maps.some(map=>map.mvp===id);
     return [{id:`fixture:${fixture.id}`,day:series.completedDay,kind:'Partida' as const,text:`Série na competição ${edition.name}${mvp?' · MVP de mapa':''}`}];
   });
   const final=edition.fixtures.find(fixture=>fixture.phase==='final')?.result;
   if(edition.champion&&final?.maps.some(map=>participated(map,id,edition.champion!))){
     return [...fixtures,{id:`title:${edition.id}`,day:final.completedDay,kind:'Título' as const,text:`Campeão · ${edition.name}`}];
   }
   return fixtures;
 }));
}

export function playerMilestones(player:Player,events:PlayerMilestone[],day:number){
 const development=[...(player.developmentHistory??[])].filter(point=>point.day<=day).sort((a,b)=>a.day-b.day);
 let baseline=development[0];
 const growth:PlayerMilestone[]=[];
 for(const point of development.slice(1)){
   if(Math.abs(point.overall-baseline.overall)<0.5)continue;
   growth.push({day:point.day,kind:'Evolução',text:`Overall de ${baseline.overall.toLocaleString('pt-BR')} para ${point.overall.toLocaleString('pt-BR')}`});
   baseline=point;
 }
 const imported:PlayerMilestone[]=(player.history??[]).map(entry=>({day:entry.day,kind:'Histórico',text:entry.description}));
 const seen=new Set<string>();
 return [...events,...growth,...imported].filter(entry=>{
   const key=entry.id??`${entry.day}:${entry.kind}:${entry.text}`;
   if(entry.day>day||seen.has(key))return false;
   seen.add(key);return true;
 }).sort((a,b)=>b.day-a.day);
}
