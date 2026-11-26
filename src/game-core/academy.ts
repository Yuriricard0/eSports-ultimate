import {athleteAge} from './development.ts';
import type {Player} from './recruitment.ts';
import {additionalFocuses,trainingNames} from './training.ts';

type Bind=(string|number)[];
type Row=Record<string,unknown>;
type Run=(sql:string,bind:Bind)=>void;
type Read=(sql:string,bind:Bind)=>Row|undefined;

export function academyEligible(player:Pick<Player,'birthDay'|'status'>,day:number){
 const age=athleteAge(player.birthDay,day);
 return !player.status&&age>=16&&age<=21;
}

function editOwned(run:Run,read:Read,careerId:string,player:Player,edit:(day:number)=>void){
 run('BEGIN IMMEDIATE',[]);
 try{
   const career=read('SELECT day,mode FROM careers WHERE id=?',[careerId]);
   if(!career||career.mode!==player.mode)throw Error('Confira a modalidade da carreira.');
   const contract=read('SELECT 1 FROM web_current_contracts WHERE career_id=? AND player_id=?',[careerId,player.id]);
   const legacy=read(`SELECT 1 FROM web_imported_players p WHERE career_id=? AND player_id=? AND member=1
     AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)`,[careerId,player.id]);
   if((!contract&&!legacy)||player.status==='retired')throw Error('O atleta precisa de vínculo ativo com o elenco.');
   edit(Number(career.day));
   run('COMMIT',[]);
 }catch(error){run('ROLLBACK',[]);throw error;}
}

function fillMainStarter(run:Run,read:Read,careerId:string,role:string){
 const legacy=read(`SELECT p.player_id,p.starter FROM web_imported_players p WHERE career_id=? AND member=1 AND json_extract(data,'$.role')=?
   AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)
   AND NOT EXISTS(SELECT 1 FROM web_player_training t WHERE t.career_id=p.career_id AND t.player_id=p.player_id AND t.academy=1)
   ORDER BY starter DESC,player_id LIMIT 1`,[careerId,role]);
 const contract=read(`SELECT c.player_id,c.start_day,c.starter FROM web_current_contracts c WHERE career_id=? AND role=?
   AND NOT EXISTS(SELECT 1 FROM web_player_training t WHERE t.career_id=c.career_id AND t.player_id=c.player_id AND t.academy=1)
   ORDER BY starter DESC,start_day,player_id LIMIT 1`,[careerId,role]);
 if(legacy?.starter||contract?.starter)return;
 if(contract)run('UPDATE web_contracts SET starter=1 WHERE career_id=? AND player_id=? AND start_day=?',[careerId,Number(contract.player_id),Number(contract.start_day)]);
 else if(legacy)run('UPDATE web_imported_players SET starter=1 WHERE career_id=? AND player_id=?',[careerId,Number(legacy.player_id)]);
}

export function assignAcademy(run:Run,read:Read,careerId:string,player:Player,academy:boolean){
 if(typeof academy!=='boolean')throw Error('Selecione Academy ou elenco principal.');
 editOwned(run,read,careerId,player,day=>{
   if(academy&&!academyEligible(player,day))throw Error('A entrada na Academy exige idade entre 16 e 21 anos.');
   run(`INSERT INTO web_player_training(career_id,player_id,academy,changed_day) VALUES(?,?,?,?)
     ON CONFLICT(career_id,player_id) DO UPDATE SET academy=excluded.academy`,[careerId,player.id,Number(academy),day]);
   if(academy){
     run('UPDATE web_contracts SET starter=0 WHERE career_id=? AND player_id=?',[careerId,player.id]);
     run('UPDATE web_imported_players SET starter=0 WHERE career_id=? AND player_id=?',[careerId,player.id]);
   }
   fillMainStarter(run,read,careerId,player.role);
 });
}

export function setTrainingFocus(run:Run,read:Read,careerId:string,player:Player,focus:string){
 if(!Object.hasOwn(trainingNames,focus))throw Error('Foco de treinamento inválido.');
 editOwned(run,read,careerId,player,day=>{
   const extended=additionalFocuses.includes(focus);
   run(`INSERT INTO web_player_training(career_id,player_id,focus,changed_day) VALUES(?,?,?,?)
     ON CONFLICT(career_id,player_id) DO UPDATE SET focus=excluded.focus,changed_day=excluded.changed_day`,[careerId,player.id,extended?'balanced':focus,day]);
   if(extended)run('INSERT INTO web_training_focus_overrides VALUES(?,?,?) ON CONFLICT(career_id,player_id) DO UPDATE SET focus=excluded.focus',[careerId,player.id,focus]);
   else run('DELETE FROM web_training_focus_overrides WHERE career_id=? AND player_id=?',[careerId,player.id]);
 });
}
