import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterOrganizations, type WorldCatalog} from '../src/game-core/world.ts';

const catalog:WorldCatalog=JSON.parse(readFileSync(new URL('../public/data/real_teams_2026.json',import.meta.url),'utf8'));

test('filtra a mesma equipe por liga e tier, sem confundir T1 com a sua academia',()=>{
  const filter={query:'T1',mode:'MOBA',country:'KR',league:'lck',tier:1};
  assert.deepEqual(filterOrganizations(catalog,filter).map(org=>org.id),['t1']);
  assert.deepEqual(filterOrganizations(catalog,{...filter,tier:2}),[]);
  assert.deepEqual(filterOrganizations(catalog,{...filter,league:'lck_challengers',tier:2}).map(org=>org.id),['t1']);
});

test('catálogo web preserva vínculos do elenco e arquivos das logos catalogadas',()=>{
  const teams=new Map(catalog.teams.map(team=>[team.id,team]));
  const organizations=new Set(catalog.organizations.map(org=>org.id));
  const leagues=new Set(catalog.leagues.map(league=>league.id));
  const players=JSON.parse(readFileSync(new URL('../public/data/players-v1.json',import.meta.url),'utf8'));
  assert.equal(catalog.teams.length,602);
  assert.equal(leagues.size,31);
  for(const team of teams.values()){
    assert.ok(organizations.has(team.organization),team.id);
    assert.ok(leagues.has(team.league),team.id);
  }
  const rosters=new Set<string>();
  for(const player of players){
    if(!player.team)continue;
    assert.equal(teams.get(player.team)?.organization,player.organization);
    rosters.add(player.team);
  }
  assert.equal(rosters.size,teams.size);
  for(const org of catalog.organizations.filter(org=>org.logo)){
    const path=org.logo.replace('res://','');
    const bytes=readFileSync(new URL('../public/'+path,import.meta.url));
    assert.ok(bytes.length>8,org.id);
  }
});
