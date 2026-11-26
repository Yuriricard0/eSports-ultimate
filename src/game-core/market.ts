import {terms,type Player} from './recruitment.ts';
import {roles,type Mode} from './attributes.ts';
import {salaryDue} from './calendar.ts';
import type {WorldCatalog} from './world.ts';
import {recordCash} from './finance.ts';
import {validateSquadRole,type SquadRole} from './contract-expectations.ts';

type Bind=(string|number)[];
type Row=Record<string,unknown>;
type Run=(sql:string,bind:Bind)=>void;
type Read=(sql:string,bind:Bind)=>Row|undefined;
type All=(sql:string,bind:Bind)=>Row[];
export type SaleOption={organization:string;team:string;fee:number;name:string};

export function transferValue(player:Pick<Player,'overall'>){return terms(player.overall).bonus*2;}

export function sellerAskingPrice(player:Pick<Player,'id'|'organization'|'team'|'role'|'overall'>,players:Player[]){
 if(!player.organization)return 0;
 const estimate=transferValue(player);
 if(!player.team)return estimate;
 const hasCover=players.some(candidate=>candidate.id!==player.id&&candidate.team===player.team&&candidate.role===player.role&&!candidate.status);
 return hasCover?estimate:Math.round(estimate*1.1/100)*100;
}

export function saleOptions(player:Player,catalog:WorldCatalog,players:Player[],affordable?:(organization:string,fee:number)=>boolean):SaleOption[]{
 const organizations=new Map(catalog.organizations.map(org=>[org.id,org]));
 const leagues=new Map(catalog.leagues.map(league=>[league.id,league]));
 return catalog.teams.filter(team=>{
   const org=organizations.get(team.organization);
   if(!org||leagues.get(team.league)?.discipline!==player.mode||player.organization===org.id)return false;
   const incumbent=players.filter(p=>p.team===team.id&&p.role===player.role);
   return player.overall<=org.reputation+25&&(!incumbent.length||Math.max(...incumbent.map(p=>p.overall))<=player.overall+3);
 }).map(team=>({organization:team.organization,team:team.id,name:team.name,fee:Math.round(transferValue(player)*.8/100)*100}))
   .filter(option=>!affordable||affordable(option.organization,option.fee))
   .sort((a,b)=>a.name.localeCompare(b.name)).slice(0,20);
}

export function maintainRosters(players:Player[],catalog:WorldCatalog,owned:Set<number>,day:number,canHire?:(organization:string,player:Player)=>boolean):Player[]{
 const result=players.slice();
 const leagues=new Map(catalog.leagues.map(league=>[league.id,league]));
 const rep=new Map(catalog.organizations.map(org=>[org.id,org.reputation]));
 const occupied=new Set(players.filter(p=>p.team&&!owned.has(p.id)&&p.status!=='retired').map(p=>p.team+':'+p.role));
 const available=new Map<string,Player[]>(),positions=new Map<Player,number>(),taken=new Set<number>();
 players.forEach((player,index)=>{
   positions.set(player,index);
   if(player.organization||player.team||player.status||owned.has(player.id))return;
   const key=player.mode+':'+player.role,list=available.get(key)??[];list.push(player);available.set(key,list);
 });
 for(const team of catalog.teams){
   const mode=leagues.get(team.league)?.discipline as Mode|undefined;
   if(!mode)continue;
   for(const role of roles[mode]){
     if(occupied.has(team.id+':'+role))continue;
     const target=rep.get(team.organization)??50;
     const candidates=(available.get(mode+':'+role)??[]).filter(player=>!taken.has(player.id));
     candidates.sort((a,b)=>Math.abs(a.overall-target)-Math.abs(b.overall-target)||a.id-b.id);
     const pick=candidates.find(player=>!canHire||canHire(team.organization,player));
     if(!pick)continue;
     taken.add(pick.id);occupied.add(team.id+':'+role);
     result[positions.get(pick)!]={...pick,organization:team.organization,team:team.id,
       history:[{day,description:'Contratado por '+team.name+' para completar o elenco.'},...(pick.history??[])]};
   }
 }
 return result;
}

export function renewContract(run:Run,read:Read,all:All,careerId:string,playerId:number,salary:number,days:number,squadRole?:SquadRole){
 validateSquadRole(squadRole);
 if(![180,365,730].includes(days)||!Number.isSafeInteger(salary)||salary<100||salary>1000000000)throw Error('Confira salário e duração.');
 run('BEGIN IMMEDIATE',[]);
 try{
   const contract=read('SELECT * FROM web_current_contracts WHERE career_id=? AND player_id=?',[careerId,playerId]);
   if(!contract)throw Error('Não há contrato ativo para renovar.');
   const career=read('SELECT day,balance FROM careers WHERE id=?',[careerId])!;
   if(salary<Number(contract.salary))throw Error('A renovação deve manter ou aumentar o salário atual.');
   const committed=all('SELECT salary FROM web_current_contracts WHERE career_id=? AND player_id<>?',[careerId,playerId])
     .reduce((sum,row)=>sum+Number(row.salary),0);
   if(Number(career.balance)<committed+salary||read('SELECT 1 FROM web_payroll WHERE career_id=? AND paid<amount',[careerId]))throw Error('Saldo insuficiente ou folha salarial em atraso.');
   const day=Number(career.day),start=Number(contract.start_day);
   const last=read("SELECT day FROM web_market_moves WHERE career_id=? AND player_id=? AND day=? AND kind='renewed'",[careerId,playerId,day]);
   if(last)throw Error('Este contrato já foi renovado hoje.');
   run('INSERT OR IGNORE INTO web_salary_rates VALUES(?,?,?,?,?)',[careerId,playerId,start,start,Number(contract.salary)]);
   run('INSERT INTO web_salary_rates VALUES(?,?,?,?,?) ON CONFLICT(career_id,player_id,start_day,day) DO UPDATE SET salary=excluded.salary',[careerId,playerId,start,day,salary]);
   run('UPDATE web_contracts SET salary=?,end_day=end_day+? WHERE career_id=? AND player_id=? AND start_day=?',[salary,days,careerId,playerId,start]);
   if(squadRole)run(`INSERT INTO web_contract_expectations VALUES(?,?,?,?,?)
     ON CONFLICT(career_id,player_id,start_day) DO UPDATE SET squad_role=excluded.squad_role,promised_day=excluded.promised_day`,
     [careerId,playerId,start,squadRole,day]);
   run("UPDATE web_renewal_requests SET state='renewed' WHERE career_id=? AND player_id=? AND start_day=? AND state='pending'",[careerId,playerId,start]);
   run('INSERT INTO web_market_moves VALUES(?,?,?,?,?,?)',[careerId,playerId,day,'renewed',0,'Contrato renovado por '+days+' dias. Salário: '+salary/100+'.']);
   run('COMMIT',[]);
 }catch(error){run('ROLLBACK',[]);throw error;}
}

export function departPlayer(run:Run,read:Read,all:All,careerId:string,player:Player,buyer?:Pick<SaleOption,'organization'|'team'|'fee'>,onDepart?:(day:number)=>void){
 if(buyer&&(!buyer.organization||!buyer.team||!Number.isSafeInteger(buyer.fee)||buyer.fee<=0))throw Error('Proposta de compra inválida.');
 run('BEGIN IMMEDIATE',[]);
 try{
   const contract=read('SELECT * FROM web_current_contracts WHERE career_id=? AND player_id=?',[careerId,player.id]);
   const legacy=read('SELECT member,starter FROM web_imported_players WHERE career_id=? AND player_id=?',[careerId,player.id]);
   const historical=read('SELECT 1 FROM web_contracts WHERE career_id=? AND player_id=?',[careerId,player.id]);
   if(!contract&&(!legacy?.member||historical))throw Error('O atleta não possui contrato ativo neste elenco.');
   const career=read('SELECT day,balance FROM careers WHERE id=?',[careerId])!;
   const day=Number(career.day),fee=buyer?.fee??0;
   let owed=0;
   if(contract){
     const start=Number(contract.start_day),last=day-1;
     const period=start+Math.floor((day-start)/30)*30;
     if(last>=period){
       const recorded=all('SELECT amount FROM web_payroll WHERE career_id=? AND player_id=? AND start_day=? AND due_day BETWEEN ? AND ?',
         [careerId,player.id,start,period,period+29]).reduce((sum,row)=>sum+Number(row.amount),0);
       owed=Math.max(0,salaryDue(all,careerId,contract,period,last)-recorded);
       const oldPaid=Number(read('SELECT paid FROM web_payroll WHERE career_id=? AND player_id=? AND start_day=? AND due_day=?',[careerId,player.id,start,last])?.paid??0);
       const paid=Math.min(owed,Number(career.balance)+fee);
       if(owed>0)run(`INSERT INTO web_payroll VALUES(?,?,?,?,?,?) ON CONFLICT(career_id,player_id,start_day,due_day)
         DO UPDATE SET amount=amount+excluded.amount,paid=paid+excluded.paid`,[careerId,player.id,start,last,owed,paid]);
       if(paid>0)recordCash(run,careerId,'salary:'+player.id+':'+start+':'+last+':'+(oldPaid+paid),day,'salary',-paid,'Acerto proporcional na saída do atleta '+player.id+'.');
     }
     run('UPDATE web_contracts SET starter=0 WHERE career_id=? AND player_id=?',[careerId,player.id]);
     run('INSERT INTO web_contract_closures VALUES(?,?,?,?,?)',[careerId,player.id,start,day,buyer?'sold':'released']);
   }
   run('UPDATE web_imported_players SET member=0,starter=0 WHERE career_id=? AND player_id=?',[careerId,player.id]);
   run('UPDATE careers SET balance=? WHERE id=?',[Math.max(0,Number(career.balance)+fee-owed),careerId]);
   if(Number(contract?.starter??legacy?.starter)===1){
     const legacyStarters=read(`SELECT 1 FROM web_imported_players p WHERE career_id=? AND member=1 AND starter=1 AND json_extract(data,'$.role')=?
       AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)`,[careerId,player.role]);
     const reserve=read(`SELECT player_id,start_day,starter FROM web_current_contracts c WHERE career_id=? AND role=?
       AND NOT EXISTS(SELECT 1 FROM web_player_training t WHERE t.career_id=c.career_id AND t.player_id=c.player_id AND t.academy=1)
       ORDER BY starter DESC,start_day,player_id LIMIT 1`,[careerId,player.role]);
     if(!legacyStarters&&reserve&&!reserve.starter)run('UPDATE web_contracts SET starter=1 WHERE career_id=? AND player_id=? AND start_day=?',[careerId,Number(reserve.player_id),Number(reserve.start_day)]);
     if(!legacyStarters&&!reserve)run(`UPDATE web_imported_players SET starter=1 WHERE career_id=? AND player_id IN (
       SELECT p.player_id FROM web_imported_players p WHERE career_id=? AND member=1 AND json_extract(data,'$.role')=?
       AND NOT EXISTS(SELECT 1 FROM web_player_training t WHERE t.career_id=p.career_id AND t.player_id=p.player_id AND t.academy=1)
       AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id) ORDER BY player_id LIMIT 1)`,[careerId,careerId,player.role]);
   }
   const description=buyer?'Vendido para '+buyer.organization+'.':'Dispensado; vínculo encerrado.';
   run('INSERT INTO web_market_moves VALUES(?,?,?,?,?,?)',[careerId,player.id,day,buyer?'sold':'released',fee,description]);
   if(fee>0)recordCash(run,careerId,'sale:'+player.id+':'+day+':'+Number(contract?.start_day??0),day,'sale',fee,description);
   run("UPDATE web_negotiations SET state='cancelled' WHERE career_id=? AND player_id=? AND state IN ('accepted','counter')",[careerId,player.id]);
   onDepart?.(day);
   run('COMMIT',[]);
 }catch(error){run('ROLLBACK',[]);throw error;}
}
