import type {Competition,Fixture,Season} from './competitions.ts';
import type {MatchTeam} from './matches.ts';

export type HistoricalAthlete={id:number;nickname:string;role:string;portraitIndex?:number};
export type IndividualHonor={kind:'MVP da final'|'Melhor da competição'|'Destaque por função'|'Revelação sub-21';athlete:HistoricalAthlete;team:string;rating:number;maps:number};
export type Championship={champion:MatchTeam;runnerUp?:MatchTeam;score?:[number,number];finalId?:string;day:number;roster:HistoricalAthlete[];honors:IndividualHonor[]};

function ranked(games:Fixture[]){
 const athletes=new Map<string,{athlete:HistoricalAthlete;team:string;maps:number;total:number}>();
 for(const fixture of games)for(const map of fixture.result?.maps??[])for(const stat of map.stats){
   if(typeof stat.rating!=='number'||!Number.isFinite(stat.rating))continue;
   const team=map.teams[stat.team].id;
   const key=team+':'+stat.playerId;
   const row=athletes.get(key)??{athlete:{id:stat.playerId,nickname:stat.nickname,role:stat.role,portraitIndex:stat.portraitIndex},team,maps:0,total:0};
   row.total+=stat.rating;row.maps++;
   athletes.set(key,row);
 }
 return [...athletes.values()].map(({total,...row})=>({...row,rating:Math.round(total/row.maps*100)/100}))
   .sort((a,b)=>b.rating-a.rating||b.maps-a.maps||a.athlete.id-b.athlete.id||a.team.localeCompare(b.team));
}

export function championshipFromResults(edition:Competition,young?:ReadonlySet<number>):Championship|undefined{
 const champion=edition.participants.find(team=>team.id===edition.champion);
 if(!champion)return;
 const finals=edition.fixtures.filter(game=>game.phase==='final'&&game.result);
 const final=finals.at(-1);
 const firstPlayed=finals.flatMap(game=>game.result?.maps??[])[0];
 const decided=final?.result?.maps.at(-1)??firstPlayed;
 const opponent=final?edition.participants.find(team=>team.id===(final.home===champion.id?final.away:final.home)):undefined;
 const roster=new Map<number,HistoricalAthlete>();
 for(const game of finals)for(const map of game.result?.maps??[])for(const stat of map.stats){
   if(map.teams[stat.team].id===champion.id)roster.set(stat.playerId,{id:stat.playerId,nickname:stat.nickname,role:stat.role,portraitIndex:stat.portraitIndex});
 }
 const finalMvp=ranked(finals)[0],field=ranked(edition.fixtures).filter(row=>row.maps>=3);
 const honors:IndividualHonor[]=[];
 if(finalMvp)honors.push({kind:'MVP da final',...finalMvp});
 if(field.length>=5){
   honors.push({kind:'Melhor da competição',...field[0]});
   const byRole=new Set<string>();
   for(const row of field){
     if(byRole.has(row.athlete.role)||field.filter(player=>player.athlete.role===row.athlete.role).length<2)continue;
     byRole.add(row.athlete.role);honors.push({kind:'Destaque por função',...row});
   }
   const prospect=young&&field.find(row=>young.has(row.athlete.id));
   if(prospect)honors.push({kind:'Revelação sub-21',...prospect});
 }
 return {champion:decided?.teams.find(team=>team.id===champion.id)??champion,
   runnerUp:decided?.teams.find(team=>team.id===opponent?.id)??opponent,score:final?.result?.score,finalId:final?.id,
   day:final?.result?.completedDay??edition.endDay,roster:[...roster.values()],honors};
}

export function competitionTitles(seasons:Season[],key?:string){
 return seasons.flatMap(season=>season.editions.flatMap(edition=>{
   if(edition.key===season.pyramid?.playIn||key&&key!==edition.key)return [];
   const history=edition.championship??championshipFromResults(edition);
   return history?[{season,edition,history}]:[];
 })).sort((a,b)=>b.history.day-a.history.day||a.edition.id.localeCompare(b.edition.id));
}

export function longestTitleRun(titles:ReturnType<typeof competitionTitles>){
 let record:{team:string;length:number}|undefined,current:string|undefined,previous=-1,count=0;
 for(const title of [...titles].sort((a,b)=>a.season.number-b.season.number)){
   const team=title.edition.participants.find(p=>p.id===title.edition.champion)?.organization??title.history.champion.id;
   count=team===current&&title.season.number===previous+1?count+1:1;
   if(!record||count>record.length)record={team:title.history.champion.name,length:count};
   current=team;previous=title.season.number;
 }
 return record;
}
