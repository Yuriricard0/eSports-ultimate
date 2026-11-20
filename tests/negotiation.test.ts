import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {schema} from '../src/game-core/career.ts';
import {contractSchema,hire} from '../src/game-core/recruitment.ts';
import {negotiationSchema,respondToOffer,submitOffer,confirmOffer} from '../src/game-core/negotiation.ts';

const player={id:7,mode:'MOBA',role:'top',overall:45,organization:null,personality:'balanced' as const};
const fair={bonus:1350000,salary:220000,days:365};
test('agente aceita condições justas, contrapõe oferta próxima e recusa oferta baixa',()=>{
 assert.equal(respondToOffer(player,fair).state,'accepted');
 assert.equal(respondToOffer(player,{...fair,salary:190000}).state,'counter');
 assert.equal(respondToOffer(player,{...fair,salary:10000}).state,'rejected');
});
test('fechamento usa os valores negociados e não duplica contrato nem débito',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(schema+contractSchema+negotiationSchema);
 db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',1)");
 const run=(sql:string,bind:(string|number)[])=>{db.prepare(sql).run(...bind);};
 const read=(sql:string,bind:(string|number)[])=>db.prepare(sql).get(...bind);
 const offered={...fair,bonus:1400000,salary:235000,days:180};
 submitOffer(run,read,'a','offer-1',player,offered);
 assert.throws(()=>submitOffer(run,read,'a','offer-2',player,offered),/aberta/);
 const close=()=>confirmOffer(run,read,'a','offer-1',player,false);
 close();
 assert.throws(close);
 assert.equal(read('SELECT balance FROM careers WHERE id=?',['a'])?.balance,3600000);
 assert.equal(read('SELECT salary FROM web_contracts WHERE player_id=?',[7])?.salary,235000);
 assert.equal(read('SELECT end_day FROM web_contracts WHERE player_id=?',[7])?.end_day,180);
 assert.equal(read('SELECT state FROM web_negotiations WHERE id=?',['offer-1'])?.state,'signed');
 db.close();
});
test('aceite expirado ou sem caixa não muda elenco nem saldo',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(schema+contractSchema+negotiationSchema);
 db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',1)");
 const run=(sql:string,bind:(string|number)[])=>{db.prepare(sql).run(...bind);};
 const read=(sql:string,bind:(string|number)[])=>db.prepare(sql).get(...bind);
 submitOffer(run,read,'a','offer-1',player,fair);
 run('UPDATE careers SET day=9 WHERE id=?',['a']);
 assert.throws(()=>confirmOffer(run,read,'a','offer-1',player,false),/expirou/);
 submitOffer(run,read,'a','offer-2',player,fair);
 hire(run,read,'a',{...player,id:8,overall:55});
 assert.throws(()=>confirmOffer(run,read,'a','offer-2',player,false),/Saldo insuficiente/);
 assert.equal(read('SELECT COUNT(*) AS n FROM web_contracts',[])?.n,1);
 assert.equal(read('SELECT state FROM web_negotiations WHERE id=?',['offer-2'])?.state,'accepted');
 db.close();
});

test('falha após a contraproposta aceita reverte contrato, caixa e estado da negociação',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(schema+contractSchema+negotiationSchema);
 db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',1)");
 const run=(sql:string,bind:(string|number)[])=>{db.prepare(sql).run(...bind);};
 const read=(sql:string,bind:(string|number)[])=>db.prepare(sql).get(...bind);
 assert.equal(submitOffer(run,read,'a','counter-1',player,{...fair,bonus:1000000,salary:190000}),'counter');
 assert.throws(()=>confirmOffer(run,read,'a','counter-1',player,false,()=>{throw Error('interrompido');}),/interrompido/);
 assert.equal(read('SELECT COUNT(*) AS n FROM web_contracts',[])?.n,0);
 assert.equal(read('SELECT balance FROM careers WHERE id=?',['a'])?.balance,5000000);
 assert.equal(read('SELECT state FROM web_negotiations WHERE id=?',['counter-1'])?.state,'counter');
 confirmOffer(run,read,'a','counter-1',player,false);
 assert.equal(read('SELECT salary FROM web_contracts WHERE player_id=?',[7])?.salary,220000);
 assert.equal(read('SELECT balance FROM careers WHERE id=?',['a'])?.balance,3650000);
 db.close();
});
