import type {Career} from './career.ts';
import type {Season} from './competitions.ts';
import {countryRegions} from './countries.ts';
import {leagueMobaRegion,mobaRegion} from './moba-eligibility.ts';
import type {WorldCatalog} from './world.ts';

export const rankingRules={regional:100,development:55,international:200,major:300,halfLife:180,expiry:730};
const regionNames:Record<string,string>={cblol:'Brasil',lcs:'América do Norte',lec:'Europa',lck:'Coreia do Sul',lpl:'China',lcp:'Ásia-Pacífico',vrs_americas:'Américas',vrs_europa:'Europa',vrs_asia:'Ásia-Pacífico'};

export function buildCompetitionRankings(seasons:Season[],career:Pick<Career,'mode'|'country'|'day'|'entry'>,catalog:WorldCatalog,rules=rankingRules){
 const mode=career.mode==='FPS'?'FPS':'MOBA';
 const leagues=new Map(catalog.leagues.map(league=>[league.id,league]));
 const teams=new Map(catalog.teams.map(team=>[team.id,team.league]));
 const fallback=countryRegions[career.country]==='Europa'?'vrs_europa':countryRegions[career.country]==='Ásia'||countryRegions[career.country]==='Oceania'?'vrs_asia':'vrs_americas';
 const home=mode==='MOBA'?mobaRegion(career.country):career.entry?.leagueId??fallback;
 const editions=seasons.flatMap(season=>season.editions.filter(e=>e.mode===mode&&e.champion&&e.key!==season.pyramid?.playIn).flatMap(e=>{
   const day=Math.max(0,...e.fixtures.flatMap(game=>game.result?[game.result.completedDay]:[]));
   if(!day||day>career.day)return [];
   const tier=e.prestige==='Major'||e.key==='moba_world'?rules.major:e.prestige==='Internacional'?rules.international:
     (leagues.get(e.key)?.tier??1)>1?rules.development:rules.regional;
   return e.finalOrder.flatMap((id,index)=>{
     const team=e.participants.find(p=>p.id===id);
     if(!team)return [];
     const league=teams.get(id);
     const region=team.organization==='career'?home:league?(mode==='MOBA'?leagueMobaRegion(league):league):undefined;
     const field=Math.min(1.25,0.75+e.participants.length/24);
     const placement=(e.participants.length-index)/e.participants.length;
     return [{id:e.id,name:e.name,organization:team.organization,team:team.name,region,day,place:index+1,international:e.prestige!=='Regional',value:tier*field*placement**2}];
   });
 }));
 const tableAt=(day:number,region?:string)=>{
   const rows=new Map<string,{organization:string;team:string;points:number;results:(typeof editions[number]&{points:number})[]}>();
   for(const result of editions){
     const age=day-result.day;
     if(age<0||age>rules.expiry||region&&result.region!==region)continue;
     const points=Math.round(result.value*0.5**(age/rules.halfLife));
     if(!points)continue;
     const row=rows.get(result.organization)??{organization:result.organization,team:result.team,points:0,results:[]};
     row.points+=points;row.results.push({...result,points});rows.set(row.organization,row);
   }
   return [...rows.values()].sort((a,b)=>b.points-a.points||a.organization.localeCompare(b.organization))
     .map((row,index)=>({...row,position:index+1,results:row.results.sort((a,b)=>b.points-a.points||b.day-a.day||a.id.localeCompare(b.id)).slice(0,3)}));
 };
 const checkpoints=seasons.filter(season=>season.startDay<=career.day).sort((a,b)=>a.startDay-b.startDay).map((season,index,list)=>({
   season:season.number,year:season.year,day:Math.min(career.day,list[index+1]?list[index+1].startDay-1:career.day),
 }));
 const board=(region?:string)=>{
   const history=checkpoints.map(checkpoint=>{
     const rows=tableAt(checkpoint.day,region),own=rows.find(row=>row.organization==='career');
     return {...checkpoint,position:own?.position??null,points:own?.points??0};
   });
   const previous=new Map(tableAt(checkpoints.at(-2)?.day??career.day-30,region).map(row=>[row.organization,row.position]));
   return {history,rows:tableAt(career.day,region).map(row=>({...row,previous:previous.get(row.organization)??null}))};
 };
 const prestigeAt=(day:number,region:string)=>{
   const events=new Map<string,number>();
   for(const result of editions){
     const age=day-result.day;
     if(result.region!==region||!result.international||age<0||age>rules.expiry)continue;
     const points=result.value*0.5**(age/rules.halfLife);
     events.set(result.id,Math.max(events.get(result.id)??0,points));
   }
   return Math.round(Math.min(100,[...events.values()].reduce((a,b)=>a+b,0)/6));
 };
 const prestige=Object.entries(regionNames).filter(([id])=>mode==='FPS'?id.startsWith('vrs_'):!id.startsWith('vrs_')).map(([id,name])=>({
   id,name,value:prestigeAt(career.day,id),history:checkpoints.map(({year,day,season})=>({year,season,value:prestigeAt(day,id)})),
 })).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'pt-BR'));
 return {region:regionNames[home]??home,regional:board(home),world:board(),prestige};
}

export type CompetitionRankings=ReturnType<typeof buildCompetitionRankings>;

export function worldRegionalSlots(regions:string[],prestige:Pick<CompetitionRankings['prestige'][number],'id'|'value'>[]){
 const points=new Map(prestige.map(row=>[row.id,row.value]));
 const ordered=[...regions].sort((a,b)=>(points.get(b)??0)-(points.get(a)??0)||a.localeCompare(b));
 const best=ordered[0],last=ordered.at(-1);
 const transfer=!!best&&!!last&&(points.get(best)??0)>(points.get(last)??0);
 return Object.fromEntries(regions.map(region=>[region,transfer?(region===best?3:region===last?1:2):2]));
}
