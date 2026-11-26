import type {Mode} from './attributes.ts';
import type {Career} from './career.ts';
import {isScheduledFixture,type Season} from './competitions.ts';
import type {StoredMatch} from './match-store.ts';
import type {Contract} from './recruitment.ts';
import {seasonBoundaries} from './renewal.ts';

export type AgendaEvent={id:string;day:number;mode:Mode|null;label:string;own:boolean;target:'fixture'|'matches'|'roster'|null;fixtureId?:string};

export function careerAgenda(career:Pick<Career,'name'|'mode'|'day'>,seasons:Season[],matches:StoredMatch[],contracts:Contract[],names:Map<number,string>){
 const mode=career.mode==='FPS'?'FPS':'MOBA';
 const entries:AgendaEvent[]=(seasons[0]?.editions??[]).flatMap(edition=>{
   const teams=new Map(edition.participants.map(team=>[team.id,team.name]));
   return edition.fixtures.filter(isScheduledFixture).map(game=>{
     const own=game.home==='career'||game.away==='career';
     const teamName=(id:string)=>id==='career'?career.name:teams.get(id)??id;
     return {id:`official:${game.id}`,day:game.day,mode:edition.mode,own,target:own?'fixture':null,fixtureId:game.id,
       label:`${edition.name} · ${teamName(game.home)} × ${teamName(game.away)} · MD${game.bestOf}`} satisfies AgendaEvent;
   });
 });
 for(const match of matches)if(!match.result)entries.push({id:`friendly:${match.id}`,day:match.day,mode:match.mode,own:true,target:'matches',label:'Amistoso preparado'});
 for(const contract of contracts)if(contract.salary>0&&contract.end_day>=career.day){
   entries.push({id:`contract:${contract.player_id}`,day:contract.end_day,mode,own:true,target:'roster',label:`Fim do contrato · ${names.get(contract.player_id)??'Atleta '+contract.player_id}`});
 }
 const anniversary=seasonBoundaries(career.day-1,career.day+366)[0];
 if(anniversary!==undefined)entries.push({id:`anniversary:${anniversary}`,day:anniversary,mode:null,own:true,target:null,label:`Aniversário de ${career.name}`});
 return entries.sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
}
