import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startingEntry} from '../src/game-core/entry.ts';

const catalog=JSON.parse(readFileSync(new URL('../public/data/real_teams_2026.json',import.meta.url),'utf8'));
test('LoL começa no desenvolvimento e mantém a equipe substituída na referência',()=>{
  for(const [country,league] of [['BR','circuito_desafiante'],['KR','lck_challengers'],['CN','wsci_classificatoria_chinesa'],['AR','lrs']]){
    const entry=startingEntry(catalog,country,'MOBA');
    assert.equal(entry.leagueId,league);
    assert.ok(catalog.teams.some(team=>team.id===entry.displacedTeamId&&team.league===league));
  }
});
test('CS2 começa sem posição e não desloca equipe do VRS',()=>{
  assert.deepEqual(startingEntry(catalog,'BR','FPS'),{leagueId:'vrs_americas',kind:'open_circuit',displacedTeamId:null});
  assert.equal(startingEntry(catalog,'JP','FPS').leagueId,'vrs_asia');
  assert.equal(startingEntry(catalog,'DE','FPS').leagueId,'vrs_europa');
});
