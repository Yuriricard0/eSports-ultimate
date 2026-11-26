import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {contractCost,contractFixtures,contractParticipation,expiryLevel,expectationDelta,renewalGrounds} from '../src/game-core/contract-expectations.ts';
import type {Season} from '../src/game-core/competitions.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';
import {workerHarness} from './helpers/worker-harness.ts';

test('custo separa desembolso imediato da folha proporcional',()=>{
 assert.deepEqual(contractCost({transferFee:1000,bonus:500,salary:3000,days:365}),{immediate:1500,monthly:3000,total:38000});
});
test('promessa reage a oportunidades reais e respeita desenvolvimento e objetivos',()=>{
 assert.equal(expectationDelta('starter',{available:0,played:0},false,'titles'),0);
 assert.equal(expectationDelta('starter',{available:4,played:0},false,'titles'),-2);
 assert.equal(expectationDelta('prospect',{available:4,played:0},true,'recognition'),1);
 assert.equal(expectationDelta('reserve',{available:4,played:0},false,'stability'),0);
});
test('renovação exige evolução, uso, tempo e salário abaixo da referência',()=>{
 const evidence={gain:4,available:6,played:5,impact:2,elapsed:120,salary:1000,benchmark:1400};
 assert.ok(renewalGrounds(evidence));
 assert.equal(renewalGrounds({...evidence,elapsed:45}),false);
 assert.equal(renewalGrounds({...evidence,played:0}),false);
 assert.equal(renewalGrounds({...evidence,salary:1400}),false);
 assert.deepEqual([181,180,90,30,0,-1].map(expiryLevel),[null,'Acompanhamento','Atenção','Urgência','Urgência','Encerrado']);
});

test('participação ignora jogos de rivais, de outras modalidades e anteriores ao vínculo',()=>{
 const fixture=(home:string,day:number,appeared:boolean)=>({home,away:'rival',result:{completedDay:day,maps:[{
   teams:[{id:home},{id:'rival'}],stats:appeared?[{playerId:7,team:0,kills:4,assists:0,deaths:1}]:[],
 }]}});
 const season={editions:[
   {mode:'MOBA',fixtures:[fixture('career',12,true),fixture('career',15,true),fixture('career',16,false),fixture('other',17,true)]},
   {mode:'FPS',fixtures:[fixture('career',17,false)]},
 ]} as unknown as Season;
 assert.deepEqual(contractParticipation(contractFixtures(season,18),7,'MOBA',13),{available:2,played:1,impact:3});
});

test('worker exibe vencimentos, resolve pedidos na renovação e restaura os termos',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   const request=workerHarness(db,{organizations:[],teams:[],leagues:[]});
   await request('list');
   db.exec(`INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',120);
     INSERT INTO web_contracts VALUES('a',7,'top',1,220000,100000,1,145);
     INSERT INTO web_contract_expectations VALUES('a',7,1,'starter',1);
     INSERT INTO web_renewal_requests VALUES('a',7,1,112,4,5,6,310000,'pending');
     INSERT INTO web_negotiations VALUES('offer','a',7,1,6,'signed',100000,220000,180,0,0,'Aceita');
     INSERT INTO web_negotiation_terms VALUES('a','offer','starter',200000,220000);`);
   assert.equal((await request('contract-alerts','a'))[0].level,'Urgência');
   assert.equal((await request('renewal-requests','a'))[0].suggested_salary,310000);
   await request('renew-contract',{careerId:'a',playerId:7,salary:310000,days:180,squadRole:'star'});
   assert.equal((await request('contracts','a'))[0].squad_role,'star');
   assert.equal((await request('renewal-requests','a')).length,0);
   assert.equal((await request('contract-alerts','a')).length,0);
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=> 'restored');
   assert.equal((await request('negotiations','restored'))[0].asking_fee,220000);
   assert.equal((await request('contracts','restored'))[0].squad_role,'star');
 }finally{db.close();}
});

test('avanço gera um pedido após evolução comprovada e mantém salário até a decisão',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   const request=workerHarness(db,{organizations:[],teams:[],leagues:[]});
   await request('list');
   db.exec(`INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',111);
     INSERT INTO web_contracts VALUES('a',7,'top',1,150000,100000,1,240);
     INSERT INTO web_contract_expectations VALUES('a',7,1,'starter',1);`);
   const athlete={id:7,nickname:'Alpha',mode:'MOBA',role:'top',overall:52,personalObjective:'recognition',
     organization:null,team:null,birthDay:-7300,attributes:{},developmentHistory:[{day:1,overall:47}]};
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',10,1,JSON.stringify([athlete]));
   const fixtures=[90,96,102,108].map(day=>({home:'career',away:'other',result:{completedDay:day,maps:[{
     teams:[{id:'career'},{id:'other'}],stats:[{playerId:7,team:0,kills:4,assists:0,deaths:1}],
   }]}}));
   db.prepare('INSERT INTO web_competition_seasons VALUES(?,?,?)').run('a',1,JSON.stringify({number:1,editions:[{mode:'MOBA',fixtures}]}));
   await request('advance',{careerId:'a',expectedDay:111,days:1});
   const [renewal]=await request('renewal-requests','a');
   assert.equal(renewal.gain,5);
   assert.equal(renewal.played,4);
   assert.equal((await request('contracts','a'))[0].salary,150000);
   await request('decline-renewal',{careerId:'a',playerId:7,startDay:1,day:112});
   assert.equal((await request('renewal-requests','a')).length,0);
 }finally{db.close();}
});
