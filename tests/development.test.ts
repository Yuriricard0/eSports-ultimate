import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {developPlayer,playerCondition,reactToResult,teamChemistry} from '../src/game-core/development.ts';
import {overall} from '../src/game-core/attributes.ts';
const {id,mode,role,...base}=JSON.parse(readFileSync(new URL('../public/data/players-v1.json',import.meta.url),'utf8'))[0];
const youngster={...base,id,mode,role,birthDay:-6900,ceiling:95};
test('avanço em lote equivale a avanços curtos e registra mudanças de Overall',()=>{
 const batch=developPlayer(youngster,1,31);
 let daily=youngster;
 for(let day=1;day<31;day++)daily=developPlayer(daily,day,day+1);
 assert.deepEqual(batch,daily);
 assert.ok(batch.overall>youngster.overall);
 assert.equal(batch.overall,overall(batch.attributes,mode,role));
 assert.equal(batch.developmentHistory?.[0].day,31);
 assert.ok(developPlayer({...youngster,birthDay:-13000},1,31).overall<youngster.overall);
});
test('resultados de teste afetam forma e moral sem alterar habilidade',()=>{
 const fresh=playerCondition(youngster,1);
 const loss=reactToResult(fresh,'loss',20);
 assert.ok(loss.morale<fresh.morale&&loss.form<fresh.form&&loss.fatigue>fresh.fatigue);
 assert.ok(reactToResult(loss,'win',20).morale>loss.morale);
});
test('entrosamento cresce com convivência e cai com um titular novo',()=>{
 const lineup=[{player:youngster,startDay:1},{player:{...youngster,id:id+1},startDay:1},{player:{...youngster,id:id+2},startDay:1}];
 assert.equal(teamChemistry(lineup.slice(0,1),120),null);
 assert.ok(teamChemistry(lineup,120)!>teamChemistry(lineup,2)!);
 assert.ok(teamChemistry(lineup,120)!>teamChemistry([lineup[0],lineup[1],{...lineup[2],startDay:120}],120)!);
});
