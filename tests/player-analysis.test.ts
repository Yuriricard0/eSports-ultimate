import {test} from 'node:test';
import assert from 'node:assert/strict';
import {definitions,overall,roles,type Mode} from '../src/game-core/attributes.ts';
import {analyzeRoles,attributeReference,recentTrend,observeOverall} from '../src/game-core/player-analysis.ts';
import type {Player} from '../src/game-core/recruitment.ts';

for(const mode of ['MOBA','FPS'] as const){
 const attributes=Object.fromEntries(definitions[mode].map((key,index)=>[`${mode.toLowerCase()}_${key}`,45+2*index]));
 test(`${mode}: contribuições somam o Overall real e comparam somente funções válidas`,()=>{
   const role=roles[mode][0];
   const analysis=analyzeRoles(attributes,mode,role)!;
   assert.equal(analysis.attributes.length,20);
   assert.equal(analysis.attributes.filter(row=>row.weight===4).length,5);
   assert.ok(Math.abs(analysis.attributes.reduce((sum,row)=>sum+row.contribution,0)-overall(attributes,mode,role))<1e-10);
   assert.deepEqual(new Set(analysis.roles.map(row=>row.role)),new Set(roles[mode]));
   assert.equal(analysis.roles[0].rating,Math.max(...roles[mode].map(r=>overall(attributes,mode,r))));
   assert.ok(analysis.strengths.length<=3&&analysis.weaknesses.length<=3);
   assert.equal(analyzeRoles({},mode,role),null);
 });
}

test('comparação usa somente outros atletas ativos da mesma modalidade e função',()=>{
 const player={id:1,mode:'MOBA',role:'top',attributes:{moba_mechanics:70}};
 const roster=[player,{...player,id:2,attributes:{moba_mechanics:50}},{...player,id:3,status:'retired' as const},
   {...player,id:4,mode:'FPS'},{...player,id:5,role:'mid'},{...player,id:6,attributes:{}}];
 assert.deepEqual(attributeReference(player,roster,['moba_mechanics']),{moba_mechanics:{average:50,count:1}});
});

test('tendência usa datas do save e exige uma referência recente e válida',()=>{
 assert.equal(recentTrend([],60,120),null);
 assert.equal(recentTrend([{day:10,overall:59},{day:130,overall:62}],60,120),null);
 assert.equal(recentTrend([{day:60,overall:59}],60,120)?.label,'Em ascensão');
 assert.equal(recentTrend([{day:60,overall:60.1}],60,120)?.label,'Estável');
 assert.equal(recentTrend([{day:60,overall:61}],60,120)?.label,'Em declínio');
});

test('empates favorecem a função principal e valores uniformes dão versatilidade',()=>{
 const mode:Mode='FPS',attributes=Object.fromEntries(definitions[mode].map(key=>[`fps_${key}`,55]));
 const analysis=analyzeRoles(attributes,mode,'igl')!;
 assert.equal(analysis.roles[0].role,'igl');
 assert.equal(analysis.versatility,'Versátil');
 assert.deepEqual(analysis.strengths,[]);assert.deepEqual(analysis.weaknesses,[]);
});

test('registra o Overall estável só quando falta uma observação recente',()=>{
 const player={overall:65} as Player;
 const first=observeOverall(player,31);
 assert.deepEqual(first.developmentHistory,[{day:31,overall:65}]);
 assert.equal(observeOverall(first,61),first);
 assert.equal(recentTrend(first.developmentHistory,65,61)?.label,'Estável');
 assert.deepEqual(observeOverall(first,91).developmentHistory,[{day:31,overall:65},{day:91,overall:65}]);
 assert.equal(observeOverall({...player,status:'retired'},31).developmentHistory,undefined);
});
