import type {Season} from './competitions.ts';
import type {PersonalObjective} from './player-identity.ts';

export const squadRoleNames={star:'Estrela',starter:'Titular',rotation:'Rotação',reserve:'Reserva',prospect:'Promessa'};
export type SquadRole=keyof typeof squadRoleNames;
export const squadRoleExpectations:Record<SquadRole,string>={
 star:'Espera ser referência e participar de quase todas as séries oficiais.',
 starter:'Espera participação regular nas séries oficiais.',
 rotation:'Espera alternar entre a escalação e a reserva.',
 reserve:'Aceita poucas oportunidades competitivas.',
 prospect:'Espera oportunidades em competição ou desenvolvimento na Academy.',
};
export type RenewalRequest={player_id:number;start_day:number;day:number;gain:number;played:number;available:number;suggested_salary:number};
export type ContractAlert={player_id:number;start_day:number;end_day:number;level:NonNullable<ReturnType<typeof expiryLevel>>};
export const contractExpectationsSchema=`
CREATE TABLE IF NOT EXISTS web_contract_expectations (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE, player_id INTEGER NOT NULL, start_day INTEGER NOT NULL,
 squad_role TEXT NOT NULL CHECK(squad_role IN ('star','starter','rotation','reserve','prospect')),
 promised_day INTEGER NOT NULL, PRIMARY KEY(career_id,player_id,start_day)
);
CREATE TABLE IF NOT EXISTS web_renewal_requests (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE, player_id INTEGER NOT NULL, start_day INTEGER NOT NULL,
 day INTEGER NOT NULL,gain REAL NOT NULL,played INTEGER NOT NULL,available INTEGER NOT NULL,suggested_salary INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','declined','renewed')), PRIMARY KEY(career_id,player_id,start_day,day)
);`;

export function validateSquadRole(role:SquadRole|undefined){
 if(role!==undefined&&!Object.hasOwn(squadRoleNames,role))throw Error('Selecione um papel válido no elenco.');
}

export function expiryLevel(remaining:number){
 if(remaining<0)return 'Encerrado';
 if(remaining<=30)return 'Urgência';
 if(remaining<=90)return 'Atenção';
 if(remaining<=180)return 'Acompanhamento';
 return null;
}

export function contractCost({transferFee=0,bonus,salary,days}:{transferFee?:number;bonus:number;salary:number;days:number}){
 const immediate=transferFee+bonus;
 return {immediate,monthly:salary,total:immediate+Math.floor(days/30)*salary+Math.round((days%30)*salary/30)};
}

type Participation={available:number;played:number};
export function expectationDelta(role:SquadRole,usage:Participation,academy:boolean,objective?:PersonalObjective){
 if(usage.available<4)return 0;
 const rate=usage.played/usage.available;
 const target={star:.85,starter:.7,rotation:.4,reserve:0,prospect:.25}[role];
 if(role==='prospect'&&academy)return 1;
 if(rate>=target)return role==='reserve'&&usage.played===0?0:1;
 return rate+0.25<target&&objective!=='stability'?-2:-1;
}

export function renewalGrounds(evidence:Participation&{gain:number;impact:number;elapsed:number;salary:number;benchmark:number}){
 return evidence.elapsed>=90&&evidence.gain>=3&&evidence.available>=4&&evidence.played/evidence.available>=.6&&
   evidence.impact>=0&&evidence.benchmark>=evidence.salary*1.15;
}

export function contractFixtures(season:Season|undefined,day:number){
 return (season?.editions??[]).flatMap(edition=>edition.fixtures.flatMap(fixture=>{
   const result=fixture.result;
   if(!result||result.completedDay>day||result.completedDay<day-59||
      (fixture.home!=='career'&&fixture.away!=='career'))return [];
   const appearances=new Map<number,number>();
   for(const map of result.maps){
     const side=map.teams.findIndex(team=>team.id==='career');
     if(side<0)continue;
     for(const stat of map.stats)if(stat.team===side){
       const impact=stat.kills+stat.assists*.35-stat.deaths;
       appearances.set(stat.playerId,Math.max(appearances.get(stat.playerId)??-Infinity,impact));
     }
   }
   return [{day:result.completedDay,mode:edition.mode,appearances,won:result.winner==='career'}];
 }));
}

export function contractParticipation(fixtures:ReturnType<typeof contractFixtures>,playerId:number,mode:string,from:number){
 const opportunities=fixtures.filter(fixture=>fixture.mode===mode&&fixture.day>=from);
 const impacts=opportunities.flatMap(fixture=>fixture.appearances.has(playerId)?[fixture.appearances.get(playerId)!]:[]);
 return {available:opportunities.length,played:impacts.length,impact:impacts.reduce((sum,value)=>sum+value,0)/Math.max(1,impacts.length)};
}
