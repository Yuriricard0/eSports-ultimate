import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCompetitionRankings,worldRegionalSlots} from '../src/game-core/competition-rankings.ts';
import type {Competition,Participant,Season} from '../src/game-core/competitions.ts';
import type {WorldCatalog} from '../src/game-core/world.ts';

const catalog:WorldCatalog={organizations:[],leagues:[],teams:[
 {id:'eu',organization:'eu',name:'Europa',league:'lec',academy:false,tier:1,global_rank:0},
 {id:'br',organization:'br',name:'Brasil',league:'cblol',academy:false,tier:1,global_rank:0},
]};
const team=(id:string):Participant=>({id,organization:id,name:id,code:id,logo:'',strength:99,reputation:100});
function edition(key:string,day:number,ids:string[],prestige:Competition['prestige']='Regional'):Competition{
 const [home,away]=ids;
 return {id:key,key,mode:'MOBA',region:'Global',name:key,prestige,prize:0,reputationGain:0,season:1,finalBestOf:3,format:'knockout',
   participants:ids.map(team),finalOrder:ids,champion:home,startDay:day,endDay:day,
   fixtures:[{id:key+':final',competitionId:key,day,season:1,home,away,phase:'final',round:1,bestOf:3,status:'completed',result:{winner:home,score:[2,0],maps:[],completedDay:day}}]};
}
const season=(number:number,startDay:number,editions:Competition[]):Season=>({number,year:2026+number,startDay,endDay:startDay+364,editions,notices:[]});
const career={mode:'MOBA',country:'BR',day:400};

test('ranking usa resultados datados, decai e separa escopo regional, mundial e prestígio',()=>{
 const first=season(1,1,[edition('cblol',30,['career','br']),edition('lec',40,['eu','br'])]);
 const second=season(2,366,[edition('moba_world',390,['eu','career','br'],'Internacional')]);
 const ranking=buildCompetitionRankings([second,first],career,catalog);
 assert.equal(ranking.regional.rows[0].organization,'career');
 assert.equal(ranking.world.rows[0].organization,'eu');
 assert.equal(ranking.world.rows.find(row=>row.organization==='career')!.results[0].name,'moba_world');
 assert.equal(ranking.regional.history.length,2);
 assert.equal(ranking.world.rows[0].previous,1);
 assert.equal(ranking.prestige[0].id,'lec');
 assert.ok(ranking.prestige[0].value<=100);
 assert.ok(ranking.prestige.every(row=>row.history[0].value===0));
 assert.equal(buildCompetitionRankings([second,first],{...career,day:1200},catalog).world.rows.length,0);
 const withoutWorld=buildCompetitionRankings([second,first],{...career,day:389},catalog);
 assert.ok(withoutWorld.prestige.every(row=>row.value===0));
});

test('amistosos, classificações abertas e permanência não fabricam pontos',()=>{
 const unfinished=edition('cblol',200,['career','br']);
 unfinished.champion=null;
 const staged=season(1,1,[unfinished,edition('permanencia',201,['career','br'])]);
 staged.pyramid={elite:'cblol',access:'circuito_desafiante',playIn:'permanencia'};
 assert.deepEqual(buildCompetitionRankings([staged],career,catalog).world.rows,[]);
});

test('CS2 usa a região do circuito e ignora resultados de MOBA',()=>{
 const major={...edition('cs_major',390,['eu','career','br'],'Major'),mode:'FPS' as const};
 const regional={...catalog,teams:catalog.teams.map(team=>({...team,league:team.id==='eu'?'vrs_europa':'vrs_americas'}))};
 const ranking=buildCompetitionRankings([season(1,1,[major,edition('moba_world',399,['br','career'],'Internacional')])],{...career,mode:'FPS'},regional);
 assert.equal(ranking.region,'Américas');
 assert.equal(ranking.world.rows[0].organization,'eu');
 assert.equal(ranking.regional.rows[0].organization,'career');
 assert.ok(ranking.world.rows.every(row=>row.results.every(result=>result.id==='cs_major')));
});

test('prestígio só transfere uma vaga e mantém o total e a presença de cada região',()=>{
 const leagues=['cblol','lec','lck','lpl','lcs','lcp'];
 const fixed=worldRegionalSlots(leagues,[]);
 assert.ok(Object.values(fixed).every(slots=>slots===2));
 const results=[{id:'lec',value:100},{id:'cblol',value:72},{id:'lcp',value:10},{id:'lck',value:8},{id:'lpl',value:3},{id:'lcs',value:2}];
 const slots=worldRegionalSlots(leagues,results);
 assert.equal(slots.lec,3);
 assert.equal(slots.lcs,1);
 assert.equal(Object.values(slots).reduce((sum,count)=>sum+count,0),12);
 assert.deepEqual(worldRegionalSlots(leagues,[...results].reverse()),slots);
});
