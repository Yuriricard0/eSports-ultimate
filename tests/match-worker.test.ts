import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {workerHarness} from './helpers/worker-harness.ts';
import {schema,deleteCareer} from '../src/game-core/career.ts';
import {contractSchema,hire,type Player} from '../src/game-core/recruitment.ts';
import {migrateCalendar} from '../src/game-core/calendar.ts';
import {phaseOneSchema} from '../src/game-core/identity.ts';
import {negotiationSchema} from '../src/game-core/negotiation.ts';
import {generationVersion} from '../src/game-core/generation.ts';
import {definitions,roles,type Mode} from '../src/game-core/attributes.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';

for(const mode of ['MOBA','FPS'] as const)test('partida '+mode+' persiste após recarga, impede duplicação e preserva mercado/Academy',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'uem-matches-')),path=join(dir,'career.sqlite');let db=new DatabaseSync(path);
 try{
   db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql),1);db.exec(phaseOneSchema+negotiationSchema+'PRAGMA user_version=5');
   db.prepare('INSERT INTO careers VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('a','Aurora','AUR','BR',mode,'Normal',100000000,'#aabbcc','animals_wolf','2026',1);
   const player=(id:number,role:string,opponent=false):Player=>({id,nickname:'P'+id,name:'Player '+id,mode,role,overall:55,organization:opponent?'rival-org':null,team:opponent?'rival':null,country:'BR',birthDay:-6900,portraitIndex:0,estimateLow:65,estimateHigh:75,ceiling:80,attributes:Object.fromEntries(definitions[mode].map(key=>[mode.toLowerCase()+'_'+key,55]))});
   const own=roles[mode].map((role,i)=>player(i+1,role)),rival=roles[mode].map((role,i)=>player(i+100,role,true)),academy=player(6,roles[mode][0]);
   const initial=[...own,...rival,academy];
   const run=(sql:string,bind:(string|number)[]=[])=>{db.prepare(sql).run(...bind);};
   const read=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).get(...bind);
   for(const p of [...own,academy])hire(run,read,'a',p);
   // A legacy imported starter shares the existing roster without inventing a contract.
   run('UPDATE web_contracts SET starter=0 WHERE player_id=5');
   run('INSERT INTO web_imported_players VALUES(?,?,?,?,?)',['a',-5,JSON.stringify(player(-5,roles[mode][4])),1,1]);
   run('INSERT INTO web_career_world VALUES(?,?,?,?)',['a',42,generationVersion,JSON.stringify(initial)]);
   const catalog={organizations:[{id:'rival-org',name:'Rival',code:'RIV',country:'BR',logo:'/logos/rival.png',reputation:55}],teams:[{id:'rival',organization:'rival-org',name:'Rival',league:'league',academy:false,tier:2,global_rank:50}],leagues:[{id:'league',name:'Liga',discipline:mode,tier:2,season:'2027',kind:'league',source:''}]};
   let request=workerHarness(db,catalog);
   await request('assign-academy',{careerId:'a',playerId:6,academy:true});
   const prepared=await request('prepare-match',{careerId:'a',opponentId:'rival'});
   const responses=await Promise.allSettled([request('play-match',{careerId:'a',id:prepared.id}),request('play-match',{careerId:'a',id:prepared.id})]);
   assert.equal(responses.filter(r=>r.status==='fulfilled').length,1);
   const result=(responses.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value.result;
   assert.equal(result.mode,mode);assert.equal(result.stats.length,10);assert.ok(result.stats.some((s:any)=>s.playerId===-5));
   assert.ok(!result.stats.some((s:any)=>s.playerId===6||s.playerId===5));
   const world=await request('world-players','a');
   for(const p of initial){const after=world.find((x:Player)=>x.id===p.id);assert.equal(after.overall,p.overall);assert.deepEqual(JSON.parse(JSON.stringify(after.attributes)),p.attributes);}
   const legacy=(await request('imported-players','a'))[0];assert.ok(legacy.condition.fatigue>0);assert.equal(legacy.overall,55);
   assert.equal(Number(read('SELECT COUNT(*) n FROM web_contracts')!.n),6);
   const balance=read('SELECT balance FROM careers')!.balance;
   const before=JSON.stringify(await request('matches','a'));
   db.close();db=new DatabaseSync(path);request=workerHarness(db,catalog);
   assert.equal(JSON.stringify(await request('matches','a')),before);
   await assert.rejects(()=>request('play-match',{careerId:'a',id:prepared.id}),/concluída/);
   assert.equal(read('SELECT balance FROM careers')!.balance,balance);
   // V6 backup includes the completed result and snapshots under a fresh career ID.
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=>'copy');
   const restored=await request('matches','copy');assert.equal(restored.length,1);assert.equal(restored[0].result.mvp,result.mvp);
   assert.notEqual(restored[0].id,prepared.id);
   const next=await request('prepare-match',{careerId:'a',opponentId:'rival'});
   await request('assign-academy',{careerId:'a',playerId:1,academy:true});
   await assert.rejects(()=>request('play-match',{careerId:'a',id:next.id}),/cinco|5/);
   assert.equal((await request('matches','a')).find((m:any)=>m.id===next.id).result,null);
   await request('cancel-match',{careerId:'a',id:next.id});
   assert.equal((await request('matches','a')).length,1);
   deleteCareer(run,'copy');assert.equal(read('SELECT COUNT(*) n FROM web_matches WHERE career_id=?',['copy'])!.n,0);
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();if(!resolve(dir).startsWith(resolve(tmpdir(),'uem-matches-')))throw Error('Diretório temporário inesperado.');rmSync(dir,{recursive:true,force:true});}
});
