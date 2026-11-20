import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {schema,type Career} from '../src/game-core/career.ts';
import {contractSchema,hire,type Player} from '../src/game-core/recruitment.ts';
import {migrateCalendar} from '../src/game-core/calendar.ts';
import {phaseOneSchema} from '../src/game-core/identity.ts';
import {negotiationSchema} from '../src/game-core/negotiation.ts';
import {competitionSchema} from '../src/game-core/competition-store.ts';
import {departPlayer,renewContract} from '../src/game-core/market.ts';
import {newsSchema,synchronizeNews,listNews,processMoodEvent,recordDevelopmentNews,currentPlayerSituation} from '../src/game-core/news.ts';
import {definitions} from '../src/game-core/attributes.ts';

const player:Player={id:7,nickname:'Nyx',name:'Nyx Silva',mode:'MOBA',role:'top',overall:50,organization:null,team:null,country:'BR',birthDay:-6900,portraitIndex:0,estimateLow:70,estimateHigh:80,ceiling:80,attributes:Object.fromEntries(definitions.MOBA.map(key=>['moba_'+key,50]))};
const career:Career={id:'a',name:'Aurora',code:'AUR',country:'BR',mode:'MOBA',difficulty:'Normal',balance:100000000,color:'#ef123b',symbol:'animals_wolf',created:'2026',day:1};
const catalog={organizations:[],teams:[],leagues:[]};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql),1);db.exec(phaseOneSchema+negotiationSchema+competitionSchema+newsSchema);
 db.prepare('INSERT INTO careers VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('a','Aurora','AUR','BR','MOBA','Normal',100000000,'#ef123b','animals_wolf','2026',1);
 const run=(sql:string,bind:(string|number)[]=[])=>{db.prepare(sql).run(...bind);};
 const read=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).get(...bind);
 const all=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).all(...bind);
 return {db,run,read,all};
}
test('contratos, renovação e dispensa viram fatos curtos sem notícias inventadas ou repetidas',()=>{
 const {db,run,read,all}=setup();
 synchronizeNews(run,read,all,career,[player],catalog);
 assert.equal(listNews(read,all,'a',{}).total,0);
 hire(run,read,'a',player);renewContract(run,read,all,'a',7,370000,180);departPlayer(run,read,all,'a',player);
 synchronizeNews(run,read,all,career,[player],catalog);synchronizeNews(run,read,all,career,[player],catalog);
 const news=listNews(read,all,'a',{});assert.equal(news.total,3);assert.ok(news.items.every(n=>n.playerId===7));
 assert.ok(news.items.some(n=>n.title.includes('dispensado')));assert.ok(news.items.every(n=>n.category==='Mercado'));
 assert.equal(currentPlayerSituation(player,[],{},career.name),'Livre no mercado');
 assert.equal(currentPlayerSituation({...player,organization:'rival'},[],{rival:'Rival'},career.name),'Rival');
 assert.equal(currentPlayerSituation(player,[{player_id:7,starter:0,salary:370000,bonus:100,start_day:1,end_day:365}],{},career.name),'Aurora');db.close();
});
test('data descrescente, limite de três e filtros consultam o mesmo histórico',()=>{
 const {db,run,read,all}=setup();hire(run,read,'a',player);
 run('UPDATE careers SET day=8',[]);renewContract(run,read,all,'a',7,370000,180);run('UPDATE careers SET day=15',[]);departPlayer(run,read,all,'a',player);
 synchronizeNews(run,read,all,{...career,day:15},[player],catalog);
 const first=listNews(read,all,'a',{pageSize:3});assert.equal(first.items.length,3);assert.deepEqual(first.items.map(n=>n.day),[15,8,1]);
 assert.equal(listNews(read,all,'a',{category:'Campeonatos'}).total,0);assert.equal(listNews(read,all,'a',{query:'Nyx'}).total,3);db.close();
});
test('eventos raros alteram só moral em até três pontos e não repetem o efeito',()=>{
 const {db,run,read,all}=setup();let players=[player],lastEvent=-100,count=0;
 for(let day=2;day<=366;day++){
   const before=players;players=processMoodEvent(run,read,'a',players,new Set([7]),day,42);
   if(players!==before){
     assert.ok(day-lastEvent>=30);lastEvent=day;count++;
     assert.equal(players[0].overall,50);assert.deepEqual(players[0].attributes,player.attributes);
     const event=read('SELECT delta FROM web_world_events ORDER BY day DESC LIMIT 1')!;assert.ok(Math.abs(Number(event.delta))<=3);
     assert.deepEqual(processMoodEvent(run,read,'a',players,new Set([7]),day,42),players);
   }
 }
 assert.ok(count>0&&count<=8);assert.equal(all('SELECT * FROM web_world_events').length,count);db.close();
});
test('notícia de evolução usa ganho real registrado sem alterar atributos ou reputação',()=>{
 const {db,run,read,all}=setup();recordDevelopmentNews(run,read,career,[player],[player],1,new Set([7]));
 recordDevelopmentNews(run,read,career,[player],[{...player,overall:51.1}],91,new Set([7]));
 recordDevelopmentNews(run,read,career,[player],[{...player,overall:51.1}],91,new Set([7]));
 const result=listNews(read,all,'a',{category:'Jogadores'});assert.equal(result.total,1);assert.ok(result.items[0].summary.includes('51,1'));
 assert.equal(read('SELECT balance FROM careers')!.balance,100000000);db.close();
});

test('recontratação livre não reutiliza o vendedor de uma negociação antiga',()=>{
 const {db,run,read,all}=setup();hire(run,read,'a',player);
 run("INSERT INTO web_negotiations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",['old','a',7,1,8,'signed',10000,370000,365,0,0,'Aceita']);
 run('INSERT INTO web_transfer_quotes VALUES(?,?,?,?,?)',['a','old','rival','team',1000]);
 run('INSERT INTO web_ai_cash_events VALUES(?,?,?,?,?,?)',['a','transfer:old','rival',1,1000,'Venda do atleta 7.']);
 departPlayer(run,read,all,'a',player);run('UPDATE careers SET day=2');hire(run,read,'a',player);
 synchronizeNews(run,read,all,{...career,day:2},[player],catalog);
 const news=listNews(read,all,'a',{}).items;
 assert.ok(news.find(n=>n.id==='contract:7:1')!.title.includes('transferido'));
 assert.ok(news.find(n=>n.id==='contract:7:2')!.title.includes('assina'));db.close();
});
