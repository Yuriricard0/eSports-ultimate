import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {definitions,roles,type Mode} from '../src/game-core/attributes.ts';
import type {Player} from '../src/game-core/recruitment.ts';
import {simulateMatch,matchStrength,applyMatchConditions,rivalLineup,type MatchSide,type MatchResult} from '../src/game-core/matches.ts';
import type {WorldCatalog} from '../src/game-core/world.ts';

export function team(mode:Mode,id:string,rating=60,startDay=-90):MatchSide{
 return {id,name:id,code:id.slice(0,3),logo:'',lineup:roles[mode].map((role,index)=>({role,startDay,player:{
   id:(id==='home'?0:100)+index,nickname:id+index,name:id+index,mode,role,overall:rating,organization:id,team:id,country:'BR',birthDay:-8000,portraitIndex:0,estimateLow:rating,estimateHigh:rating,attributes:Object.fromEntries(definitions[mode].map(key=>[mode.toLowerCase()+'_'+key,rating]))
 } as Player}))};
}
function coherent(result:MatchResult){
 assert.equal(result.stats.length,10);assert.equal(new Set(result.stats.map(s=>s.playerId)).size,10);
 assert.ok(result.stats.some(s=>s.playerId===result.mvp));
 for(const side of [0,1] as const){
   const own=result.stats.filter(s=>s.team===side),other=result.stats.filter(s=>s.team!==side);
   assert.equal(own.reduce((sum,s)=>sum+s.kills,0),other.reduce((sum,s)=>sum+s.deaths,0));
   for(const stat of own)assert.ok([stat.kills,stat.deaths,stat.assists].every(n=>Number.isInteger(n)&&n>=0));
 }
 assert.ok(result.score[result.winner]>result.score[1-result.winner]);
 assert.equal(result.events.at(-1)?.kind,'victory');
}

test('MOBA gera eventos, duração, MVP e abates coerentes sem alterar os atletas',()=>{
 const sides:[MatchSide,MatchSide]=[team('MOBA','home'),team('MOBA','away')];const before=JSON.stringify(sides);
 const result=simulateMatch('MOBA',1,sides,42);coherent(result);
 assert.ok(result.durationMinutes>=24&&result.durationMinutes<=45);
 assert.deepEqual([...result.score].sort(),[0,1]);
 assert.ok(['early','fight','objective'].every(kind=>result.events.some(event=>event.kind===kind)));
 assert.equal(JSON.stringify(sides),before);assert.deepEqual(simulateMatch('MOBA',1,sides,42),result);
});

test('FPS simula rounds até placar válido, com prorrogação, MVP e estatísticas limitadas aos rounds',()=>{
 let overtime=0,comebacks=0;
 for(let seed=1;seed<=120;seed++){
   const result=simulateMatch('FPS',31,[team('FPS','home'),team('FPS','away')],seed);coherent(result);
   const [win,loss]=[...result.score].sort((a,b)=>b-a);
   assert.ok((win===13&&loss<=11)||(win===16&&loss>=12&&loss<=15));
   assert.equal(result.events.filter(e=>e.kind==='round').length,win+loss);
   for(const stat of result.stats){assert.ok(stat.deaths<=win+loss);assert.equal(stat.roundsWon,result.score[stat.team]);}
   if(win===16)overtime++;if(result.events.some(e=>e.kind==='comeback'))comebacks++;
 }
 assert.ok(overtime>0);assert.ok(comebacks>0);
});

test('força usa cinco atletas, atributos da função, entrosamento, condição e perks',()=>{
 const base=team('MOBA','home',60),fresh=team('MOBA','home',60,31);
 assert.ok(matchStrength(base,'MOBA',31)>matchStrength(fresh,'MOBA',31));
 const bad={...base,lineup:base.lineup.map(s=>({...s,player:{...s.player,condition:{morale:10,form:10,fatigue:90,day:31}}}))};
 assert.ok(matchStrength(base,'MOBA',31)>matchStrength(bad,'MOBA',31));
 const perk={...base,lineup:base.lineup.map(s=>({...s,player:{...s.player,perks:[{id:'strategic_mind',known:true,intensity:1}]}}))};
 assert.ok(matchStrength(perk,'MOBA',31)>matchStrength(base,'MOBA',31));
 const strongest=team('MOBA','home',35);strongest.lineup[0]=base.lineup[0];
 assert.ok(matchStrength(strongest,'MOBA',31)<matchStrength(team('MOBA','away',55),'MOBA',31));
 const misplaced={...base,lineup:base.lineup.map((s,index)=>({...s,player:{...s.player,role:roles.MOBA[(index+1)%5]}}))};
 assert.ok(matchStrength(misplaced,'MOBA',31)<matchStrength(base,'MOBA',31));
});

test('equipes superiores ganham mais vezes, mas ambos os jogos permitem surpresas',()=>{
 for(const mode of ['MOBA','FPS'] as const){
   let wins=0;
   for(let seed=1;seed<=400;seed++)if(simulateMatch(mode,31,[team(mode,'home',72),team(mode,'away',55)],seed).winner===0)wins++;
   assert.ok(wins>250,mode+': favorito precisa ganhar mais');assert.ok(wins<400,mode+': precisa admitir surpresa');
 }
});

test('resultado altera apenas condições de quem jogou, mantendo atributos e Overall',()=>{
 const home=team('MOBA','home'),away=team('MOBA','away');const players=[...home.lineup,...away.lineup].map(s=>s.player);
 const result=simulateMatch('MOBA',31,[home,away],4);const reserve={...players[0],id:999};
 const updated=applyMatchConditions([...players,reserve],result);
 for(const player of players){const after=updated.find(p=>p.id===player.id)!;assert.equal(after.overall,player.overall);assert.deepEqual(after.attributes,player.attributes);assert.ok(after.condition!.fatigue>0);}
 const winner=result.stats.find(s=>s.team===result.winner)!;assert.ok(updated.find(p=>p.id===winner.playerId)!.condition!.morale>55);
 assert.deepEqual(updated.find(p=>p.id===999),reserve);
});

test('rejeita equipes incompletas, jogadores repetidos e modalidades conflitantes',()=>{
 const home=team('MOBA','home'),away=team('MOBA','away');
 assert.throws(()=>simulateMatch('MOBA',1,[{...home,lineup:home.lineup.slice(1)},away],1),/cinco|5/i);
 assert.throws(()=>simulateMatch('MOBA',1,[home,home],1),/repet|distint|mesm/i);
 assert.throws(()=>simulateMatch('MOBA',1,[home,team('FPS','away')],1),/modalidade|funç/i);
});

test('simula elencos dos catálogos reais MOBA e FPS sem criar atletas',()=>{
 const players=JSON.parse(readFileSync('public/data/players-v1.json','utf8')) as Player[];
 const catalog=JSON.parse(readFileSync('public/data/real_teams_2026.json','utf8')) as WorldCatalog;
 const leagues=new Map(catalog.leagues.map(league=>[league.id,league.discipline]));
 const original=JSON.stringify(players);
 for(const mode of ['MOBA','FPS'] as const){
   const selected=catalog.teams.filter(team=>!team.academy&&leagues.get(team.league)===mode).slice(0,2);
   const sides=selected.map(team=>{
     const org=catalog.organizations.find(org=>org.id===team.organization)!;
     return {id:team.id,name:team.name,code:org.code,logo:org.logo,lineup:rivalLineup(players,team.id,mode,1)};
   }) as [MatchSide,MatchSide];
   coherent(simulateMatch(mode,1,sides,2026));
 }
 assert.equal(JSON.stringify(players),original);
});
