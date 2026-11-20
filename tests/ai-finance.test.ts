import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {schema} from '../src/game-core/career.ts';
import {contractSchema,type Player} from '../src/game-core/recruitment.ts';
import {competitionSchema} from '../src/game-core/competition-store.ts';
import {syncAiAccounts,payAiSalaries,aiCanBuy,aiPurchase,aiHire,creditAiPrize} from '../src/game-core/ai-finance.ts';

test('IA tem capital finito, paga folha sem duplicar, recebe prêmio uma vez e bloqueia compras impossíveis',()=>{
 const db=new DatabaseSync(':memory:');db.exec(schema+contractSchema+competitionSchema);
 db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',25000000,'#aabbcc','animals_wolf','2026',1)");
 const run=(sql:string,bind:(string|number)[]=[])=>{db.prepare(sql).run(...bind);};
 const read=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).get(...bind);
 const all=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).all(...bind);
 const player={id:7,organization:'rival',overall:45} as Player;
 syncAiAccounts(run,read,all,'a',[player],['rival'],1);
 const original=Number(read('SELECT balance FROM web_ai_finances')!.balance);
 payAiSalaries(run,all,'a',30);payAiSalaries(run,all,'a',30);
 assert.equal(read('SELECT balance FROM web_ai_finances')!.balance,original-220000);
 creditAiPrize(run,read,'a','rival','award1',30,1000000);creditAiPrize(run,read,'a','rival','award1',30,1000000);
 assert.equal(read('SELECT balance FROM web_ai_finances')!.balance,original-220000+1000000);
 assert.equal(aiCanBuy(read,'a','rival',player,100000000),false);
 assert.throws(()=>aiPurchase(run,read,'a','rival',player,100000000,31),/orçamento|Saldo/i);
 db.exec('UPDATE web_ai_finances SET balance=1');
 assert.equal(aiHire(run,read,'a','rival',player,31),false);
 payAiSalaries(run,all,'a',60);assert.equal(read('SELECT balance FROM web_ai_finances')!.balance,0);assert.ok(Number(read('SELECT arrears FROM web_ai_finances')!.arrears)>0);
 syncAiAccounts(run,read,all,'a',[player],['rival'],60);assert.equal(read('SELECT balance FROM web_ai_finances')!.balance,0);
 db.close();
});
