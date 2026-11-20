import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overall, definitions} from '../src/game-core/attributes.ts';
test('preserva os pesos do Godot e separa funções',()=>{
 const attrs=Object.fromEntries(definitions.MOBA.map(k=>['moba_'+k,60]));
 attrs.moba_mechanics=100;
 assert.ok(Math.abs(overall(attrs,'MOBA','top')-64.57142857142857)<1e-10);
 assert.ok(Math.abs(overall(attrs,'MOBA','support_moba')-61.142857142857146)<1e-10);
});
test('rejeita avaliação incompleta ou matematicamente inválida',()=>{
 const attrs=Object.fromEntries(definitions.MOBA.map(k=>['moba_'+k,60]));
 assert.equal(overall(attrs,'MOBA','awper'),-1);
 assert.equal(overall({},'MOBA','top'),-1);
 for(const invalid of [NaN,Infinity,0,101]) assert.equal(overall({...attrs,moba_mechanics:invalid},'MOBA','top'),-1);
});
