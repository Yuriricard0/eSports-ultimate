import type {Competition,Season} from './competitions.ts';
import type {Contract,Player} from './recruitment.ts';
import {mobaImports,regionalPolicies} from './moba-eligibility.ts';
import {careerLineup} from './matches.ts';
import {roles} from './attributes.ts';

export function registrationDeadline(edition:Competition){
 return edition.entryWindow?.closes??edition.startDay-1;
}

export function lockCompetitionRosters(season:Season,day:number,eligibleAt:(day:number)=>number[]){
 if(!season.rosterRegistration)return false;
 let changed=false;
 for(const event of season.editions){
   if(event.registration||event.champion||!event.participants.some(team=>team.id==='career'))continue;
   const closes=registrationDeadline(event);
   if(day<=closes)continue;
   event.registration={closes,players:eligibleAt(closes)};
   changed=true;
 }
 return changed;
}

export function competitionLineup(edition:Competition,players:Player[],contracts:Contract[],day:number){
 const pool=players.filter(player=>player.mode===edition.mode);
 const active=contracts.filter(row=>!row.academy&&row.start_day<=day&&(!row.end_day||row.end_day>=day));
 const locked=edition.registration&&new Set(edition.registration.players);
 const allowed=active.filter(row=>!locked||locked.has(row.player_id));
 const lineup=careerLineup(pool.filter(player=>!player.status),allowed);
 const starters=new Set(lineup.map(slot=>slot.player.id));
 const eligible=pool.filter(player=>allowed.some(row=>row.player_id===player.id)&&!player.status);
 const reserve=eligible.filter(player=>!starters.has(player.id));
 const unavailable=pool.flatMap(player=>{
   const linked=active.some(row=>row.player_id===player.id);
   if((!linked&&!locked?.has(player.id))||eligible.includes(player))return [];
   return [{player,reason:!linked?'Sem vínculo ativo no elenco principal ou emprestado a outro clube':
     player.status?'Atleta indisponível':'Fora da lista registrada até o prazo'}];
 });
 const overImport=!!edition.importRegion&&mobaImports(lineup,edition.importRegion)>regionalPolicies[edition.importRegion].limit;
 const missingRoles=roles[edition.mode].filter(role=>!lineup.some(slot=>slot.role===role));
 return {lineup,reserve,eligible,unavailable,overImport,missingRoles,valid:lineup.length===5&&!missingRoles.length&&!overImport};
}
