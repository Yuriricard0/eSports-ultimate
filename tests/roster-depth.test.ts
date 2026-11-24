import {test} from 'node:test';
import assert from 'node:assert/strict';
import {definitions,roles} from '../src/game-core/attributes.ts';
import {rosterDepth} from '../src/game-core/roster-depth.ts';
import type {Contract,Player} from '../src/game-core/recruitment.ts';

for(const mode of ['MOBA','FPS'] as const)test(`${mode}: mede cobertura com reservas elegíveis e usa a condição no desempate`,()=>{
 const [first,second]=roles[mode];
 const player=(id:number,role:string,overall:number,fatigue=0)=>({id,mode,role,overall,condition:{morale:55,form:50,fatigue,day:1},
   attributes:Object.fromEntries(definitions[mode].map(key=>[`${mode.toLowerCase()}_${key}`,overall]))}) as Player;
 const players=[player(1,first,80),player(2,first,75,30),player(3,first,75),player(4,first,97),player(5,second,70)];
 const contracts=players.map(p=>({player_id:p.id,starter:Number(p.id===1),academy:Number(p.id===4)} as Contract));
 const [a,b,c]=rosterDepth(players,contracts,mode,1);
 assert.equal(a.label,'Cobertura adequada');
 assert.deepEqual(a.reserves.map(row=>row.player.id),[3,2]);
 assert.equal(a.principal.length,5);
 assert.equal(b.label,'Cobertura limitada');
 assert.equal(c.label,'Sem reserva');
});
