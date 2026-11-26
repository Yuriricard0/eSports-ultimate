import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {roles} from '../src/game-core/attributes.ts';
import {loanContracts,loanPlayers,type Loan} from '../src/game-core/loans.ts';
import {eligibleMobaLineup,isMobaImport,mobaImports} from '../src/game-core/moba-eligibility.ts';
import type {Player,Contract} from '../src/game-core/recruitment.ts';
import {workerHarness} from './helpers/worker-harness.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';

test('seleciona escalação elegível com reservas e mantém nacionalidade do residente',()=>{
 const candidates=roles.MOBA.flatMap((role,index)=>[{
   player:{id:index+1,mode:'MOBA',role,country:'KR',overall:80} as Player,role,startDay:1,
 },{player:{id:index+10,mode:'MOBA',role,country:'BR',overall:70} as Player,role,startDay:1}]);
 const lineup=eligibleMobaLineup(candidates,'cblol');
 assert.equal(lineup.length,5);
 assert.equal(mobaImports(lineup,'cblol'),2);
 const player={...candidates[0].player,mobaTenure:{cblol:1095}};
 assert.equal(isMobaImport(player,'cblol'),false);
 assert.equal(isMobaImport({...player,mobaTenure:{cblol:1094}},'cblol'),true);
 assert.equal(player.country,'KR');
});

test('empréstimo muda apenas a escalação e termina após a data final',()=>{
 const owned={id:1,role:'mid',team:null,organization:null} as Player;
 const rival={id:2,role:'mid',team:'rival',organization:'org'} as Player;
 const contracts=[{player_id:1,salary:3500,starter:1}] as Contract[];
 const loan:Loan={player_id:2,origin:'rival',destination:'career',club:'Rival',start_day:10,end_day:39,starter:1};
 assert.equal(loanPlayers([owned,rival],[loan],10)[1].team,null);
 assert.equal(loanPlayers([owned,rival],[loan],10)[1].organization,'org');
 assert.equal(loanContracts([owned,rival],contracts,[loan],39).find(row=>row.starter)?.player_id,2);
 assert.equal(loanContracts([owned,rival],contracts,[loan],39).reduce((sum,row)=>sum+row.salary,0),3500);
 assert.equal(loanPlayers([owned,rival],[loan],40)[1].team,'rival');
 assert.equal(loanContracts([owned,rival],contracts,[loan],40).find(row=>row.starter)?.player_id,1);
});

test('worker registra empréstimo sem criar contrato e restaura o retorno no save',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   const catalog={organizations:[],teams:[{id:'rival',name:'Rival',league:'cs',academy:false}],leagues:[{id:'cs',discipline:'FPS'}]};
   const request=workerHarness(db,catalog);
   await request('list');
   db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','FPS','Normal',5000000,'#aabbcc','animals_wolf','2026',1)");
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',10,1,JSON.stringify([1,2].map(id=>({id,mode:'FPS',role:'igl',overall:50,team:'rival',organization:'rival-org'}))));
   await request('create-loan',{careerId:'a',playerId:2,teamId:'rival',days:30});
   await assert.rejects(()=>request('create-loan',{careerId:'a',playerId:2,teamId:'rival',days:30}),/já está emprestado/);
   assert.equal((await request('contracts','a'))[0].loan,true);
   assert.equal(db.prepare('SELECT count(*) total FROM web_contracts').get()?.total,0);
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=> 'restored');
   assert.equal((await request('loans','restored'))[0].end_day,30);
   db.exec("UPDATE careers SET day=31 WHERE id='restored'");
   assert.equal((await request('contracts','restored')).length,0);
 }finally{db.close();}
});
