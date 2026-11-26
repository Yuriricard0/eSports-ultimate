import {athleteAge} from './development.ts';
import {hashSeed,type Season} from './competitions.ts';
import {roles,type Mode} from './attributes.ts';
import {transferValue,type SaleOption} from './market.ts';
import type {Player} from './recruitment.ts';
import type {WorldCatalog} from './world.ts';

export const marketLimits={interval:7,club:2,athlete:2,window:30,repeat:35,refused:60,expires:14};
export type Evidence={games:number;impact:number};
type ObservedPlayer=Pick<Player,'id'|'mode'|'role'|'overall'|'birthDay'|'estimateLow'|'organization'> & Pick<Partial<Player>,'rankedPerformance'>;
export function marketInterest(player:ObservedPlayer,buyer:{reputation:number;academy:boolean},incumbent:number|undefined,day:number,evidence:Evidence={games:0,impact:0},listed=false,remaining?:number){
 const observed=evidence.games>0?player.overall:player.estimateLow??Math.min(player.overall,45);
 if(incumbent!==undefined&&observed<incumbent+3)return 0;
 if(observed>buyer.reputation+25||observed<buyer.reputation-32)return 0;
 const age=athleteAge(player.birthDay,day);
 const rankedExposure=(player.rankedPerformance?.points??0)>=1900;
 const known=evidence.games>0?Math.min(0.48,0.14+evidence.games*0.035+Math.max(-2,Math.min(2,evidence.impact))*0.035):rankedExposure?0.15:player.estimateLow!==null?0.10:0.015;
 const fit=incumbent===undefined?1:0.65;
 const development=buyer.academy&&age<=23?1.25:1;
 const contract=remaining!==undefined&&remaining<=90?1.25:1;
 return Math.min(.85,(known+(listed?.24:0))*fit*development*contract);
}

export function competitiveEvidence(season:Season|undefined,day:number){
 const records=new Map<number,Evidence>();
 for(const edition of season?.editions??[])for(const fixture of edition.fixtures){
   const result=fixture.result;
   if(!result||result.completedDay>day||result.completedDay<day-120)continue;
   const appearances=new Map<number,number>();
   for(const map of result.maps)for(const stat of map.stats){
     const impact=stat.kills+stat.assists*.35-stat.deaths;
     appearances.set(stat.playerId,Math.max(appearances.get(stat.playerId)??-Infinity,impact));
   }
   for(const [id,impact] of appearances){
     const row=records.get(id)??{games:0,impact:0};
     records.set(id,{games:row.games+1,impact:(row.impact*row.games+impact)/(row.games+1)});
   }
 }
 return records;
}

export type Approach=SaleOption&{playerId:number;seller:string;role:string;day:number;expires:number;state:'open'|'declined'|'signed'|'expired'};
export const approachSchema=`
CREATE TABLE IF NOT EXISTS web_ai_market_days(career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,day INTEGER NOT NULL,PRIMARY KEY(career_id,day));
CREATE TABLE IF NOT EXISTS web_ai_approaches(career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,day INTEGER NOT NULL,buyer TEXT NOT NULL,player_id INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(career_id,day,buyer,player_id));
CREATE INDEX IF NOT EXISTS web_ai_approach_recent ON web_ai_approaches(career_id,day);
`;

export function marketApproaches(players:Player[],catalog:WorldCatalog,owners:ReadonlyMap<number,number>,evidence:ReadonlyMap<number,Evidence>,history:Approach[],seed:number,day:number,affordable:(org:string,player:Player,fee:number)=>boolean,limits=marketLimits,blocked:ReadonlySet<number>=new Set()):Approach[]{
 const roleKey=(mode:string,role:string)=>mode+':'+role;
 const slots=new Map<string,number>();
 const pool=new Map<string,Player[]>();
 for(const player of players){
   if(player.status)continue;
   if(player.team&&!owners.has(player.id)){
     const key=player.team+':'+player.role;
     slots.set(key,Math.max(slots.get(key)??0,player.overall));
   }
   if(blocked.has(player.id)||(!player.organization&&!owners.has(player.id)))continue;
   const key=roleKey(player.mode,player.role);
   const list=pool.get(key)??[];
   list.push(player);pool.set(key,list);
 }
 for(const list of pool.values())list.sort((a,b)=>a.id-b.id);
 const organizations=new Map(catalog.organizations.map(org=>[org.id,org]));
 const leagues=new Map(catalog.leagues.map(league=>[league.id,league.discipline]));
 const result:Approach[]=[];
 const historyByClub=new Map<string,Approach[]>();
 const historyByPlayer=new Map<number,Approach[]>();
 for(const previous of history){
   const club=historyByClub.get(previous.organization)??[];club.push(previous);historyByClub.set(previous.organization,club);
   const athlete=historyByPlayer.get(previous.playerId)??[];athlete.push(previous);historyByPlayer.set(previous.playerId,athlete);
 }
 const count=(list:Approach[])=>list.filter(row=>row.day>day-limits.window).length;
 const clubs=new Set<string>();
 const athletes=new Set<number>();
 for(const team of catalog.teams){
   const buyer=organizations.get(team.organization);
   const mode=leagues.get(team.league) as Mode|undefined;
   const recent=historyByClub.get(team.organization)??[];
   if(!buyer||!mode||clubs.has(buyer.id)||count(recent)>=limits.club)continue;
   if(hashSeed(seed+':market:'+day+':'+team.id)%100>=6)continue;
   for(const role of roles[mode]){
     const incumbent=slots.get(team.id+':'+role);
     const candidates=pool.get(roleKey(mode,role))??[];
     const start=hashSeed(seed+':'+day+':'+team.id+':'+role)%candidates.length;
     let best:{player:Player;interest:number;seller:string;fee:number}|undefined;
     for(let offset=0;offset<Math.min(24,candidates.length);offset++){
       const player=candidates[(start+offset)%candidates.length];
       const seller=owners.has(player.id)?'career':player.organization!;
       if(seller===buyer.id||athletes.has(player.id))continue;
       const prior=historyByPlayer.get(player.id)??[];
       if(count(prior)>=limits.athlete||prior.some(row=>row.state==='open'&&row.expires>=day))continue;
       if(prior.some(row=>row.organization===buyer.id&&day-row.day<(row.state==='declined'?limits.refused:limits.repeat)))continue;
       const interest=marketInterest(player,{reputation:buyer.reputation,academy:team.academy},incumbent,day,evidence.get(player.id),false,owners.get(player.id));
       if(!interest||interest<=(best?.interest??0))continue;
       const fee=Math.round(transferValue(player)*.8/100)*100;
       if(affordable(buyer.id,player,fee))best={player,interest,seller,fee};
     }
     if(!best||hashSeed(seed+':bid:'+day+':'+team.id+':'+role)%10000>=best.interest*10000)continue;
     result.push({organization:buyer.id,team:team.id,playerId:best.player.id,seller:best.seller,role,
       name:team.name,fee:best.fee,day,expires:day+limits.expires,state:'open'});
     clubs.add(buyer.id);athletes.add(best.player.id);break;
   }
 }
 return result;
}
