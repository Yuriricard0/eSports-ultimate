import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {workerHarness} from './helpers/worker-harness.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';
import {definitions} from '../src/game-core/attributes.ts';
import {terms} from '../src/game-core/recruitment.ts';

test('tryout coleta evidências no calendário, preserva vínculo e só contrata após confirmação',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   const request=workerHarness(db,{organizations:[],teams:[],leagues:[]});
   await request('list');
   db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',5)");
   const attributes=Object.fromEntries(definitions.MOBA.map(key=>['moba_'+key,45]));
   const player={id:7,nickname:'Alpha',mode:'MOBA',role:'mid',status:'ranked',overall:45,attributes,birthDay:-6500,organization:null,team:null,
     rankedPerformance:{points:1450,winRate:52}};
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',10,1,JSON.stringify([player]));
   const offer={careerId:'a',playerId:7,offer:terms(45)};
   await request('start-tryout',{careerId:'a',playerId:7,days:7});
   await assert.rejects(()=>request('start-tryout',{careerId:'a',playerId:7,days:7}),/já tem uma avaliação/);
   await assert.rejects(()=>request('submit-offer',offer),/indisponível/);
   await request('advance',{careerId:'a',expectedDay:5,days:7});
   const evaluation=(await request('academy-evaluation','a')).tryouts[0];
   assert.equal(evaluation.state,'completed');
   assert.equal(evaluation.final.overall,45);
   assert.equal((await request('contracts','a')).length,0);
   assert.deepEqual(Array.from(await request('ranked-player-history',{careerId:'a',playerId:7}),(row:{day:number})=>row.day),[5,7,12]);
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=> 'restored');
   assert.equal((await request('academy-evaluation','restored')).tryouts[0].state,'completed');
   await request('submit-offer',offer);
   await request('confirm-offer',{careerId:'a',id:(await request('negotiations','a'))[0].id});
   assert.equal((await request('academy-evaluation','a')).tryouts[0].state,'signed');
   assert.equal((await request('contracts','a')).length,1);
   await request('assign-academy',{careerId:'a',playerId:7,academy:true});
   await assert.rejects(()=>request('youth-coach',{careerId:'a',enabled:true}),/nível 1/);
   db.exec("INSERT INTO web_facilities VALUES('a','academy',1,12)");
   await request('youth-coach',{careerId:'a',enabled:true});
   await request('advance',{careerId:'a',expectedDay:12,days:30});
   const academy=await request('academy-evaluation','a');
   assert.equal(academy.coach,true);
   assert.deepEqual(Array.from(academy.snapshots,(row:{day:number})=>row.day),[12,31]);
   assert.equal(academy.competitive.length,0);
 }finally{db.close();}
});
