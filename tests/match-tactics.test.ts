import {test} from 'node:test';
import assert from 'node:assert/strict';
import {definitions,roles,type Mode} from '../src/game-core/attributes.ts';
import {simulateSeries} from '../src/game-core/competitions.ts';
import {simulateMatch,type MatchSide} from '../src/game-core/matches.ts';
import type {Player} from '../src/game-core/recruitment.ts';
import {mapAffinity,preferredStrategy,tacticalMaps} from '../src/game-core/match-tactics.ts';

function side(mode:Mode,id:string,offset:number,strong:string[]=[]):MatchSide{
 return {id,name:id,code:id,logo:'',lineup:roles[mode].map((role,index)=>({role,startDay:1,player:{
   id:offset+index,nickname:role,role,mode,overall:60,portraitIndex:-1,
   attributes:Object.fromEntries(definitions[mode].map(key=>[mode.toLowerCase()+'_'+key,strong.includes(key)?85:60])),
 } as Player}))};
}

test('MOBA registra três fases com objetivos e diferencia o plano escolhido',()=>{
 const teams:[MatchSide,MatchSide]=[side('MOBA','career',1),side('MOBA','rival',100,['vision','objectives'])];
 assert.equal(preferredStrategy(teams[1],'MOBA'),'objectives');
 const results=[...Array(40)].map((_,seed)=>[
   simulateMatch('MOBA',30,teams,seed,{strategy:'early'}),simulateMatch('MOBA',30,teams,seed,{strategy:'scaling'}),
 ]);
 assert.ok(results.some(([early,late])=>JSON.stringify(early.phases)!==JSON.stringify(late.phases)));
 const result=results[0][0];
 assert.deepEqual(result.phases?.map(row=>row.phase),['Early Game','Mid Game','Late Game']);
 assert.equal(result.mobaFrames?.filter(row=>row.objective).length,5);
 assert.ok(result.stats.every(row=>row.rating!==undefined&&row.rating>=1&&row.rating<=10));
 assert.ok(result.stats.filter(row=>row.role==='jungle').some(row=>row.contribution!>0));
 for(const row of result.stats)assert.equal(row.contribution,result.roleActions?.filter(action=>action.playerId===row.playerId).length);
 assert.ok(result.roleActions?.every(action=>result.events.some(event=>event.at===action.at&&event.kind==='objective')));
});

test('CS2 usa afinidade real, registra todos os rounds e varia mapas sem repetir na série',()=>{
 const teams:[MatchSide,MatchSide]=[side('FPS','career',1,['map','reading','execution']),side('FPS','rival',100)];
 const nuke=tacticalMaps.find(row=>row.id==='nuke')!,mirage=tacticalMaps.find(row=>row.id==='mirage')!;
 assert.ok(mapAffinity(teams[0],nuke)>mapAffinity(teams[0],mirage));
 for(const bestOf of [1,3,5] as const){
   const series=simulateSeries(teams,'FPS',31,bestOf,42,{strategy:'control'});
   assert.equal(new Set(series.maps.map(row=>row.mapId)).size,series.maps.length);
   assert.ok(series.maps.length<=bestOf);
   for(const map of series.maps){
     assert.equal(map.strategies?.[0],'control');
     assert.equal(map.roundFrames?.length,map.score[0]+map.score[1]);
     assert.ok(map.roundFrames!.every(row=>new Set(row.alive).size===row.alive.length));
     for(const frame of map.roundFrames!){
       const moments=frame.moments!;
       assert.equal(moments[0].alive.length,10);
       assert.deepEqual(moments.at(-1)?.alive,frame.alive);
       assert.equal(moments.at(-1)?.bomb,frame.bomb);
       assert.equal(moments.at(-1)!.score.reduce((sum,n)=>sum+n,0),frame.round);
       assert.equal(moments.some(moment=>moment.label==='Plant'),frame.bomb!=='não plantada');
     }
     assert.ok(map.events.every((row,index)=>index===0||map.events[index-1].at<=row.at));
     for(const action of map.roleActions??[]){
       const athlete=map.stats.find(row=>row.playerId===action.playerId)!;
       const round=map.roundFrames!.find(row=>row.round===action.at)!;
       if(action.kind==='utility')assert.equal(round.utility,athlete.team);
       if(action.kind==='anchor'||action.kind==='utility')assert.ok(round.alive.includes(athlete.playerId));
     }
   }
 }
});
