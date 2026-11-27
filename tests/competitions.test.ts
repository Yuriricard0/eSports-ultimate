import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {enrollOptionalEvent,generateSeason,nextUserFixture,playCompetitionFixture,standings,progressBracket,simulateSeries,defaultCompetitionConfig,validateCompetitionConfig,type Competition,type Season} from '../src/game-core/competitions.ts';
import {careerAgenda,competitionCalendar} from '../src/game-core/career-agenda.ts';
import {competitionLineup,lockCompetitionRosters} from '../src/game-core/competition-registration.ts';
import {hashSeed,progressSeason} from '../src/game-core/competitions.ts';

for(const [mode,country] of [['MOBA','BR'],['MOBA','KR'],['FPS','BR'],['FPS','DE']] as const)test('20 temporadas de calendário · '+mode+' '+country,()=>{
 const f=fixture(mode);
 f.career.country=country;
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,country,mode);
 let previous:Season|undefined;
 const historicalTitles=new Map<Season,string>();
 for(let number=1;number<=20;number++){
   const start=Math.max((number-1)*366+1,(previous?.endDay??0)+1);
   const season=generateSeason({...f.career,day:start},catalog,f.players,f.contracts.map(c=>({...c,end_day:start+365})),number,start,undefined,{},previous);
   assert.ok(season.editions.length>0);
   const completed=new Set<string>();
   while(season.editions.some(event=>!event.champion)){
     const candidate=season.editions.flatMap(event=>event.fixtures.filter(game=>!game.result).map(game=>({event,game})))
       .sort((a,b)=>a.game.day-b.game.day||a.game.id.localeCompare(b.game.id))[0];
     assert.ok(candidate,'temporada travada');assert.ok(completed.size<900);
     const {event,game}=candidate;
     assert.ok(!completed.has(game.id));completed.add(game.id);
     const home=hashSeed(game.id)%2===0,wins=Math.ceil(game.bestOf/2);
     game.result={winner:home?game.home:game.away,score:home?[wins,0]:[0,wins],maps:[],completedDay:game.day};
     game.status='completed';progressSeason(season,event,game.day);
   }
   validateCalendar(season);
   for(const event of season.editions){
     assert.equal(new Set(event.participants.map(team=>team.organization)).size,event.participants.length);
     assert.equal(new Set(event.finalOrder).size,event.participants.length);
     assert.equal(event.finalOrder[0],event.champion);
   }
   for(const [archive,expected] of historicalTitles)assert.equal(JSON.stringify(archive.editions.map(event=>event.finalOrder)),expected);
   historicalTitles.set(season,JSON.stringify(season.editions.map(event=>event.finalOrder)));
   previous=season;
 }
});

for(const mode of ['MOBA','FPS'] as const)test('favorito vence mais, mas há zebras · '+mode,()=>{
 const f=fixture(mode);
 const source=f.players.filter(p=>p.id>=10000);
 const team=(id:string,offset:number,level:number):MatchSide=>({
   id,name:id,code:id,logo:'',lineup:source.map(player=>({role:player.role,startDay:1,player:{...player,id:player.id+offset,
     overall:level,attributes:Object.fromEntries(Object.keys(player.attributes).map(key=>[key,level]))}})),
 });
 const favorite=team('favorito',0,69),underdog=team('desafiante',100,55);
 let wins=0;
 for(let seed=1;seed<=100;seed++){
   const sides:[MatchSide,MatchSide]=seed%2?[favorite,underdog]:[underdog,favorite];
   if(simulateSeries(sides,mode,20,1,seed).winner===favorite.id)wins++;
 }
 assert.ok(wins>50&&wins<100,mode+': '+wins+' vitórias do favorito em 100 simulações');
});
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
import {eligibleRegionalChallengers,schedulePermanence} from '../src/game-core/competition-pyramid.ts';
import {createDoubleElimination,groupRound,swissPairs} from '../src/game-core/competition-formats.ts';

test('eliminação dupla resolve byes e exige reset quando a chave inferior vence a final',()=>{
 const f=fixture('FPS');
 const seed=generateSeason(f.career,catalog,f.players,f.contracts,1,1).editions[0];
 const bank=Array.from({length:32},(_,i)=>({...seed.participants[i%8],id:'team-'+i,organization:'org-'+i}));
 for(const size of [2,3,4,5,6,8,12,16,31,32])for(const forceReset of [false,true]){
   const participants=bank.slice(0,size);
   const bracket=createDoubleElimination(participants.map(team=>team.id),{upper:3,lower:3,final:5,grandFinal:'reset'});
   const edition:Competition={...seed,participants,fixtures:[],finalOrder:[],doubleElimination:bracket};
   const losses=new Map<string,number>(),days=new Set<string>();
   progressBracket(edition);
   while(!edition.champion){
     const pending=edition.fixtures.filter(game=>!game.result).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
     const game=pending[0];assert.ok(game,'chave não pode ficar travada');
     for(const id of [game.home,game.away]){
       assert.ok((losses.get(id)??0)<2,'eliminada voltou ao torneio');
       assert.ok(!days.has(id+':'+game.day),'duas partidas na mesma data');
       days.add(id+':'+game.day);
     }
     const winner=forceReset&&game.id.endsWith(':final-1-0')?game.away:game.home;
     const loser=winner===game.home?game.away:game.home;
     losses.set(loser,(losses.get(loser)??0)+1);
     game.result={winner,score:winner===game.home?[Math.ceil(game.bestOf/2),0]:[0,Math.ceil(game.bestOf/2)],maps:[],completedDay:game.day};
     game.status='completed';
     progressBracket(edition);
   }
   assert.equal(edition.fixtures.length,2*(size-1)+Number(forceReset));
   assert.equal(edition.fixtures.some(game=>game.id.endsWith(':reset-1-0')),forceReset);
   assert.equal(new Set(edition.finalOrder).size,size);
   assert.equal(edition.finalOrder[0],edition.champion);
   for(const team of participants)assert.equal(losses.get(team.id)??0,team.id===edition.champion?Number(forceReset):2);
   const snapshot=JSON.stringify(edition);
   progressBracket(edition);
   assert.equal(JSON.stringify(edition),snapshot);
 }
});

test('grupos ímpares têm um bye por rodada e o suíço evita repetições quando há solução',()=>{
 const teams=['a','b','c','d','e'];
 const groupGames=teams.flatMap((_,index)=>groupRound([teams],index+1));
 assert.equal(groupGames.length,10);
 assert.equal(new Set(groupGames.map(pair=>[...pair].sort().join(':'))).size,10);
 const played:{home:string;away:string}[]=[];
 const order=[...teams,'f','g','h'];
 for(let round=0;round<5;round++){
   const pairs=swissPairs(order,played);
   assert.equal(new Set(pairs.flat()).size,order.length);
   for(const [home,away] of pairs){
     assert.ok(!played.some(game=>[game.home,game.away].includes(home)&&[game.home,game.away].includes(away)));
     played.push({home,away});
   }
 }
});

test('Mundial recebe campeã e vice das ligas e classifica quatro pelos grupos',()=>{
 const f=fixture('MOBA');
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','MOBA');
 const season=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 const world=season.editions.find(edition=>edition.key==='moba_world')!;
 assert.equal(world.participants.length,0);
 const leagues=season.editions.filter(e=>world.internationalSources!.includes(e.key));
 const last=leagues.at(-1)!;
 for(const league of leagues){
   league.finalOrder=league.participants.map(team=>team.id);
   if(league!==last)league.champion=league.finalOrder[0];
 }
 const [home,away]=last.participants;
 last.fixtures=[{...last.fixtures[0],phase:'final',day:last.endDay,home:home.id,away:away.id}];
 const sides=[home,away].map(team=>({...team,lineup:rivalLineup(f.players,team.id,'MOBA',last.endDay)})) as [MatchSide,MatchSide];
 playCompetitionFixture(season,last.fixtures[0].id,last.endDay,sides,1);
 assert.deepEqual(new Set(world.participants.map(team=>team.id)),new Set(leagues.flatMap(league=>league.finalOrder.slice(0,2))));
 assert.ok(!world.participants.some(team=>team.id==='career'),'divisão de acesso não dá vaga no Mundial');
 assert.equal(world.openingStage?.system,'groups');
 const games=world.fixtures.slice();
 for(const game of games){
   game.result={winner:game.home,score:[2,0],maps:[],completedDay:game.day};game.status='completed';
   progressBracket(world);
 }
 assert.equal(world.doubleElimination!.nodes.filter(node=>node.lane==='upper'&&node.round===1).length,2);
 assert.equal(world.finalOrder.length,world.participants.length-4);
 validateCalendar(season);
});

test('vagas por prestígio usam resultados anteriores e ficam registradas na abertura da temporada',()=>{
 const f=fixture('MOBA');
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','MOBA');
 const old=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 const world=old.editions.find(e=>e.key==='moba_world')!;
 const finalists=['lec','cblol'].map(key=>old.editions.find(e=>e.key===key)!.participants[0]);
 const [winner,runnerUp]=finalists.map(team=>team.id);
 world.participants=finalists;world.champion=winner;world.finalOrder=[winner,runnerUp];
 world.fixtures=[{...old.editions[0].fixtures[0],phase:'final',home:winner,away:runnerUp,day:300,status:'completed',
   result:{winner,score:[3,0],maps:[],completedDay:300}}];
 const setting=defaultCompetitionConfig.moba_world;
 const options={...defaultCompetitionConfig,moba_world:{...setting,stageRules:{...setting.stageRules!,regionalSlots:'prestige' as const}}};
 const next=generateSeason(f.career,catalog,f.players,f.contracts,2,367,options,{},old);
 const slots=next.editions.find(e=>e.key==='moba_world')!.internationalSlots!;
 assert.equal(slots.lec,3);
 assert.equal(Object.values(slots).filter(value=>value===1).length,1);
 assert.equal(Object.values(slots).reduce((sum,value)=>sum+value,0),12);
 assert.equal(world.internationalSlots,undefined);
});

test('Copa Inter-regional usa resultados, pareia o suíço e aplica regulamento configurado',()=>{
 const f=fixture('FPS');
 const first=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 const source=first.editions[0];
 const template=source.participants[0];
 const catalogTeams=['vrs_americas','vrs_europa','vrs_asia'].flatMap(league=>
   catalog.teams.filter(team=>team.league===league&&rivalLineup(f.players,team.id,'FPS',1).length===5).slice(0,6));
 const unique=[...new Map(catalogTeams.map(team=>[team.organization,{...template,id:team.id,organization:team.organization,name:team.name}])).values()].slice(0,16);
 assert.ok(unique.length>=12);
 source.participants=unique;source.champion=unique[0].id;source.finalOrder=unique.map(team=>team.id);
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','FPS');
 const defaults=defaultCompetitionConfig.cs_interregional;
 const config={...defaultCompetitionConfig,cs_interregional:{...defaults,stageRules:{...defaults.stageRules!,upper:1 as const,lower:5 as const,grandFinal:'single' as const,swissAdvance:4 as const}}};
 const historical={...config};delete historical.cs_interregional;
 assert.deepEqual(validateCompetitionConfig(historical).cs_interregional,defaults);
 const season=generateSeason(f.career,catalog,f.players,f.contracts,2,367,config,{},first);
 const cup=season.editions.find(edition=>edition.key==='cs_interregional')!;
 assert.equal(cup.participants.length,12);
 assert.equal(new Set(cup.participants.map(team=>catalog.teams.find(row=>row.id===team.id)?.league)).size,3);
 assert.ok(cup.participants.every(team=>season.fpsRanking!.some(row=>row.organization===team.organization)));
 for(let round=1;round<=3;round++){
   const games=cup.fixtures.filter(game=>game.round===round&&game.phase==='regular');
   assert.equal(games.length,6);
   assert.equal(new Set(games.flatMap(game=>[game.home,game.away])).size,12);
   for(const game of games){
     game.result={winner:game.home,score:[1,0],maps:[],completedDay:game.day};game.status='completed';
     progressBracket(cup);
   }
 }
 assert.equal(cup.doubleElimination!.nodes.filter(node=>node.lane==='upper'&&node.round===1).length,2);
 assert.equal(cup.doubleElimination!.nodes.some(node=>node.lane==='reset'),false);
 assert.ok(cup.doubleElimination!.nodes.filter(node=>node.lane==='upper').every(node=>node.bestOf===1));
 assert.ok(cup.doubleElimination!.nodes.filter(node=>node.lane==='lower').every(node=>node.bestOf===5));
 assert.equal(cup.finalOrder.length,8);
 validateCalendar(season);
});

test('temporadas novas variam formatos regionais e anunciam a copa antes das inscrições',()=>{
 const f=fixture('MOBA');
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','MOBA');
 const season=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 const league=(key:string)=>season.editions.find(e=>e.key===key)!;
 assert.ok(league('lck').fixtures.every(game=>game.bestOf===3));
 assert.equal(league('lec').fixtures.length,league('lec').participants.length*(league('lec').participants.length-1));
 assert.ok(league('lpl').participants.length>league('lck').participants.length);
 for(const match of league('lec').fixtures.filter(game=>game.split===1))
   assert.ok(league('lec').fixtures.some(game=>game.split===2&&game.home===match.away&&game.away===match.home));
 assert.equal(league('br_cup').participants.some(team=>team.id==='career'),false);
 assert.ok(league('br_cup').entryWindow!.opens>season.startDay);
 validateCalendar(season);
});

test('janela opcional aparece na agenda e inscreve apenas uma vez sem criar conflitos',()=>{
 const f=fixture('MOBA');
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','MOBA');
 const season=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 const cup=season.editions.find(e=>e.key==='br_cup')!,window=cup.entryWindow!;
 const home=season.editions.find(e=>e.key===f.career.entry!.leagueId)!;
 const own=home.participants.find(team=>team.id==='career')!;
 assert.ok(careerAgenda(f.career,[season],[],[],new Map()).some(row=>row.day===window.opens&&row.target==='competitions'));
 assert.throws(()=>enrollOptionalEvent(season,cup.id,window.opens-1,own),/prazo/);
 assert.throws(()=>enrollOptionalEvent(season,cup.id,window.closes+1,own),/prazo/);
 home.fixtures.push({...home.fixtures.find(g=>g.home==='career'||g.away==='career')!,day:cup.startDay});
 assert.throws(()=>enrollOptionalEvent(season,cup.id,window.opens,own),/conflito/);
 home.fixtures.pop();
 enrollOptionalEvent(season,cup.id,window.opens,own);
 const snapshot=JSON.stringify(season);
 enrollOptionalEvent(season,cup.id,window.opens,own);
 assert.equal(JSON.stringify(season),snapshot);
 assert.equal(new Set(cup.participants.map(p=>p.organization)).size,8);
 assert.equal(cup.fixtures.filter(g=>g.home==='career'||g.away==='career').length,1);
 for(const game of home.fixtures)game.status='completed';
 assert.equal(nextUserFixture(season)?.competitionId,cup.id);
 validateCalendar(season);
});

test('prazo congela reservas, rejeita contratação tardia e mantém modos simultâneos',()=>{
 const f=fixture('MOBA');
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','MOBA');
 const season=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 const home=season.editions.find(e=>e.key===f.career.entry!.leagueId)!;
 const cutoff=home.startDay-1;
 const registration=competitionCalendar(f.career,season);
 assert.ok(registration.some(event=>event.day===cutoff&&event.status==='confirmed'&&event.id===home.id+':roster'));
 assert.ok(registration.some(event=>event.status==='forecast'&&event.id===home.id+':projected'));
 const original=f.contracts[0],source=f.players.find(p=>p.id===original.player_id)!;
 const reserve={...source,id:20001,nickname:'Reserva'};
 const late={...source,id:20002,nickname:'Tardio'};
 const allowed=[...f.contracts.map(row=>row.player_id),reserve.id];
 assert.equal(lockCompetitionRosters(season,cutoff,()=>allowed),false);
 assert.equal(lockCompetitionRosters(season,cutoff+1,()=>allowed),true);
 const players=[...f.players,reserve,late];
 const squad=[...f.contracts.map(row=>row===original?{...row,starter:0}:row),
   {...original,player_id:late.id,start_day:cutoff+1},{...original,player_id:reserve.id,starter:0,loan:true}];
 let report=competitionLineup(home,players,squad,cutoff+1);
 assert.equal(report.valid,false);
 assert.deepEqual(report.missingRoles,[source.role]);
 assert.ok(report.unavailable.some(row=>row.player.id===late.id));
 assert.ok(report.reserve.some(player=>player.id===reserve.id));
 squad.find(row=>row.player_id===late.id)!.starter=0;
 squad.find(row=>row.player_id===reserve.id)!.starter=1;
 report=competitionLineup(home,players,squad,cutoff+1);
 assert.equal(report.valid,true);
 assert.equal(lockCompetitionRosters(season,cutoff+3,()=>[late.id]),false);
 const cup=season.editions.find(e=>e.key==='br_cup')!;
 const player=home.participants.find(team=>team.id==='career')!;
 season.editions.push({...home,id:'other-mode',mode:'FPS',fixtures:[{...home.fixtures.find(game=>game.home==='career'||game.away==='career')!,day:cup.startDay}]});
 enrollOptionalEvent(season,cup.id,cup.entryWindow!.opens,player);
 assert.ok(cup.participants.some(team=>team.id==='career'));
});

test('classificatória fechada recebe quatro semifinalistas e quatro convidados únicos',()=>{
 const f=fixture('FPS');
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','FPS');
 const season=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 const open=season.editions.find(e=>e.key==='cs_regional')!,closed=season.editions.find(e=>e.qualifierSource===open.key)!;
 assert.equal(closed.fixtures.length,0);
 const last=open.fixtures.find(g=>g.home!=='career'&&g.away!=='career')!;
 for(const game of open.fixtures.filter(g=>g!==last)){
   game.status='completed';
   game.result={winner:game.away==='career'?'career':game.home,score:[2,0],maps:[],completedDay:game.day};
 }
 const sides=[last.home,last.away].map(id=>({...open.participants.find(p=>p.id===id)!,lineup:rivalLineup(f.players,id,'FPS',last.day)})) as [MatchSide,MatchSide];
 playCompetitionFixture(season,last.id,last.day,sides,42);
 const semifinalists=open.fixtures.filter(g=>g.phase==='semifinal').flatMap(g=>[g.home,g.away]);
 assert.equal(semifinalists.length,4);
 assert.deepEqual(new Set(closed.participants.slice(0,4).map(p=>p.id)),new Set(semifinalists));
 assert.equal(new Set(closed.participants.map(p=>p.organization)).size,8);
 assert.equal(closed.fixtures.filter(g=>g.home==='career'||g.away==='career').length,1);
 assert.ok(closed.startDay>open.endDay);
 assert.equal(closed.qualifierTarget,'cs_league');
 validateCalendar(season);
 const international=season.editions.find(e=>e.key==='cs_league')!;
 const finalists=closed.participants.filter(team=>team.id!=='career'&&!international.participants.some(p=>p.organization===team.organization)).slice(0,2);
 assert.equal(finalists.length,2);
 const own=open.participants.find(team=>team.id==='career')!;
 international.participants[7]=own;
 const final={...closed.fixtures[0],id:closed.id+':final:test',phase:'final' as const,day:closed.endDay,home:finalists[0].id,away:finalists[1].id};
 closed.fixtures.push(final);
 const finalSides=finalists.map(team=>({...team,lineup:rivalLineup(f.players,team.id,'FPS',final.day)})) as [MatchSide,MatchSide];
 const result=playCompetitionFixture(season,final.id,final.day,finalSides,43);
 assert.ok(international.participants.some(team=>team.id===result.winner));
 assert.ok(international.participants.some(team=>team.id==='career'));
 assert.equal(new Set(international.participants.map(team=>team.organization)).size,8);
});

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

test('acesso direto e permanência trocam vagas sem duplicação e sem alterar o histórico',()=>{
 const f=fixture('MOBA');
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','MOBA');
 const first=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 const upper=first.editions.find(row=>row.key==='cblol')!,lower=first.editions.find(row=>row.key==='circuito_desafiante')!;
 const setOrder=(edition:Competition,ids:string[])=>{edition.champion=ids[0];edition.finalOrder=ids;};
 setOrder(upper,upper.participants.map(row=>row.id));
 setOrder(lower,['career',...lower.participants.filter(row=>row.id!=='career').map(row=>row.id)]);
 const challengers=eligibleRegionalChallengers(upper,lower);
 schedulePermanence(first,120);schedulePermanence(first,120);
 const permanence=first.editions.filter(row=>row.key===first.pyramid?.playIn);
 assert.equal(permanence.length,1);
 assert.equal(permanence[0].fixtures[0].home,upper.finalOrder.at(-2));
 assert.equal(permanence[0].fixtures[0].away,challengers[1]);
 assert.equal(permanence[0].prize,0);
 setOrder(permanence[0],[challengers[1],upper.finalOrder.at(-2)!]);
 const original=JSON.stringify(first);
 const second=generateSeason(f.career,catalog,f.players,f.contracts,2,366,undefined,{},first);
 const nextUpper=second.editions.find(row=>row.key===upper.key)!;
 const nextLower=second.editions.find(row=>row.key===lower.key)!;
 assert.equal(nextUpper.participants.length,upper.participants.length);
 assert.equal(nextLower.participants.length,lower.participants.length);
 for(const id of challengers.slice(0,2))assert.ok(nextUpper.participants.some(row=>row.id===id),id);
 for(const id of upper.finalOrder.slice(-2))assert.ok(nextLower.participants.some(row=>row.id===id));
 assert.equal(new Set([...nextUpper.participants,...nextLower.participants].map(row=>row.id)).size,nextUpper.participants.length+nextLower.participants.length);
 assert.equal(JSON.stringify(first),original);
 validateCalendar(second);
 setOrder(nextUpper,[...nextUpper.participants.filter(row=>row.id!=='career').map(row=>row.id),'career']);
 setOrder(nextLower,nextLower.participants.map(row=>row.id));
 const third=generateSeason(f.career,catalog,f.players,f.contracts,3,731,undefined,{},second);
 assert.ok(third.editions.find(row=>row.key===lower.key)!.participants.some(row=>row.id==='career'));
 assert.ok(!third.editions.find(row=>row.key===upper.key)!.participants.some(row=>row.id==='career'));
});

test('vitória do penúltimo mantém a vaga e só aplica a troca direta',()=>{
 const f=fixture('MOBA');
 f.career.createdVersion=careerCreationVersion;
 f.career.entry=startingEntry(catalog,'BR','MOBA');
 const first=generateSeason(f.career,catalog,f.players,f.contracts,1,1);
 const upper=first.editions.find(row=>row.key===first.pyramid?.elite)!;
 const lower=first.editions.find(row=>row.key===first.pyramid?.access)!;
 for(const edition of [upper,lower]){
   edition.finalOrder=edition.participants.map(row=>row.id);
   edition.champion=edition.finalOrder[0];
 }
 schedulePermanence(first,120);
 const playIn=first.editions.find(row=>row.key===first.pyramid?.playIn)!;
 playIn.champion=playIn.fixtures[0].home;
 const challenger=playIn.fixtures[0].away;
 const next=generateSeason(f.career,catalog,f.players,f.contracts,2,366,undefined,{},first);
 assert.ok(next.editions.find(row=>row.key===upper.key)!.participants.some(row=>row.id===playIn.champion));
 assert.ok(next.editions.find(row=>row.key===lower.key)!.participants.some(row=>row.id===challenger));
});
