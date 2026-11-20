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
import {competitionSchema} from '../src/game-core/competition-store.ts';
import {matchSchema} from '../src/game-core/match-store.ts';
import {generationVersion} from '../src/game-core/generation.ts';
import {definitions} from '../src/game-core/attributes.ts';
import {transferValue} from '../src/game-core/market.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';
import {currentPlayerSituation} from '../src/game-core/news.ts';

const player:Player={id:7,nickname:'Nyx',name:'Nyx Silva',mode:'MOBA',role:'top',overall:45,organization:'rival',team:'team',country:'BR',birthDay:-6900,portraitIndex:0,estimateLow:70,estimateHigh:80,ceiling:80,attributes:Object.fromEntries(definitions.MOBA.map(key=>['moba_'+key,45]))};
const catalog={organizations:[{id:'rival',name:'Rival',code:'RIV',country:'BR',logo:'',reputation:50}],teams:[{id:'team',organization:'rival',name:'Rival',league:'league',academy:false,tier:2,global_rank:50}],leagues:[{id:'league',name:'Liga',discipline:'MOBA',tier:2,season:'2027',kind:'league',source:''}]};

test('notícias reais após compra/dispensa, perfil atual, recarga, backup e eventos sem repetição',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'uem-news-')),path=join(dir,'career.sqlite');let db=new DatabaseSync(path);
 try{
   db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql),1);db.exec(phaseOneSchema+negotiationSchema+competitionSchema+matchSchema+'PRAGMA user_version=8');
   db.prepare('INSERT INTO careers VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('a','Aurora','AUR','BR','MOBA','Normal',100000000,'#ef123b','animals_wolf','2026',1);
   const world=[player,{...player,id:8,nickname:'Free',organization:null,team:null},...['jungle','mid','adc','support_moba'].map((role,index)=>({...player,id:10+index,role,organization:null,team:null}))];
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',42,generationVersion,JSON.stringify(world));
   let request=workerHarness(db,catalog);
   const list=()=>request('news',{careerId:'a',filter:{}});
   assert.equal((await list()).total,0);
   await request('submit-offer',{careerId:'a',playerId:7,offer:{...terms(45),transferFee:transferValue(player)}});
   const offered=(await request('negotiations','a'))[0];
   await request('confirm-offer',{careerId:'a',id:offered.id});
   const bought=await list();assert.ok(bought.items.some((n:any)=>n.playerId===7&&n.title.includes('transferido')));
   assert.ok(bought.items.some((n:any)=>n.summary.includes('Rival')));
   await request('depart-player',{careerId:'a',playerId:7});
   const released=await list();assert.equal(released.items.filter((n:any)=>n.playerId===7).length,2);
   let players=await request('world-players','a');assert.equal(currentPlayerSituation(players.find((p:Player)=>p.id===7),await request('contracts','a'),{rival:'Rival'},'Aurora'),'Livre no mercado');
   await request('advance',{careerId:'a',expectedDay:1,days:1});
   await request('submit-offer',{careerId:'a',playerId:7,offer:terms(45)});
   const renewed=(await request('negotiations','a')).find((n:any)=>n.player_id===7&&['accepted','counter'].includes(n.state));
   await request('confirm-offer',{careerId:'a',id:renewed.id});
   players=await request('world-players','a');assert.equal(currentPlayerSituation(players.find((p:Player)=>p.id===7),await request('contracts','a'),{rival:'Rival'},'Aurora'),'Aurora');
   let day=2;for(let index=0;index<4;index++){day=(await request('advance',{careerId:'a',expectedDay:day,days:30})).career.day;}
   const before=await list();assert.deepEqual(await list(),before);const count=Number(db.prepare('SELECT COUNT(*) n FROM web_world_events').get()!.n);
   db.close();db=new DatabaseSync(path);request=workerHarness(db,catalog);
   assert.deepEqual(JSON.parse(JSON.stringify(await list())),JSON.parse(JSON.stringify(before)));
   assert.equal(Number(db.prepare('SELECT COUNT(*) n FROM web_world_events').get()!.n),count);
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=>'copy');
   const restored=await request('news',{careerId:'copy',filter:{}});assert.deepEqual(JSON.parse(JSON.stringify(restored)),JSON.parse(JSON.stringify(before)));
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();if(!resolve(dir).startsWith(resolve(tmpdir(),'uem-news-')))throw Error('Diretório temporário inesperado.');rmSync(dir,{recursive:true,force:true});}
});
