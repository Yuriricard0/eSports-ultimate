import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld,addRankedProspects} from '../src/game-core/generation.ts';
import {overall} from '../src/game-core/attributes.ts';
import {rankedCountries,rankedStats} from '../src/game-core/ranked.ts';
const catalog=JSON.parse(readFileSync(new URL('../public/data/players-v1.json',import.meta.url),'utf8'));
const base=catalog.slice(0,120);
test('mundos repetem a mesma seed e preservam vínculos e atributos válidos',()=>{
 const first=generateWorld(base,41),second=generateWorld(base,92);
 assert.deepEqual(first,generateWorld(base,41));
 assert.notDeepEqual(first,second);
 for(const [index,player] of first.entries()){
   assert.equal(player.id,base[index].id);
   assert.equal(player.team,base[index].team);
   assert.equal(player.overall,overall(player.attributes,player.mode,player.role));
   assert.ok(player.estimateLow===null||player.estimateLow<=player.estimateHigh!);
 }
});
test('ranked cobre cada país nos dois jogos sem duplicar IDs nem alterar o catálogo original',()=>{
 assert.equal(new Set(rankedCountries).size,198);
 const world=addRankedProspects(catalog,41);
 const ranked=world.slice(catalog.length);
 assert.equal(ranked.length,198*2*3);
 assert.equal(new Set(world.map(player=>player.id)).size,world.length);
 assert.deepEqual(world.slice(0,catalog.length),catalog);
 assert.deepEqual(addRankedProspects(world,41),world);
 assert.ok(ranked.every(player=>player.status==='ranked'&&!player.team&&rankedStats(player).points>0));
 for(const country of rankedCountries)for(const mode of ['MOBA','FPS']){
   assert.equal(ranked.filter(player=>player.country===country&&player.mode===mode).length,3,country+' '+mode);
 }
});
