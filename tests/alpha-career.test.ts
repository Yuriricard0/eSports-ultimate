import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {workerHarness} from './helpers/worker-harness.ts';
import {terms,type Player,type Contract} from '../src/game-core/recruitment.ts';
import {roles,type Mode} from '../src/game-core/attributes.ts';
import {athleteAge} from '../src/game-core/development.ts';
import {nextUserFixture,type Season} from '../src/game-core/competitions.ts';
import type {Career} from '../src/game-core/career.ts';
import type {WorldCatalog} from '../src/game-core/world.ts';

const catalog=JSON.parse(readFileSync('public/data/real_teams_2026.json','utf8')) as WorldCatalog;
const base=JSON.parse(readFileSync('public/data/players-v1.json','utf8')) as Player[];
const seasonCount=6;
for(const mode of ['MOBA','FPS'] as Mode[])test(`Alpha ${mode}: joga ${seasonCount} temporadas e restaura exportação binária`,async t=>{
 const directory=mkdtempSync(join(tmpdir(),'uem-alpha-')),filePath=join(directory,'careers.sqlite');let db=new DatabaseSync(filePath);
 const durations=new Map<string,number[]>();
 const harness=()=>workerHarness(db,catalog,{players:base,filePath,scratchDirectory:directory,seed:20261119,observe:(action,duration)=>{
   const list=durations.get(action)??[];list.push(duration);durations.set(action,list);
 }});
 let request=harness();
 try{
   let career=await request('create',{name:'Alpha '+mode,code:mode==='MOBA'?'ALM':'ALF',country:'BR',mode,difficulty:'Fácil',color:'#ef123b',symbol:'animals_wolf'}) as Career;
   assert.equal(career.createdVersion,'1.1.0');
   const id=career.id;let players=await request('world-players',id) as Player[];
   assert.equal(new Set(players.map(p=>p.id)).size,players.length);assert.ok(players.length>base.length);
   const sign=async(player:Player)=>{
     await request('submit-offer',{careerId:id,playerId:player.id,offer:{...terms(player.overall),days:730,salary:Math.ceil(terms(player.overall).salary*1.12/100)*100}});
     const proposal=(await request('negotiations',id)).find((n:any)=>n.player_id===player.id&&['accepted','counter'].includes(n.state));assert.ok(proposal);
     career=await request('confirm-offer',{careerId:id,id:proposal.id});
   };
   for(const role of roles[mode]){
     const player=players.filter(p=>p.mode===mode&&p.role===role&&!p.organization&&!p.status&&p.overall<=45&&athleteAge(p.birthDay,1)<=24)
       .sort((a,b)=>b.overall-a.overall)[0];assert.ok(player,'livre para '+role);await sign(player);
   }
   let contracts=await request('contracts',id) as Contract[];
   const own=new Set(contracts.map(c=>c.player_id));
   const student=players.filter(p=>p.mode===mode&&!p.organization&&!p.status&&!own.has(p.id)&&p.overall<=45&&athleteAge(p.birthDay,1)>=16&&athleteAge(p.birthDay,1)<=21&&(p.estimateHigh??0)>p.overall+5)[0];assert.ok(student);
   await sign(student);await request('assign-academy',{careerId:id,playerId:student.id,academy:true});
   await request('set-training',{careerId:id,playerId:student.id,focus:'communication'});
   await request('assign-academy',{careerId:id,playerId:student.id,academy:false});
   await request('starter',{careerId:id,playerId:student.id});
   const original=players.find(p=>own.has(p.id)&&p.role===student.role)!;
   await request('starter',{careerId:id,playerId:original.id});await request('assign-academy',{careerId:id,playerId:student.id,academy:true});
   const spare=players.find(p=>p.mode===mode&&!p.organization&&!p.status&&!own.has(p.id)&&p.id!==student.id&&p.overall<40)!;assert.ok(spare);
   await sign(spare);await request('depart-player',{careerId:id,playerId:spare.id});
   for(const playerId of own)await request('set-training',{careerId:id,playerId,focus:'mechanics'});
   await request('facility-upgrade',{careerId:id,kind:'training',expectedLevel:0});
   await request('facility-upgrade',{careerId:id,kind:'academy',expectedLevel:0});
   const sponsors=async()=>{
     let finances=await request('finance-state',{careerId:id});
     const active=finances.sponsors.filter((s:any)=>s.state==='accepted'&&s.accepted_day+s.duration-1>=career.day).length;
     for(const offer of finances.sponsors.filter((s:any)=>s.state==='pending'&&s.expires_day>=career.day).slice(0,2-active))await request('sponsor-accept',{careerId:id,id:offer.id});
     finances=await request('finance-state',{careerId:id});assert.equal(finances.openingBalance+finances.ledgerTotal,finances.balance);
   };
   await sponsors();
   const opponent=catalog.teams.find(team=>catalog.leagues.find(l=>l.id===team.league)?.discipline===mode&&!team.academy)!;
   const friendly=await request('prepare-match',{careerId:id,opponentId:opponent.id});
   const friendlyPlayed=await request('play-match',{careerId:id,id:friendly.id});career=friendlyPlayed.career;assert.equal(friendlyPlayed.result.stats.length,10);
   await assert.rejects(()=>request('play-match',{careerId:id,id:friendly.id}),/concluída/);
   for(let year=1;year<=seasonCount;year++){
     let season=await request('start-season',id) as Season;assert.equal(season.number,year);
     let steps=0;
     while(season.editions.some(e=>!e.champion)){
       assert.ok(++steps<100,'calendário precisa progredir');
       const next=nextUserFixture(season);
       if(next&&next.day<=career.day){
         const completed=await request('play-competition',{careerId:id,id:next.id});career=completed.career;season=completed.season;
       }else{
         for(const contract of await request('contracts',id) as Contract[]){
           if(contract.end_day-career.day<60){
             await request('renew-contract',{careerId:id,playerId:contract.player_id,salary:contract.salary,days:365});
           }
         }
         const advanced=await request('advance',{careerId:id,expectedDay:career.day,days:30});career=advanced.career;
         await sponsors();season=(await request('competition-state',id)).seasons[0];
       }
     }
     const state=await request('competition-state',id);assert.equal(state.seasons.length,year);assert.ok(state.seasons.every((s:Season)=>s.editions.every(e=>e.champion&&e.finalOrder.length===e.participants.length)));
     const cash=await request('finance-state',{careerId:id});assert.equal(cash.openingBalance+cash.ledgerTotal,cash.balance);assert.equal(cash.outstanding,0);
     assert.ok(cash.income>=0&&cash.expenses>0);
     const news=await request('news',{careerId:id,filter:{pageSize:3}});assert.equal(news.items.length,3);
     const versionedDay=career.day,balance=career.balance;
     db.close();db=new DatabaseSync(filePath);request=harness();
     career=(await request('list')).find((c:Career)=>c.id===id);assert.equal(career.day,versionedDay);assert.equal(career.balance,balance);
     assert.equal((await request('competition-state',id)).seasons.length,year);
   }
   players=await request('world-players',id);assert.equal(new Set(players.map(p=>p.id)).size,players.length);
   assert.ok((await request('contracts',id)).some((c:Contract)=>c.player_id===student.id&&c.academy));
   const currentNews=await request('news',{careerId:id,filter:{pageSize:50}}),financial=await request('finance-state',{careerId:id}),training=await request('training',id);
   const bytes=await request('export') as Uint8Array;assert.equal(new TextDecoder().decode(bytes.subarray(0,16)),'SQLite format 3\0');
   const restored=await request('import',{bytes:new Uint8Array(bytes).buffer,kind:'web'});
   assert.equal(restored.length,2);const copy=restored.find((c:Career)=>c.id!==id)!;assert.ok(copy);
   assert.equal(copy.day,career.day);assert.equal(copy.balance,financial.balance);assert.equal(copy.createdVersion,career.createdVersion);
   assert.equal((await request('competition-state',copy.id)).seasons.length,seasonCount);
   assert.deepEqual(JSON.parse(JSON.stringify(await request('training',copy.id))),JSON.parse(JSON.stringify(training)));
   assert.deepEqual(JSON.parse(JSON.stringify(await request('news',{careerId:copy.id,filter:{pageSize:50}}))),JSON.parse(JSON.stringify(currentNews)));
   const copiedFinances=await request('finance-state',{careerId:copy.id});assert.equal(copiedFinances.ledgerTotal,financial.ledgerTotal);assert.equal(copiedFinances.balance,financial.balance);
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA quick_check').get()!.quick_check,'ok');
   t.diagnostic(JSON.stringify({mode,day:career.day,seasons:seasonCount,players:players.length,backupMiB:Math.round(bytes.byteLength/1048576*100)/100,
     commands:Object.fromEntries([...durations].filter(([name])=>['create','world-players','advance','play-match','play-competition','start-season','export','import'].includes(name))
       .map(([name,list])=>[name,{count:list.length,averageMs:Math.round(list.reduce((a,b)=>a+b,0)/list.length),maxMs:Math.round(Math.max(...list))}]))}));
 }finally{db.close();if(!resolve(directory).startsWith(resolve(tmpdir(),'uem-alpha-')))throw Error('Diretório temporário inesperado.');rmSync(directory,{recursive:true,force:true});}
});
