import {test} from 'node:test';
import assert from 'node:assert/strict';
import {competitionMilestones,playerMilestones} from '../src/game-core/player-milestones.ts';
import {playerMarkers} from '../src/game-core/player-analysis.ts';
import type {Season} from '../src/game-core/competitions.ts';
import type {Player} from '../src/game-core/recruitment.ts';

test('títulos e MVP usam participantes reais e marcos futuros não aparecem',()=>{
 const seasons=[{editions:[{id:'cup',name:'Copa',champion:'rival',fixtures:[{id:'final',phase:'final',result:{completedDay:50,maps:[{
   teams:[{id:'career'},{id:'rival'}],mvp:2,stats:[{playerId:1,team:0},{playerId:2,team:1}],
 }]}}]}]}] as Season[];
 assert.deepEqual(competitionMilestones(seasons,1).map(event=>event.kind),['Partida']);
 assert.deepEqual(competitionMilestones(seasons,2).map(event=>event.kind),['Partida','Título']);
 assert.match(competitionMilestones(seasons,2)[0].text,/MVP/);
 assert.deepEqual(competitionMilestones(seasons,3),[]);
 const player={developmentHistory:[{day:10,overall:50},{day:25,overall:50},{day:40,overall:51},{day:60,overall:60}],history:[{day:3,description:'Histórico importado'}]} as Player;
 assert.deepEqual(playerMilestones(player,competitionMilestones(seasons,2),40).map(event=>event.day),[40,3]);
});

test('marcadores exigem estimativa pública e critérios transparentes',()=>{
 const labels=(player:Pick<Player,'estimateLow'|'estimateHigh'>,age:number,versatility?:string)=>playerMarkers(player,age,versatility).map(marker=>marker.label);
 const concealed={estimateLow:null,estimateHigh:null,ceiling:99};
 assert.deepEqual(labels(concealed,19),[]);
 assert.deepEqual(labels({estimateLow:68,estimateHigh:74},21,'Versátil'),['Jovem talento','Jogador versátil']);
 assert.deepEqual(labels({estimateLow:90,estimateHigh:100},27),['Veterano']);
});
