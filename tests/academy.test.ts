import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {schema} from '../src/game-core/career.ts';
import {contractSchema,hire,selectStarter,type Player} from '../src/game-core/recruitment.ts';
import {migrateCalendar} from '../src/game-core/calendar.ts';
import {advanceCareerDay} from '../src/game-core/calendar.ts';
import {phaseOneSchema} from '../src/game-core/identity.ts';
import {negotiationSchema} from '../src/game-core/negotiation.ts';
import {assignAcademy,setTrainingFocus} from '../src/game-core/academy.ts';
import {developPlayer} from '../src/game-core/development.ts';
import {definitions,overall,type Mode} from '../src/game-core/attributes.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';
import {departPlayer} from '../src/game-core/market.ts';

function athlete(mode:Mode='MOBA',id=7):Player{
 const role=mode==='MOBA'?'top':'entry';
 return {id,nickname:'Young',name:'Young Silva',mode,role,overall:50,organization:null,team:null,country:'BR',birthDay:-6900,portraitIndex:0,estimateLow:65,estimateHigh:75,ceiling:80,
   attributes:Object.fromEntries(definitions[mode].map(key=>[mode.toLowerCase()+'_'+key,50]))};
}
function setup(){
 const db=new DatabaseSync(':memory:');db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql),1);db.exec(phaseOneSchema+negotiationSchema);
 db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',100000000,'#aabbcc','animals_wolf','2026',1)");
 const run=(sql:string,bind:(string|number)[]=[])=>{db.prepare(sql).run(...bind);};
 const read=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).get(...bind);
 const all=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).all(...bind);
 return {db,run,read,all};
}

test('Academy usa mesmo atleta e contrato, libera titular e promoção mantém foco',()=>{
 const {db,run,read}=setup();const player=athlete();hire(run,read,'a',player);hire(run,read,'a',athlete('MOBA',8));
 const before=read('SELECT balance FROM careers',[])?.balance;
 setTrainingFocus(run,read,'a',player,'mechanics');assignAcademy(run,read,'a',player,true);
 assert.equal(read('SELECT starter FROM web_current_contracts WHERE player_id=7',[])?.starter,0);
 assert.equal(read('SELECT starter FROM web_current_contracts WHERE player_id=8',[])?.starter,1);
 assert.equal(read('SELECT academy FROM web_player_training WHERE player_id=7',[])?.academy,1);
 assert.throws(()=>selectStarter(run,read,'a',7),/Academy|principal/i);
 assignAcademy(run,read,'a',player,false);
 assert.equal(read('SELECT focus FROM web_player_training WHERE player_id=7',[])?.focus,'mechanics');
 assert.equal(read('SELECT COUNT(*) n FROM web_contracts',[])?.n,2);
 assert.equal(read('SELECT balance FROM careers',[])?.balance,before);db.close();
});

test('entrada rejeita veterano, modalidade errada e atleta sem vínculo; foco é validado',()=>{
 const {db,run,read}=setup();const player=athlete();hire(run,read,'a',player);
 assert.throws(()=>assignAcademy(run,read,'a',{...player,birthDay:-10000},true),/16|21|idade/i);
 assert.throws(()=>assignAcademy(run,read,'a',athlete('FPS'),true),/modalidade/i);
 assert.throws(()=>assignAcademy(run,read,'a',athlete('MOBA',999),true),/elenco|contrato|vínculo/i);
 assert.throws(()=>setTrainingFocus(run,read,'a',player,'turbo'),/foco/i);
 assert.equal(read('SELECT COUNT(*) n FROM web_player_training',[])?.n,0);db.close();
});

test('quatro focos reaproveitam evolução mensal nos dois jogos e respeitam potencial e idade',()=>{
 for(const mode of ['MOBA','FPS'] as const){
   const player=athlete(mode),prefix=mode.toLowerCase()+'_';
   const trained=(focus:string)=>developPlayer(player,1,31,[{focus,fromDay:1,toDay:365}]);
   const balanced=trained('balanced'),mechanics=trained('mechanics'),strategy=trained('strategy'),communication=trained('communication');
   assert.deepEqual(balanced,developPlayer(player,1,31));
   assert.ok(mechanics.attributes[prefix+(mode==='MOBA'?'mechanics':'aim')]>balanced.attributes[prefix+(mode==='MOBA'?'mechanics':'aim')]);
   assert.ok(strategy.attributes[prefix+'reading']>balanced.attributes[prefix+'reading']);
   assert.ok(communication.attributes[prefix+'communication']>balanced.attributes[prefix+'communication']);
   for(const result of [balanced,mechanics,strategy,communication]){
     assert.equal(result.overall,overall(result.attributes,mode,result.role));
     assert.ok(result.overall>50&&result.overall<51);
   }
   assert.deepEqual(developPlayer(player,1,30,[{focus:'mechanics',fromDay:1,toDay:365}]),player);
   const capped={...player,ceiling:50};assert.deepEqual(developPlayer(capped,1,31,[{focus:'mechanics',fromDay:1,toDay:365}]),capped);
   const veteran={...player,birthDay:-12000};
   assert.deepEqual(developPlayer(veteran,1,31,[{focus:'mechanics',fromDay:1,toDay:365}]),developPlayer(veteran,1,31));
 }
});

test('foco só atua durante vínculo e avanços em lote equivalem aos diários',()=>{
 const player=athlete();const plans=[{focus:'mechanics',fromDay:10,toDay:61}];
 let daily=player;for(let day=1;day<91;day++)daily=developPlayer(daily,day,day+1,plans);
 assert.deepEqual(developPlayer(player,1,91,plans),daily);
 assert.deepEqual(developPlayer(player,1,31,[{focus:'mechanics',fromDay:32,toDay:365}]),developPlayer(player,1,31));
});

test('backup V5 restaura Academy e treinamento sem duplicar contratos',()=>{
 const source=setup(),target=setup();const player=athlete();
 source.db.exec('PRAGMA user_version=5');hire(source.run,source.read,'a',player);assignAcademy(source.run,source.read,'a',player,true);setTrainingFocus(source.run,source.read,'a',player,'communication');
 restoreWebBackup((sql,bind=[])=>source.db.prepare(sql).all(...bind),(sql,bind=[])=>{target.db.prepare(sql).run(...bind);},()=>'restored');
 assert.equal(target.read('SELECT academy FROM web_player_training WHERE career_id=?',['restored'])?.academy,1);
 assert.equal(target.read('SELECT focus FROM web_player_training WHERE career_id=?',['restored'])?.focus,'communication');
 assert.equal(target.read('SELECT COUNT(*) n FROM web_contracts WHERE career_id=?',['restored'])?.n,1);
 source.db.close();target.db.close();
});

test('venda e vencimento do titular não escalam atletas da Academy automaticamente',()=>{
 const {db,run,read,all}=setup();const player=athlete();hire(run,read,'a',player);hire(run,read,'a',athlete('MOBA',8));
 assignAcademy(run,read,'a',athlete('MOBA',8),true);
 departPlayer(run,read,all,'a',player);
 assert.equal(read('SELECT starter FROM web_current_contracts WHERE player_id=8',[])?.starter,0);
 hire(run,read,'a',athlete('MOBA',9));run('UPDATE web_contracts SET end_day=2 WHERE player_id=9',[]);
 advanceCareerDay(run,read,all,'a',1,7);
 assert.equal(read('SELECT starter FROM web_current_contracts WHERE player_id=8',[])?.starter,0);
 assignAcademy(run,read,'a',athlete('MOBA',8),false);
 assert.equal(read('SELECT starter FROM web_current_contracts WHERE player_id=8',[])?.starter,1);db.close();
});

test('importado sem contrato pode voltar à titularidade após promoção sem criar contrato',()=>{
 const {db,run,read}=setup();const player=athlete();
 run('INSERT INTO web_imported_players VALUES(?,?,?,?,?)',['a',-1,JSON.stringify({...player,id:-1}),1,1]);
 hire(run,read,'a',athlete('MOBA',8),true);
 assignAcademy(run,read,'a',{...player,id:-1},true);
 assert.equal(read('SELECT starter FROM web_current_contracts',[])?.starter,1);
 assignAcademy(run,read,'a',{...player,id:-1},false);
 selectStarter(run,read,'a',-1);
 assert.equal(read('SELECT starter FROM web_imported_players WHERE player_id=-1',[])?.starter,1);
 assert.equal(read('SELECT starter FROM web_current_contracts',[])?.starter,0);
 assert.equal(read('SELECT COUNT(*) n FROM web_contracts',[])?.n,1);db.close();
});
