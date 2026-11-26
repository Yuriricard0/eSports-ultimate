import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {workerHarness} from './helpers/worker-harness.ts';
import {schema} from '../src/game-core/career.ts';
import {contractSchema,terms,type Player} from '../src/game-core/recruitment.ts';
import {migrateCalendar} from '../src/game-core/calendar.ts';
import {phaseOneSchema} from '../src/game-core/identity.ts';
import {negotiationSchema} from '../src/game-core/negotiation.ts';
import {generationVersion} from '../src/game-core/generation.ts';
import {transferValue} from '../src/game-core/market.ts';

const base:Player={id:1,nickname:'A',name:'Player A',mode:'MOBA',role:'top',overall:45,organization:'rival',team:'team',country:'BR',birthDay:-7000,portraitIndex:0,estimateLow:50,estimateHigh:60,attributes:{},personality:'balanced'};
const players=[base,{...base,id:2,nickname:'B',role:'jungle'},...['top','jungle','mid','adc','support_moba'].map((role,index)=>({...base,id:10+index,role,organization:null,team:null})),{...base,id:20,nickname:'Livre',overall:40,organization:null,team:null}];
const catalog={organizations:[{id:'rival',name:'Rival',code:'RIV',country:'BR',logo:'',reputation:50}],teams:[{id:'team',organization:'rival',name:'Rival',league:'league',academy:false,tier:2,global_rank:50}],leagues:[{id:'league',name:'Liga',discipline:'MOBA',tier:2,season:'2027',kind:'league',source:''}]};

test('operações reais do worker preservam duas compras simultâneas e sobrevivem à reabertura',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'uem-market-'));const path=join(dir,'test.sqlite');let db=new DatabaseSync(path);
 try{
   db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql),1);db.exec(phaseOneSchema+negotiationSchema+'PRAGMA user_version=4');
   db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',100000000,'#aabbcc','animals_wolf','2026',1)");
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',42,generationVersion,JSON.stringify(players));
   let request=workerHarness(db,catalog);
   await Promise.all([1,2].map(playerId=>request('submit-offer',{careerId:'a',playerId,offer:{...terms(45),transferFee:transferValue(base)}})));
   const offers=await request('negotiations','a');
   await Promise.all(offers.map((offer:any)=>request('confirm-offer',{careerId:'a',id:offer.id})));
   const world=await request('world-players','a');
   assert.equal(world.find((p:Player)=>p.id===1).organization,null);
   assert.equal(world.find((p:Player)=>p.id===2).organization,null);
   assert.equal(world.filter((p:Player)=>p.team==='team').length,5);
   assert.equal((await request('contracts','a')).length,2);
   await request('renew-contract',{careerId:'a',playerId:1,salary:300000,days:180});
   const before=await request('market-moves','a');
   db.close();db=new DatabaseSync(path);request=workerHarness(db,catalog);
   assert.equal((await request('contracts','a')).find((c:any)=>c.player_id===1).end_day,545);
   assert.deepEqual(JSON.parse(JSON.stringify(await request('market-moves','a'))),JSON.parse(JSON.stringify(before)));
   const buyers=await request('sale-options',{careerId:'a',playerId:1});
   assert.ok(buyers.length);
   // Refusing/closing sale options has no side effects.
   assert.equal((await request('contracts','a')).length,2);
   await request('depart-player',{careerId:'a',playerId:1,team:buyers[0].team});
   assert.equal((await request('contracts','a')).length,1);
   assert.equal((await request('world-players','a')).find((p:Player)=>p.id===1).organization,'rival');
   const balance=Number(db.prepare('SELECT balance FROM careers').get()!.balance);
   db.exec('UPDATE careers SET balance=100');
   await assert.rejects(()=>request('submit-offer',{careerId:'a',playerId:20,offer:terms(40)}),/Saldo insuficiente/);
   assert.equal(Number(db.prepare('SELECT balance FROM careers').get()!.balance),100);
   db.prepare('UPDATE careers SET balance=?').run(balance);
   await request('submit-offer',{careerId:'a',playerId:20,offer:terms(40)});
   const open=(await request('negotiations','a')).find((n:any)=>n.player_id===20);
   await request('cancel-offer',{careerId:'a',id:open.id});
   assert.equal((await request('negotiations','a')).find((n:any)=>n.id===open.id).state,'cancelled');
   assert.equal((await request('contracts','a')).length,1);
   await request('submit-offer',{careerId:'a',playerId:20,offer:terms(40)});
   const next=(await request('negotiations','a')).find((n:any)=>n.player_id===20&&n.state==='accepted');
   await request('confirm-offer',{careerId:'a',id:next.id});
   assert.equal((await request('contracts','a')).length,2);
   await request('depart-player',{careerId:'a',playerId:20});
   assert.equal((await request('contracts','a')).length,1);
   assert.equal((await request('world-players','a')).find((p:Player)=>p.id===20).organization,null);
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{
   db.close();
   if(!resolve(dir).startsWith(resolve(tmpdir(),'uem-market-')))throw Error('Diretório temporário inesperado.');
   rmSync(dir,{recursive:true,force:true});
 }
});
test('ciclo de mercado é único por dia e a recusa sobrevive à recarga',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql),1);db.exec(phaseOneSchema+negotiationSchema);
   db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',100000000,'#aabbcc','animals_wolf','2026',1)");
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',42,generationVersion,JSON.stringify(players));
   const request=workerHarness(db,catalog);
   await request('submit-offer',{careerId:'a',playerId:20,offer:terms(40)});
   const negotiation=(await request('negotiations','a'))[0];
   await request('confirm-offer',{careerId:'a',id:negotiation.id});
   await request('advance',{careerId:'a',expectedDay:1,days:7});
   await assert.rejects(()=>request('advance',{careerId:'a',expectedDay:1,days:7}));
   assert.equal(db.prepare('SELECT COUNT(*) count FROM web_ai_market_days').get()!.count,1);
   const data={organization:'rival',team:'team',name:'Rival',fee:20000,day:8,expires:22,seller:'career',role:'top',playerId:20,state:'open'};
   db.prepare('INSERT INTO web_ai_approaches VALUES(?,?,?,?,?)').run('a',8,'rival',20,JSON.stringify(data));
   assert.equal((await request('incoming-approaches','a')).length,1);
   await request('decline-approach',{careerId:'a',playerId:20,team:'team'});
   assert.equal((await workerHarness(db,catalog)('incoming-approaches','a')).length,0);
   assert.equal(JSON.parse(String(db.prepare('SELECT data FROM web_ai_approaches WHERE day=8').get()!.data)).state,'declined');
 }finally{db.close();}
});
