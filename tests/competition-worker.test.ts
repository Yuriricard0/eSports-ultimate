import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {workerHarness} from './helpers/worker-harness.ts';
import {schema} from '../src/game-core/career.ts';
import {contractSchema,type Player} from '../src/game-core/recruitment.ts';
import {migrateCalendar} from '../src/game-core/calendar.ts';
import {phaseOneSchema} from '../src/game-core/identity.ts';
import {negotiationSchema} from '../src/game-core/negotiation.ts';
import {matchSchema} from '../src/game-core/match-store.ts';
import {generationVersion} from '../src/game-core/generation.ts';
import {definitions,roles} from '../src/game-core/attributes.ts';
import {generateSeason,nextUserFixture,progressBracket,type Season} from '../src/game-core/competitions.ts';
import {createDoubleElimination} from '../src/game-core/competition-formats.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';
import {startingEntry} from '../src/game-core/entry.ts';
import {careerCreationVersion} from '../src/version.ts';
import {equipmentCatalog} from '../src/game-core/equipment.ts';
import {defaultUniform} from '../src/game-core/uniform.ts';

const catalog=JSON.parse(readFileSync('public/data/real_teams_2026.json','utf8'));
for(const mode of ['MOBA','FPS'] as const)test('temporada completa '+mode+': agenda, séries, títulos, crédito único, recarga e ano seguinte',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'uem-season-')),path=join(dir,'career.sqlite');let db=new DatabaseSync(path);
 try{
   db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql),1);db.exec(phaseOneSchema+negotiationSchema+matchSchema+'PRAGMA user_version=6');
   db.prepare('INSERT INTO careers VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('a','Aurora','AUR','BR',mode,'Normal',100000000,'#aabbcc','animals_wolf','2026',1);
   const world=(JSON.parse(readFileSync('public/data/players-v1.json','utf8')) as Player[]).map(p=>({...p,overall:20,attributes:Object.fromEntries(Object.keys(p.attributes).map(key=>[key,20]))}));
   const own=roles[mode].map((role,i):Player=>({id:10000+i,nickname:'A'+i,name:'Aurora '+i,mode,role,overall:95,organization:null,team:null,country:'BR',birthDay:-8000,portraitIndex:0,estimateLow:95,estimateHigh:95,ceiling:95,attributes:Object.fromEntries(definitions[mode].map(key=>[mode.toLowerCase()+'_'+key,95]))}));
   for(const p of own)db.prepare('INSERT INTO web_contracts VALUES(?,?,?,?,?,?,?,?)').run('a',p.id,p.role,1,10000,100,1,1000);
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',42,generationVersion,JSON.stringify([...world,...own]));
   let request=workerHarness(db,catalog);
   let facilityCost=0;
   if(mode==='MOBA'){
     const finance=await request('finance-state',{careerId:'a'});
     const offer=finance.sponsors.find((s:any)=>s.state==='pending');
     await request('sponsor-accept',{careerId:'a',id:offer.id});
     await assert.rejects(()=>request('sponsor-accept',{careerId:'a',id:offer.id}),/disponível/);
     await request('facility-upgrade',{careerId:'a',kind:'training',expectedLevel:0});facilityCost=2500000;
   }
   let season=await request('start-season','a') as Season;
   await assert.rejects(()=>request('start-season','a'),/Conclua/);
   let day=1,steps=0,played=0;
   while(season.editions.some(e=>!e.champion)){
     assert.ok(++steps<100,'temporada não terminou');
     const next=nextUserFixture(season);
     if(next&&next.day<=day){
       const output=await request('play-competition',{careerId:'a',id:next.id});played++;season=output.season;
       await assert.rejects(()=>request('play-competition',{careerId:'a',id:next.id}),/concluído/);
     }else{
       const advanced=await request('advance',{careerId:'a',expectedDay:day,days:30});
       if(next)assert.ok(advanced.career.day<=next.day,'calendário ultrapassou partida do usuário');
       assert.equal(advanced.report.requestedDays,30);
       assert.equal(advanced.report.advancedDays,advanced.career.day-day);
       if(next&&next.day-day<30)assert.equal(advanced.report.blockedFixtureId,next.id);
       day=advanced.career.day;season=(await request('competition-state','a')).seasons[0];
       const due=nextUserFixture(season);
       if(due&&due.day<=day)await assert.rejects(()=>request('advance',{careerId:'a',expectedDay:day,days:1}),/confronto pendente/);
     }
   }
   assert.ok(played>0);assert.equal(season.editions.length,mode==='MOBA'?6:4);
   const state=await request('competition-state','a');assert.equal(state.awards.length,season.editions.length);
   const ownAwards=state.awards.filter((a:any)=>a.team_id==='career');assert.ok(ownAwards.length>0,'carreira forte deve conquistar um título');
   const won=season.editions.filter(edition=>ownAwards.some((award:{competition_id:string})=>award.competition_id===edition.id));
   assert.equal(won.length,ownAwards.length);
   for(const edition of won){
     const title=edition.championship;
     assert.ok(title,'título precisa guardar a escalação e a final');
     assert.equal(title.champion.id,'career');
     assert.equal(title.roster.length,5);
     assert.ok(title.roster.every(athlete=>own.some(player=>player.id===athlete.id&&player.nickname===athlete.nickname&&player.role===athlete.role)));
     assert.ok(title.finalId&&edition.fixtures.some(game=>game.id===title.finalId&&game.result?.winner==='career'));
     assert.ok(title.honors.some(honor=>honor.kind==='MVP da final'));
   }
   const prize=ownAwards.reduce((sum:number,a:any)=>sum+a.prize,0);
   const paid=Number(db.prepare('SELECT COALESCE(SUM(paid),0) total FROM web_payroll').get()!.total);
   const sponsorship=Number(db.prepare("SELECT COALESCE(SUM(amount),0) total FROM web_cash_events WHERE category='sponsor'").get()!.total);
   assert.equal(Number(db.prepare('SELECT balance FROM careers').get()!.balance),100000000+prize+sponsorship-paid-facilityCost);
   const finance=await request('finance-state',{careerId:'a'});
   assert.equal(finance.openingBalance+finance.ledgerTotal,finance.balance);
   if(mode==='MOBA'){assert.ok(sponsorship>0);assert.equal(finance.facilities[0].level,1);}
   const news=await request('news',{careerId:'a',filter:{category:'Campeonatos',pageSize:50}});
   assert.equal(news.items.filter((n:any)=>n.id.startsWith('champion:')).length,season.editions.length);
   for(const item of news.items){if(item.fixtureId)assert.ok(season.editions.some(e=>e.fixtures.some(g=>g.id===item.fixtureId&&g.result)));}
   const headlines=await request('news',{careerId:'a',filter:{pageSize:3}});assert.equal(headlines.items.length,3);
   assert.ok(headlines.items.every((n:any,index:number)=>index===0||n.day<=headlines.items[index-1].day));
   for(const edition of season.editions){
     assert.equal(edition.finalOrder.length,edition.participants.length);
     for(const game of edition.fixtures){assert.ok(game.result);assert.equal(game.result.maps.length,game.result.score[0]+game.result.score[1]);assert.equal(Math.max(...game.result.score),Math.ceil(game.bestOf/2));}
   }
   const saved=JSON.stringify(state);db.close();db=new DatabaseSync(path);request=workerHarness(db,catalog);
   assert.equal(JSON.stringify(await request('competition-state','a')),saved);
   assert.deepEqual(JSON.parse(JSON.stringify(await request('news',{careerId:'a',filter:{category:'Campeonatos',pageSize:50}}))),JSON.parse(JSON.stringify(news)));
   const reloadedFinance=await request('finance-state',{careerId:'a'});assert.equal(reloadedFinance.balance,finance.balance);assert.equal(reloadedFinance.ledgerTotal,finance.ledgerTotal);
   const second=await request('start-season','a') as Season;assert.equal(second.number,2);assert.ok(second.year>season.year);assert.ok(second.startDay>season.endDay);
   const after=await request('competition-state','a');assert.equal(after.awards.length,state.awards.length);assert.equal(after.seasons.length,2);
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=>'copy');
   const restored=await request('competition-state','copy');assert.equal(restored.seasons.length,2);assert.equal(restored.awards.length,state.awards.length);
   assert.equal(JSON.stringify(restored.seasons.find((item:Season)=>item.number===season.number)?.editions.map((edition:Season['editions'][number])=>edition.championship)),
     JSON.stringify(season.editions.map(edition=>edition.championship)));
   const copiedFinance=await request('finance-state',{careerId:'copy'});assert.equal(copiedFinance.balance,finance.balance);assert.equal(copiedFinance.ledgerTotal,finance.ledgerTotal);
   assert.deepEqual(JSON.parse(JSON.stringify(await request('news',{careerId:'copy',filter:{category:'Campeonatos',pageSize:50}}))),JSON.parse(JSON.stringify(news)));
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
   const homeKit=defaultUniform('#a31f36','#253749','home'),awayKit=defaultUniform('#a31f36','#253749','away');
   await assert.rejects(()=>request('uniform',{careerId:'a',variant:'home',config:{...homeKit,sponsor:'Marca sem contrato'}}),/patrocinador ativo/);
   await request('uniform',{careerId:'a',variant:'home',config:homeKit});
   await request('uniform',{careerId:'a',variant:'away',config:awayKit});
   const sku=mode.toLowerCase()+'-mouse-3';
   const order={careerId:'a',sku,quantity:1,orderId:'00000000-0000-0000-0000-000000000001'};
   const beforeGear=Number(db.prepare("SELECT balance FROM careers WHERE id='a'").get()!.balance);
   await request('equipment-buy',order);await request('equipment-buy',order);
   assert.equal(Number(db.prepare("SELECT balance FROM careers WHERE id='a'").get()!.balance),beforeGear-equipmentCatalog.find(item=>item.id===sku)!.price);
   assert.equal(db.prepare("SELECT quantity FROM web_equipment_stock WHERE career_id='a' AND sku=?").get(sku)!.quantity,1);
   const assign=(playerId:number,product:string)=>request('equipment-assign',{careerId:'a',playerId,category:'mouse',sku:product});
   await assign(own[0].id,sku);
   await assert.rejects(()=>assign(own[1].id,sku),/Nenhuma unidade/);
   await assign(own[0].id,'');
   await assign(own[1].id,sku);
   db.close();db=new DatabaseSync(path);request=workerHarness(db,catalog);
   assert.equal((await request('finance-state',{careerId:'a'})).setups[0].player_id,own[1].id);
   const reloadedKit=(await request('list')).find((row:{id:string})=>row.id==='a').uniforms;
   assert.equal(JSON.stringify(reloadedKit),JSON.stringify({home:homeKit,away:awayKit}));
   let equipmentBackup=0;
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=>'gear-copy-'+(++equipmentBackup));
   assert.equal(db.prepare('SELECT COUNT(*) n FROM web_equipment_setup WHERE player_id=? AND sku=?').get(own[1].id,sku)!.n,2);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM web_uniforms').get()!.n,4);
   if(mode==='MOBA'){
     const current=(await request('list')).find(row=>row.id==='a');
     const newSeason=generateSeason({...current,createdVersion:careerCreationVersion,entry:startingEntry(catalog,'BR',mode)},
       catalog,[...world,...own],await request('contracts','a'),second.number,second.startDay);
     const cup=newSeason.editions.find(edition=>edition.key==='br_cup')!;
     db.prepare('UPDATE web_competition_seasons SET data=? WHERE career_id=? AND number=?').run(JSON.stringify(newSeason),'a',second.number);
     const enroll=()=>request('enroll-competition',{careerId:'a',id:cup.id});
     await assert.rejects(enroll,/prazo/);
     db.prepare('UPDATE careers SET day=? WHERE id=?').run(cup.entryWindow!.opens,'a');
     const enrolled=await enroll() as Season;
     assert.equal(enrolled.editions.find(edition=>edition.id===cup.id)!.participants.filter(team=>team.id==='career').length,1);
     db.close();db=new DatabaseSync(path);request=workerHarness(db,catalog);
     assert.equal(JSON.stringify(await enroll()),JSON.stringify(enrolled));
     assert.equal(JSON.stringify((await request('competition-state','a')).seasons[0]),JSON.stringify(enrolled));
     const registeredEdition=enrolled.editions.find(edition=>edition.id===cup.id)!;
     await assert.rejects(()=>request('training-event-plan',{careerId:'a',start:registeredEdition.startDay+7,
       slot:{offset:0,kind:'team',intensity:'normal',objective:'Preparação'}}),/compromisso de partida/);
     const isolated={...enrolled,editions:[registeredEdition]};
     const cutoff=registeredEdition.startDay-1;
     db.prepare('UPDATE careers SET day=? WHERE id=?').run(cutoff,'a');
     db.prepare('UPDATE web_competition_seasons SET data=? WHERE career_id=? AND number=?').run(JSON.stringify(isolated),'a',second.number);
     await request('advance',{careerId:'a',expectedDay:cutoff,days:1});
     const locked=(await request('competition-state','a')).seasons[0] as Season;
     assert.deepEqual(Array.from(locked.editions[0].registration!.players),own.map(player=>player.id));
     const game=nextUserFixture(locked)!;
     db.prepare('UPDATE web_contracts SET starter=0 WHERE career_id=? AND player_id=?').run('a',own[0].id);
     await assert.rejects(()=>request('play-competition',{careerId:'a',id:game.id}),/inelegíveis/);
     const forfeited=await request('play-competition',{careerId:'a',id:game.id,forfeit:true});
     assert.equal(forfeited.season.editions[0].fixtures.find(gameInEdition=>gameInEdition.id===game.id).result.administrative,'ineligible-lineup');
     await assert.rejects(()=>request('play-competition',{careerId:'a',id:game.id,forfeit:true}),/concluído/);
   }else{
     const original=second.editions[0],ownTeam=original.participants.find(team=>team.id==='career')!;
     const participants=[ownTeam,...original.participants.filter(team=>team.id!=='career').slice(0,3)];
     const edition={...original,participants,fixtures:[],doubleElimination:createDoubleElimination(participants.map(team=>team.id),{upper:1,lower:1,final:3,grandFinal:'reset'})};
     const currentDay=edition.startDay;
     progressBracket(edition);
     const userFirst=edition.fixtures.find(game=>game.home==='career')!;
     userFirst.result={winner:'career',score:[1,0],maps:[],completedDay:currentDay};userFirst.status='completed';
     edition.fixtures.find(game=>game!==userFirst)!.day=currentDay+1;
     const staged={...second,editions:[edition]};
     db.prepare('UPDATE web_competition_seasons SET data=? WHERE career_id=? AND number=?').run(JSON.stringify(staged),'a',second.number);
     db.prepare('UPDATE careers SET day=? WHERE id=?').run(currentDay,'a');
     assert.equal(nextUserFixture(staged),undefined);
     const advanced=await request('advance',{careerId:'a',expectedDay:currentDay,days:30});
     const updated=(await request('competition-state','a')).seasons[0] as Season;
     assert.equal(advanced.report.advancedDays,14);
     assert.equal(advanced.report.blockedFixtureId,nextUserFixture(updated)?.id);
     assert.equal(advanced.career.day,nextUserFixture(updated)?.day);
     const completed=updated.editions[0].fixtures.filter(game=>game.result);
     assert.equal(completed.length,3);
     assert.ok(completed.every(game=>game.result!.completedDay<=advanced.career.day));
   }
 }finally{db.close();if(!resolve(dir).startsWith(resolve(tmpdir(),'uem-season-')))throw Error('Diretório temporário inesperado.');rmSync(dir,{recursive:true,force:true});}
});
