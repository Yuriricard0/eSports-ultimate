import {test} from 'node:test';
import assert from 'node:assert/strict';
import {championshipFromResults,competitionTitles,longestTitleRun} from '../src/game-core/competition-history.ts';
import type {Competition,Season} from '../src/game-core/competitions.ts';
import type {MatchResult,MatchStat} from '../src/game-core/matches.ts';

const team=(id:string,name:string)=>({id,organization:id,name,code:name.slice(0,3),logo:'',strength:50,reputation:20});
const home=team('career','Nova Wolves'),away=team('rival','Iron Ravens');
const player=(playerId:number,side:0|1,rating:number,kills:number):MatchStat=>({
 playerId,team:side,nickname:'Atleta '+playerId,role:'mid',rating,kills,deaths:5,assists:7,roundsWon:4,portraitIndex:playerId,
});
function edition(number:number):Competition{
 const id='s'+number+':moba_world';
 const day=70+number*365;
 const stats=[player(1,0,1.5,4),player(2,0,1.1,20),player(3,0,1,9),player(4,1,.9,8),player(5,1,.8,7)];
 const map={teams:[home,away],stats,mvp:1} as MatchResult;
 return {id,key:'moba_world',name:'Mundial',region:'Global',mode:'MOBA',season:number,prestige:'Internacional',prize:10000,reputationGain:4,
   finalBestOf:5,format:'knockout',participants:[home,away],champion:home.id,finalOrder:[home.id,away.id],startDay:day-20,endDay:day,
   fixtures:[{id:id+':final',competitionId:id,day,season:number,home:home.id,away:away.id,phase:'final',round:1,bestOf:5,status:'completed',
     result:{winner:home.id,score:[3,0],maps:[map,map,map],completedDay:day}}]};
}
const season=(number:number,event:Competition):Season=>({number,year:2026+number,startDay:event.startDay,endDay:event.endDay,editions:[event],notices:[]});

test('instantâneo usa apelidos históricos e premia pela nota em vez de abates',()=>{
 const event=edition(1);
 const snapshot=championshipFromResults(event,new Set([1]))!;
 assert.deepEqual(snapshot.roster.map(row=>row.id),[1,2,3]);
 assert.equal(snapshot.runnerUp?.name,'Iron Ravens');
 assert.equal(snapshot.honors.find(row=>row.kind==='MVP da final')?.athlete.id,1);
 assert.equal(snapshot.honors.find(row=>row.kind==='Melhor da competição')?.athlete.id,1);
 assert.equal(snapshot.honors.find(row=>row.kind==='Revelação sub-21')?.athlete.id,1);
 event.championship=snapshot;
 event.fixtures[0].result!.maps[0].stats[0].nickname='Apelido atual';
 assert.equal(competitionTitles([season(1,event)])[0].history.roster[0].nickname,'Atleta 1');
});

test('WO preserva placar sem inventar escalação, e lacunas quebram a sequência',()=>{
 const events=[1,2,4].map(edition);
 const final=events[2].fixtures[0].result!;
 final.administrative='ineligible-lineup';final.maps=[];
 const titles=competitionTitles(events.map(event=>season(event.season,event)));
 assert.equal(titles[0].history.roster.length,0);
 assert.equal(titles[0].history.honors.length,0);
 assert.deepEqual(titles[0].history.score,[3,0]);
 assert.deepEqual(longestTitleRun(titles),{team:'Nova Wolves',length:2});
});
