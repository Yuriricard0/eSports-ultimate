import type {Season} from './competitions.ts';
import type {Player} from './recruitment.ts';

export const marketTargetsSchema=`
CREATE TABLE IF NOT EXISTS web_market_targets (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
 player_id INTEGER NOT NULL,
 PRIMARY KEY(career_id,player_id)
);`;

export type MarketUsage={played:number;available:number;impact:number};

export function marketUsage(seasons:Season[],day:number,players:Pick<Player,'id'|'team'|'history'>[]){
 const teams=new Map<string,{day:number;played:Map<number,number>}[]>();
 for(const season of seasons)for(const edition of season.editions)for(const fixture of edition.fixtures){
   const result=fixture.result;
   if(!result||result.completedDay>day||result.completedDay<day-90)continue;
   for(const team of [fixture.home,fixture.away]){
     const played=new Map<number,number>();
     for(const map of result.maps){
       const side=map.teams.findIndex(side=>side.id===team);
       if(side<0)continue;
       for(const stat of map.stats)if(stat.team===side){
         played.set(stat.playerId,Math.max(played.get(stat.playerId)??-Infinity,stat.kills+stat.assists*.35-stat.deaths));
       }
     }
     const fixtures=teams.get(team)??[];
     fixtures.push({day:result.completedDay,played});teams.set(team,fixtures);
   }
 }
 return players.flatMap(player=>{
   const fixtures=player.team?teams.get(player.team):undefined;
   if(!fixtures)return [];
   const movement=Math.max(0,...(player.history??[]).filter(event=>/transferido|contratado|vendido|dispensado|elenco/i.test(event.description)).map(event=>event.day));
   const recent=fixtures.filter(fixture=>fixture.day>movement);
   const first=Math.min(...recent.filter(fixture=>fixture.played.has(player.id)).map(fixture=>fixture.day));
   // Counting starts with the first proven appearance for the current team.
   const available=recent.filter(fixture=>fixture.day>=first);
   const impacts=available.flatMap(fixture=>fixture.played.has(player.id)?[fixture.played.get(player.id)!]:[]);
   return available.length?[[player.id,{played:impacts.length,available:available.length,
     impact:impacts.reduce((sum,value)=>sum+value,0)/Math.max(1,impacts.length)}] as const]:[];
 });
}

export function usageLabel(usage:MarketUsage|undefined){
 if(!usage||usage.available<4||usage.played*2>usage.available)return '';
 return usage.played*4<=usage.available?'Pouco utilizado':'Reserva frequente';
}
