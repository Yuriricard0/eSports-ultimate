import {test} from 'node:test';
import assert from 'node:assert/strict';
import {styleOf,affinity,estimatedStrength} from '../src/game-core/team-analysis.ts';
import type {Player} from '../src/game-core/recruitment.ts';
const player={id:1,mode:'MOBA',role:'adc',overall:60,attributes:{moba_mechanics:80,moba_reflexes:80,moba_precision:80,moba_communication:65,moba_coordination:65}} as Player;
test('estilo deriva dos atributos e afinidade muda com o tempo e com os pares',()=>{
  assert.equal(styleOf(player),'Agressivo');
  const partner={...player,id:2,role:'support_moba'};
  const early=affinity(player,partner,0);
  assert.equal(early,affinity(partner,player,0));
  assert.ok(affinity(player,partner,90)>early);
  assert.ok(early>affinity(player,{...partner,role:'adc'},0));
});
test('força informa ausência de elenco e desconta vagas de titulares',()=>{
  assert.equal(estimatedStrength([]),null);
  const roles=['top','jungle','mid','adc','support_moba'];
  const full=roles.map((role,index)=>({...player,role,id:index+1}));
  assert.ok(estimatedStrength(full)!>estimatedStrength(full.slice(0,3))!);
  assert.equal(estimatedStrength(full),estimatedStrength([...full].reverse()));
});
