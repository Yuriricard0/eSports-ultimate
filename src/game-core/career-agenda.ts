import type {Mode} from './attributes.ts';
import type {Career} from './career.ts';
import {fixtureStageName,isScheduledFixture,type Season} from './competitions.ts';
import type {StoredMatch} from './match-store.ts';
import type {Contract} from './recruitment.ts';
import {seasonBoundaries} from './renewal.ts';
import {nextSeasonStart} from './competition-store.ts';
import {registrationDeadline} from './competition-registration.ts';

export type AgendaEvent={id:string;day:number;mode:Mode|null;label:string;own:boolean;target:'fixture'|'matches'|'roster'|'training'|'competitions'|null;fixtureId?:string;status?:'confirmed'|'forecast'};

export function careerAgenda(career:Pick<Career,'name'|'mode'|'day'>,seasons:Season[],matches:StoredMatch[],contracts:Contract[],names:Map<number,string>){
 const mode=career.mode==='FPS'?'FPS':'MOBA';
 const entries:AgendaEvent[]=(seasons[0]?.editions??[]).flatMap(edition=>{
   const teams=new Map(edition.participants.map(team=>[team.id,team.name]));
   return edition.fixtures.filter(isScheduledFixture).map(game=>{
     const own=game.home==='career'||game.away==='career';
     const teamName=(id:string)=>id==='career'?career.name:teams.get(id)??id;
     return {id:`official:${game.id}`,day:game.day,mode:edition.mode,own,target:own?'fixture':null,fixtureId:game.id,
       label:`${edition.name} · ${teamName(game.home)} × ${teamName(game.away)} · ${fixtureStageName(edition,game)} · MD${game.bestOf}`} satisfies AgendaEvent;
   });
 });
 for(const edition of seasons[0]?.editions??[]){
   const window=edition.entryWindow;
   if(!window?.eligible||window.closes<career.day||edition.participants.some(team=>team.id==='career'))continue;
   if(window.opens>=career.day)entries.push({id:edition.id+':entry-open',day:window.opens,mode:edition.mode,own:true,target:'competitions',label:'Abertura das inscrições · '+edition.name});
   entries.push({id:edition.id+':entry-close',day:window.closes,mode:edition.mode,own:true,target:'competitions',label:'Último dia de inscrição · '+edition.name});
 }
 for(const match of matches)if(!match.result)entries.push({id:`friendly:${match.id}`,day:match.day,mode:match.mode,own:true,target:'matches',label:'Amistoso preparado'});
 for(const contract of contracts)if(contract.salary>0&&contract.end_day>=career.day){
   entries.push({id:`contract:${contract.player_id}`,day:contract.end_day,mode,own:true,target:'roster',label:`Fim do contrato · ${names.get(contract.player_id)??'Atleta '+contract.player_id}`});
 }
 const anniversary=seasonBoundaries(career.day-1,career.day+366)[0];
 if(anniversary!==undefined)entries.push({id:`anniversary:${anniversary}`,day:anniversary,mode:null,own:true,target:null,label:`Aniversário de ${career.name}`});
 return entries.sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
}

export function competitionCalendar(career:Pick<Career,'day'>,season:Season|undefined):AgendaEvent[]{
 if(!season)return [];
 const events:AgendaEvent[]=[];
 const add=(id:string,day:number,mode:Mode|null,label:string,own:boolean,status:NonNullable<AgendaEvent['status']>)=>{
   if(day>=career.day)events.push({id,day,mode,label,own,status,target:'competitions'});
 };
 add('season-open:'+season.number,season.startDay,null,'Abertura da temporada '+season.year,true,'confirmed');
 const transition=nextSeasonStart(season,Math.max(career.day,season.endDay+1));
 add('season-next:'+season.number,transition,null,'Transição para a próxima temporada',true,'forecast');
 for(const event of season.editions){
   const own=event.participants.some(team=>team.id==='career');
   const pending=event.qualifierSource&&!event.fixtures.length||event.internationalSources&&!event.participants.length;
   if(!event.champion){
     add(event.id+':start',event.startDay,event.mode,'Início · '+event.name,own,pending?'forecast':'confirmed');
     add(event.id+':end',event.endDay,event.mode,'Fase final · '+event.name,own,event.fixtures.some(g=>g.phase==='final'&&g.day===event.endDay)?'confirmed':'forecast');
     if(own){
       add(event.id+':prep',Math.max(season.startDay,event.startDay-7),event.mode,'Início da preparação · '+event.name,true,'forecast');
       if(season.rosterRegistration)add(event.id+':roster',registrationDeadline(event),event.mode,'Prazo de inscrição do elenco · '+event.name,true,'confirmed');
     }
     const splits=new Set(event.fixtures.flatMap(game=>game.split&&game.split>1?[game.split]:[]));
     for(const split of splits){
       const day=Math.min(...event.fixtures.filter(game=>game.split===split).map(game=>game.day));
       add(event.id+':split:'+split,day,event.mode,'Início da etapa '+split+' · '+event.name,own,'confirmed');
     }
   }
   if(season.pyramid?.playIn!==event.key)
     add(event.id+':projected',transition+(event.startDay-season.startDay),event.mode,'Próxima temporada · '+event.name,own,'forecast');
 }
 return events;
}
