import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateSeason,standings,progressBracket,simulateSeries,defaultCompetitionConfig,type Competition,type Season} from '../src/game-core/competitions.ts';
import {rivalLineup,type MatchSide} from '../src/game-core/matches.ts';
import type {Player,Contract} from '../src/game-core/recruitment.ts';
import type {WorldCatalog} from '../src/game-core/world.ts';
import type {Career} from '../src/game-core/career.ts';

const catalog=JSON.parse(readFileSync('public/data/real_teams_2026.json','utf8')) as WorldCatalog;
const base=JSON.parse(readFileSync('public/data/players-v1.json','utf8')) as Player[];
function fixture(mode:'MOBA'|'FPS'){
 const league=mode==='MOBA'?'cblol':'vrs_americas';
 const source=catalog.teams.find(t=>t.league===league&&!t.academy)!;
 const own=rivalLineup(base,source.id,mode,1).map((slot,i)=>({...slot.player,id:10000+i,organization:null,team:null}));
 const career:Career={id:'a',name:'Aurora',code:'AUR',country:'BR',mode,difficulty:'Normal',balance:25000000,color:'#ef123b',symbol:'animals_wolf',created:'2026',day:1};
 const contracts:Contract[]=own.map(p=>({player_id:p.id,salary:10000,bonus:100,start_day:1,end_day:1000,starter:1}));
 return {career,players:[...base,...own],contracts};
}
function validateCalendar(season:Season){
 const seen=new Set<string>();
 for(const edition of season.editions)for(const game of edition.fixtures){
   for(const team of [game.home,game.away]){const key=team+':'+game.day;assert.ok(!seen.has(key),'conflito '+key);seen.add(key);}
   assert.notEqual(game.home,game.away);assert.ok(edition.participants.some(p=>p.id===game.home));assert.ok(edition.participants.some(p=>p.id===game.away));
 }
}
test('gera seis ligas MOBA, região correta, participantes únicos e turno único',()=>{
 const f=fixture('MOBA'),season=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 assert.equal(season.editions.length,6);validateCalendar(season);
 for(const edition of season.editions){
   const n=edition.participants.length;assert.ok([6,8].includes(n));assert.equal(edition.fixtures.length,n*(n-1)/2);
   assert.equal(new Set(edition.participants.map(p=>p.organization)).size,n);
   if(edition.participants.some(p=>p.id==='career'))assert.equal(edition.key,'cblol');
 }
 assert.equal(season.editions.flatMap(e=>e.participants.filter(p=>p.id==='career')).length,1);
});

test('gera quatro eventos CS2 com vários prestígios e participação repetida sem conflitos',()=>{
 const f=fixture('FPS'),season=generateSeason(f.career,catalog,f.players,f.contracts,1,1);validateCalendar(season);
 assert.equal(season.editions.length,4);assert.equal(new Set(season.editions.map(e=>e.prestige)).size,3);
 for(const edition of season.editions){assert.equal(edition.participants.length,8);assert.ok(edition.participants.some(p=>p.id==='career'));assert.ok(edition.fixtures.every(g=>g.bestOf===3));}
});

test('temporadas MOBA e CS2 concluem classificação e chaveamento sem eliminados voltarem',()=>{
 for(const mode of ['MOBA','FPS'] as const){
   const f=fixture(mode),season=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
   for(const edition of season.editions){
     let count=0;
     while(!edition.champion){
       const game=edition.fixtures.find(g=>!g.result)!;assert.ok(game);
       // Deterministic wins suffice to exercise every bracket transition.
       game.result={winner:game.home,score:[Math.ceil(game.bestOf/2),0],maps:[],completedDay:game.day};game.status='completed';
       progressBracket(edition);assert.ok(++count<100);
     }
     assert.equal(new Set(edition.finalOrder).size,edition.participants.length);
     assert.equal(edition.finalOrder[0],edition.champion);
     assert.equal(edition.fixtures.filter(g=>g.phase==='final').length,1);
     if(mode==='MOBA'){assert.equal(standings(edition).reduce((sum,row)=>sum+row.wins,0),edition.participants.length*(edition.participants.length-1)/2);assert.equal(edition.fixtures.at(-1)!.bestOf,5);}
   }
   validateCalendar(season);
 }
});

test('MD3 e MD5 guardam de dois a cinco mapas individuais e condições entre mapas',()=>{
 const f=fixture('FPS');const rivals=catalog.teams.filter(t=>catalog.leagues.find(l=>l.id===t.league)?.discipline==='FPS'&&!t.academy).slice(0,2);
 const sides=rivals.map(t=>({id:t.id,name:t.name,code:'TST',logo:'',lineup:rivalLineup(f.players,t.id,'FPS',1)})) as [MatchSide,MatchSide];
 for(const bestOf of [3,5] as const){const result=simulateSeries(sides,'FPS',1,bestOf,42);assert.equal(Math.max(...result.score),Math.ceil(bestOf/2));assert.equal(result.maps.length,result.score[0]+result.score[1]);assert.ok(result.maps.length>=Math.ceil(bestOf/2)&&result.maps.length<=bestOf);}
});

test('nomes e valores configurados são usados e faltas de participantes são explicadas',()=>{
 const f=fixture('MOBA');const config={...defaultCompetitionConfig,cblol:{...defaultCompetitionConfig.cblol,name:'Liga Aurora',prize:123000}};
 const season=generateSeason(f.career,catalog,f.players,f.contracts,1,1,config);
 assert.equal(season.editions.find(e=>e.key==='cblol')!.name,'Liga Aurora');assert.equal(season.editions.find(e=>e.key==='cblol')!.prize,123000);
 const empty=generateSeason(f.career,{organizations:[],teams:[],leagues:[]},f.players,f.contracts,1,1);
 assert.equal(empty.editions.length,0);assert.ok(empty.notices.length>0);
});

test('desempate usa confronto entre empatados antes do ID e é estável',()=>{
 const f=fixture('MOBA'),edition=generateSeason(f.career,catalog,f.players,f.contracts,1,1).editions[0];
 edition.participants=edition.participants.slice(0,4).map((p,index)=>({...p,id:['z','a','c','d'][index]}));
 edition.fixtures=[['z','a'],['z','c'],['d','z'],['a','c'],['a','d'],['c','d']].map(([home,away],index)=>({id:'tie'+index,competitionId:edition.id,season:1,day:1,home,away,phase:'regular',round:1,bestOf:1,status:'completed',result:{winner:home,score:[1,0],maps:[],completedDay:1}}));
 const rows=standings(edition);assert.equal(rows[0].team,'z');assert.equal(rows[1].team,'a');assert.deepEqual(standings(edition),rows);
});
import {startingEntry} from '../src/game-core/entry.ts';
import {careerCreationVersion} from '../src/version.ts';

test('novas carreiras disputam só a entrada, sem vaga automática na elite',()=>{
 for(const mode of ['MOBA','FPS'] as const){
   const f=fixture(mode);
   f.career.createdVersion=careerCreationVersion;
   f.career.entry=startingEntry(catalog,'BR',mode);
   const season=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
   assert.deepEqual(season.editions.filter(e=>e.participants.some(p=>p.id==='career')).map(e=>e.key),
     [mode==='FPS'?'cs_regional':'circuito_desafiante']);
   validateCalendar(season);
 }
});
test('Major usa o corte de oito posições e aceita um vice regional bem classificado',()=>{
 const f=fixture('FPS');
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','FPS');
 const first=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 for(const edition of first.editions){
   if(edition.key==='cs_major')continue;
   edition.finalOrder=edition.participants.map(p=>p.id);
   edition.champion=edition.finalOrder[0];
 }
 const next=()=>generateSeason(f.career,catalog,f.players,f.contracts,2,366,undefined,{},first);
 const major=(season:Season)=>season.editions.find(e=>e.key==='cs_major')!;
 assert.ok(!major(next()).participants.some(p=>p.id==='career'));
 const regional=first.editions.find(e=>e.key==='cs_regional')!;
 // Second place is enough here because the resulting score puts Aurora above the cutoff.
 regional.finalOrder.splice(1,0,regional.finalOrder.pop()!);
 const qualified=next();
 assert.ok(qualified.fpsRanking!.findIndex(p=>p.organization==='career')<8);
 assert.ok(major(qualified).participants.some(p=>p.id==='career'));
 assert.equal(new Set(major(qualified).participants.map(p=>p.organization)).size,8);
});

test('título da divisão de entrada dá acesso à elite na temporada seguinte',()=>{
 const f=fixture('MOBA');
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','MOBA');
 const first=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 const entry=first.editions.find(e=>e.key===f.career.entry!.leagueId)!;
 assert.ok(!entry.participants.some(p=>p.id===f.career.entry!.displacedTeamId));
 const next=()=>generateSeason(f.career,catalog,f.players,f.contracts,2,366,undefined,{},first);
 assert.ok(!next().editions.find(e=>e.key==='cblol')!.participants.some(p=>p.id==='career'));
 entry.champion='career';
 assert.ok(next().editions.find(e=>e.key==='cblol')!.participants.some(p=>p.id==='career'));
});
test('regiões e dificuldades diferentes respeitam a entrada do catálogo',()=>{
 for(const [country,difficulty] of [['DE','Difícil'],['US','Fácil'],['KR','Realista'],['CN','Normal']]){
   for(const mode of ['MOBA','FPS'] as const){
     const f=fixture(mode);
     Object.assign(f.career,{country,difficulty,createdVersion:careerCreationVersion,entry:startingEntry(catalog,country,mode)});
     const season=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
     const entries=season.editions.filter(e=>e.participants.some(p=>p.id==='career'));
     assert.deepEqual(entries.map(e=>e.key),[mode==='FPS'?'cs_regional':f.career.entry!.leagueId]);
     assert.equal(new Set(entries[0].participants.map(p=>p.organization)).size,entries[0].participants.length);
     validateCalendar(season);
   }
 }
});
test('catálogo com poucos rivais elegíveis não concede vaga na elite',()=>{
 for(const mode of ['MOBA','FPS'] as const){
   const f=fixture(mode);
   f.career.createdVersion=careerCreationVersion;
   const entry=f.career.entry=startingEntry(catalog,'BR',mode);
   const incomplete={...catalog,teams:catalog.teams.filter(team=>team.league!==entry.leagueId||team.id===entry.displacedTeamId)};
   assert.throws(()=>generateSeason(f.career,incomplete,f.players,f.contracts,1,1),/faltam equipes elegíveis/);
 }
});
import {pendingUserFixtures,planCompetitionAdvance} from '../src/game-core/competitions.ts';
test('agenda reúne pendências simultâneas de MOBA e FPS e limita avanço ao primeiro compromisso',()=>{
 const {career,players,contracts}=fixture('MOBA');
 const season=generateSeason(career,catalog,players,contracts,1,1);
 const edition=season.editions.find(e=>e.participants.some(p=>p.id==='career'))!;
 const game=edition.fixtures.find(f=>f.home==='career'||f.away==='career')!;
 const fps={...edition,id:'fps',mode:'FPS' as const,fixtures:[{...game,id:'fps-game',competitionId:'fps'}]};
 const schedule:Season={...season,editions:[{...edition,fixtures:[game]},fps]};
 assert.equal(pendingUserFixtures(schedule).length,2);
 for(const days of [1,7,30]) assert.equal(planCompetitionAdvance(schedule,game.day-2,days).days,Math.min(2,days));
 for(const day of [game.day,game.day+1])assert.equal(planCompetitionAdvance(schedule,day,30).days,0);
 game.status='completed';
 assert.deepEqual(pendingUserFixtures(schedule).map(row=>row.fixture.id),['fps-game']);
});
