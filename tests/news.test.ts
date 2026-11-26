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
import {newsSchema,synchronizeNews,listNews,recordNews,processMoodEvent,recordDevelopmentNews,currentPlayerSituation} from '../src/game-core/news.ts';
import {definitions} from '../src/game-core/attributes.ts';

test('portal pesquisa conteúdo, respeita modalidade histórica e preserva registros legados',()=>{
 const {db,run,read,all}=setup();
 try{
   const legacy={id:'legacy',day:1,category:'Mercado' as const,title:'Registro antigo',summary:'Dados verificáveis'};
   recordNews(run,read,'a',legacy);
   recordNews(run,read,'a',{id:'snapshot',day:2,category:'Mercado',title:'Nyx assina',summary:'Transferência confirmada',content:'Sai da Aurora e chega à Rival.',mode:'FPS',organizationId:'rival',relatedOrganizationIds:['career','rival']});
   const result=listNews(read,all,'a',{mode:'FPS',query:'chega',organizationId:'career',channel:'public'},[player]);
   assert.deepEqual(result.items.map(n=>n.id),['snapshot']);
   assert.deepEqual(listNews(read,all,'a',{query:'antigo'}).items,[legacy]);
   assert.equal(recordNews(run,read,'a',{...legacy,title:'Não deve substituir'}),false);
   assert.equal(listNews(read,all,'a',{query:'antigo'}).items[0].title,legacy.title);
   assert.ok(result.available.categories.includes('Mercado'));
 }finally{db.close();}
});

test('notícias públicas não expõem moral, treino ou potencial, inclusive em saves antigos',()=>{
 const {db,run,read,all}=setup();
 try{
   for(const id of ['mood:7','growth:7:8','prospect:9'])recordNews(run,read,'a',{id,day:8,category:'Jogadores',title:'Interno',summary:'Informação reservada'});
   recordNews(run,read,'a',{id:'retired:7',day:8,category:'Jogadores',title:'Nyx encerra a carreira',summary:'Aposentadoria'});
   assert.equal(listNews(read,all,'a',{channel:'public'}).total,1);
   assert.equal(listNews(read,all,'a',{channel:'messages'}).total,3);
   assert.equal(listNews(read,all,'a',{}).total,4);
 }finally{db.close();}
});

test('volume, relevância e paginação não duplicam nem perdem acontecimentos',()=>{
 const {db,run,read,all}=setup();
 try{
   run('UPDATE careers SET day=1000');
   for(let i=0;i<1000;i++)recordNews(run,read,'a',{id:'bulk:'+i,day:1+i,category:'Mercado',title:'Notícia '+i,summary:'Confirmada',relevance:i===970?100:20});
   assert.equal(listNews(read,all,'a',{page:19,pageSize:50,channel:'public'}).items.length,50);
   assert.equal(listNews(read,all,'a',{page:20,pageSize:50}).items.length,0);
   assert.equal(listNews(read,all,'a',{order:'relevance',pageSize:3}).items[0].id,'bulk:970');
   const portal=listNews(read,all,'a',{includeHighlights:true,pageSize:20});
   assert.equal(portal.highlights?.[0].id,'bulk:970');
   assert.equal(portal.items[0].id,'bulk:999');
 }finally{db.close();}
});

const player:Player={id:7,nickname:'Nyx',name:'Nyx Silva',mode:'MOBA',role:'top',overall:50,organization:null,team:null,country:'BR',birthDay:-6900,portraitIndex:0,estimateLow:70,estimateHigh:80,ceiling:80,attributes:Object.fromEntries(definitions.MOBA.map(key=>['moba_'+key,50]))};
const career:Career={id:'a',name:'Aurora',code:'AUR',country:'BR',mode:'MOBA',difficulty:'Normal',balance:100000000,color:'#ef123b',symbol:'animals_wolf',created:'2026',day:1};
const catalog={organizations:[],teams:[],leagues:[]};
test('filtros combinam modalidade, organização e assunto antes da paginação',()=>{
 const {db,run,read,all}=setup();
 try{
   recordNews(run,read,'a',{id:'fps',day:2,category:'Mercado',title:'Contratação CS2',summary:'Contrato',playerId:8,organizationId:'rival'});
   recordNews(run,read,'a',{id:'moba',day:3,category:'Mercado',title:'Contratação MOBA',summary:'Contrato',playerId:7,organizationId:'rival'});
   recordNews(run,read,'a',{id:'n',day:4,category:'Organizações',title:'Instalações',summary:'Melhoria',organizationId:'career'});
   const players=[player,{id:8,mode:'FPS' as const}];
   assert.deepEqual(listNews(read,all,'a',{mode:'FPS',organizationId:'rival',category:'Mercado',pageSize:1},players).items.map(item=>item.id),['fps']);
   assert.equal(listNews(read,all,'a',{mode:'MOBA',organizationId:'career'},players).total,1);
 }finally{db.close();}
});
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

test('contratação guarda contexto, texto estável e modalidade mesmo após mudança de clube',()=>{
 const {db,run,read,all}=setup();
 try{
   hire(run,read,'a',player);synchronizeNews(run,read,all,career,[player],catalog);
   const original=listNews(read,all,'a',{}).items[0];
   assert.equal(original.mode,'MOBA');assert.equal(original.visual?.destination,'Aurora');
   assert.ok(original.content);assert.ok(original.origin);assert.ok(original.relevance!>0);
   assert.ok(!original.summary.includes('registrado na carreira'));
   synchronizeNews(run,read,all,{...career,day:20,name:'Outro nome'},[{...player,organization:'rival',nickname:'Novo nome'}],catalog);
   assert.deepEqual(listNews(read,all,'a',{}).items[0],original);
 }finally{db.close();}
});

test('potencial e métricas internas são mensagens; aposentadoria é pública',()=>{
 const {db,run,read,all}=setup();
 try{
   recordDevelopmentNews(run,read,career,[player],[{...player,overall:52}],2,new Set([7]));
   recordDevelopmentNews(run,read,career,[],[{...player,id:9,status:'ranked',estimateLow:90,estimateHigh:95}],2,new Set());
   recordDevelopmentNews(run,read,career,[player],[{...player,status:'retired',retiredDay:2}],2,new Set());
   const publicNews=listNews(read,all,'a',{channel:'public'});
   assert.deepEqual(publicNews.items.map(n=>n.id),['retired:7']);
   assert.ok(listNews(read,all,'a',{channel:'messages'}).items.every(n=>n.channel==='messages'));
 }finally{db.close();}
});

test('rodada do cenário agrupa placares reais por data sem duplicar jogos da carreira',()=>{
 const {db,run,read,all}=setup();
 try{
   const participants=['a','b','career','d'].map(id=>({id,organization:id,name:id.toUpperCase(),reputation:50}));
   const result={winner:'a',score:[1,0],completedDay:8,maps:[]};
   const fixtures=[{id:'world',home:'a',away:'b',round:1,phase:'regular',bestOf:1,result},{id:'own',home:'career',away:'d',round:1,phase:'regular',bestOf:1,result:{...result,winner:'career'}}];
   run('INSERT INTO web_competition_seasons VALUES(?,?,?)',['a',1,JSON.stringify({number:1,editions:[{id:'s1:br',name:'Liga Brasil',mode:'MOBA',participants,fixtures}]})]);
   synchronizeNews(run,read,all,{...career,day:8},[],catalog);
   const initial=listNews(read,all,'a',{channel:'public'});
   const round=initial.items.find(n=>n.id.startsWith('round:'))!;
   assert.ok(round.content?.includes('A 1 × 0 B'));assert.equal(round.day,8);
   assert.ok(!round.content?.includes('CAREER'));assert.equal(initial.items.filter(n=>n.id.startsWith('series:')).length,1);
   assert.ok(listNews(read,all,'a',{organizationId:'b'}).items.some(n=>n.id===round.id));
   assert.ok(initial.available.organizations.includes('b'));
   assert.equal(listNews(read,all,'a',{scope:'world'}).total,1);
   synchronizeNews(run,read,all,{...career,day:8},[],catalog);
   assert.deepEqual(listNews(read,all,'a',{channel:'public'}),initial);
 }finally{db.close();}
});

test('pesquisa reconhece letras maiúsculas acentuadas do título e do conteúdo',()=>{
 const {db,run,read,all}=setup();
 try{
   recordNews(run,read,'a',{id:'accent',day:2,category:'Mercado',title:'ÁGUIAS reforça elenco',summary:'Assinatura',content:'Ótima estreia'});
   assert.equal(listNews(read,all,'a',{query:'águias'}).total,1);
   assert.equal(listNews(read,all,'a',{query:'ÓTIMA'}).total,1);
 }finally{db.close();}
});

test('títulos usam modelos editoriais variados, determinísticos e apenas dados do evento',()=>{
 const {db,run,read,all}=setup();
 try{
   for(let i=0;i<8;i++)run('INSERT INTO web_competition_awards VALUES(?,?,?,?,?,?,?,?,?,?,?)',['a',1,'cup:'+i,'winner','career',8,'Copa '+i,'MOBA','Regional',1000,2]);
   synchronizeNews(run,read,all,{...career,day:8},[],catalog);
   const first=listNews(read,all,'a',{channel:'public'});
   assert.ok(new Set(first.items.map(n=>n.title.replace(/Copa \d/g,'Copa'))).size>1);
   assert.ok(first.items.every(n=>n.content?.includes('Aurora')&&!n.content.includes('undefined')));
   synchronizeNews(run,read,all,{...career,day:8},[],catalog);
   assert.deepEqual(listNews(read,all,'a',{channel:'public'}),first);
 }finally{db.close();}
});
