import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prospect,perkEffects,assignTraits,publicTraits} from '../src/game-core/traits.ts';
import {perks,incompatible} from '../src/game-core/perk-data.ts';

test('os seis perfis usam a faixa observada, incluindo desenvolvimento tardio',()=>{
  assert.deepEqual([45,55,70,85,95].map(value=>prospect(19,value,value,40)),[
    'Jovem comum','Em formação','Promessa regional','Grande promessa','Talento geracional',
  ]);
  assert.equal(prospect(24,70,80,60),'Desenvolvimento tardio');
  assert.equal(prospect(19,null,null,60),'Sem avaliação');
});
test('perks respeitam incompatibilidades e descobertas e só agem no contexto',()=>{
  assert.equal(perks.length,24);
  const base={overall:55,mode:'MOBA',attributes:{moba_adaptation:60}};
  let state=7;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  let empty=0;
  for(let i=0;i<2000;i++){
    const traits=assignTraits(base,random);
    if(!traits.perks.length)empty++;
    assert.ok(traits.perks.length<=2);
    assert.ok(incompatible.every(pair=>!pair.every(id=>traits.perks.some(perk=>perk.id===id))));
  }
  assert.ok(empty>1300&&empty<1500);
  const trait={id:'tilted',intensity:1,known:false};
  assert.equal(publicTraits([trait],false).length,0);
  assert.equal(publicTraits([trait],true).length,1);
  assert.equal(perkEffects([trait],{mistakes:1}).execution,1);
  assert.equal(perkEffects([trait],{mistakes:2}).execution,0.9);
});
