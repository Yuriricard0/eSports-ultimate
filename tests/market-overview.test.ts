import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {workerHarness} from './helpers/worker-harness.ts';
import {marketUsage,usageLabel} from '../src/game-core/market-overview.ts';
import type {Season} from '../src/game-core/competitions.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';

test('utilização conta séries da equipe atual e começa na primeira presença comprovada',()=>{
 const games=[1,2,3,4,5,6].map(day=>({home:'club',away:'rival',result:{completedDay:day,maps:[{
   teams:[{id:'club'},{id:'rival'}],
   stats:day===3?[{playerId:7,team:0,kills:4,assists:0,deaths:1}]:[],
 }]}}));
 const seasons=[{editions:[{fixtures:games}]}] as unknown as Season[];
 const players=[{id:7,team:'club'},{id:8,team:'club'},{id:9,team:'rival'},{id:7,team:'club',history:[{day:4,description:'Transferido para clube.'}]}];
 const result=new Map(marketUsage(seasons,6,players));
 assert.deepEqual(result.get(7),{played:1,available:4,impact:3});
 assert.equal(usageLabel(result.get(7)),'Pouco utilizado');
 assert.equal(result.has(8),false);
 assert.equal(marketUsage(seasons,6,[players[3]]).length,0);
});

test('alvos são únicos por carreira e sobrevivem à restauração de backup',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   const request=workerHarness(db,{organizations:[],teams:[],leagues:[]});
   await request('list');
   const insert=db.prepare('INSERT INTO careers (id,name,code,country,mode,difficulty,balance,color,symbol,created,day) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
   for(const id of ['a','b'])insert.run(id,'Aurora','AUR','BR','MOBA','Normal',1,'#ef123b','animals_wolf','2026',1);
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',10,1,JSON.stringify([{id:7}]));
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('b',10,1,'[]');
   for(let i=0;i<2;i++)assert.equal(JSON.stringify(await request('market-target',{careerId:'a',playerId:7,tracked:true})),'[7]');
   assert.equal(JSON.stringify((await request('market-overview','b')).targets),'[]');
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},(()=>{let i=0;return ()=>'copy'+ ++i;})());
   const restored=db.prepare("SELECT career_id FROM web_market_targets WHERE career_id LIKE 'copy%'").get();
   assert.ok(restored);
   assert.equal(JSON.stringify((await workerHarness(db,{organizations:[],teams:[],leagues:[]})('market-overview',restored.career_id)).targets),'[7]');
   assert.equal(JSON.stringify(await request('market-target',{careerId:'a',playerId:7,tracked:false})),'[]');
 }finally{db.close();}
});
