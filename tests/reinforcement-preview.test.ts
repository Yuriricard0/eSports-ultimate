import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reinforcementPreview} from '../src/game-core/reinforcement-preview.ts';
import {roles} from '../src/game-core/attributes.ts';
import type {Contract,Player} from '../src/game-core/recruitment.ts';
import {teamChemistry} from '../src/game-core/development.ts';

for(const mode of ['MOBA','FPS'] as const)test('simula titular de '+mode+' e conserva a folha do atleta substituído',()=>{
 const players=roles[mode].map((role,index)=>({id:index+1,role,mode,overall:70,attributes:{},organization:null})) as Player[];
 const contracts=players.map(player=>({player_id:player.id,starter:1,salary:3000,start_day:1,end_day:180})) as Contract[];
 const candidate={...players[2],id:10,overall:80};
 const snapshot=JSON.stringify({players,contracts,candidate});
 const result=reinforcementPreview(mode,80,players,contracts,candidate,{bonus:1000,salary:5000,days:180,transferFee:2500});
 assert.equal(result?.incumbent?.id,players[2].id);
 assert.ok(result!.projectedOverall!>result!.currentOverall!);
 assert.equal(result?.currentPayroll,15000);
 assert.equal(result?.projectedPayroll,20000);
 assert.equal(result?.cost.immediate,3500);
 assert.equal(JSON.stringify({players,contracts,candidate}),snapshot);
 assert.equal(reinforcementPreview(mode,80,players,contracts,{...candidate,mode:mode==='FPS'?'MOBA':'FPS'},{bonus:0,salary:0,days:180}),null);
});

test('uma vaga pode ser simulada, com entrosamento indisponível para escalação incompleta',()=>{
 const candidate={id:10,role:'mid',mode:'MOBA',overall:80,attributes:{}} as Player;
 const result=reinforcementPreview('MOBA',3,[],[],candidate,{bonus:0,salary:0,days:180});
 assert.equal(result?.incumbent,undefined);
 assert.equal(result?.projectedChemistry,null);
 assert.equal(result?.projectedSlots,1);
});

test('entrosamento usa a afinidade real e começa sem dias compartilhados com a contratação',()=>{
 const first={id:1,role:'mid',mode:'MOBA',overall:70,attributes:{moba_communication:65}} as Player;
 const second={...first,id:2,role:'jungle'};
 const candidate={...first,id:3};
 const contracts=[first,second].map(player=>({player_id:player.id,starter:1,salary:3000,start_day:1,end_day:180})) as Contract[];
 const result=reinforcementPreview('MOBA',100,[first,second],contracts,candidate,{bonus:0,salary:3000,days:180});
 assert.equal(result?.projectedChemistry,teamChemistry([{player:candidate,startDay:100},{player:second,startDay:1}],100));
 assert.ok(result!.currentChemistry!>result!.projectedChemistry!);
});
