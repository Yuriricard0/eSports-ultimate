import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { schema } from '../src/game-core/career.ts';
import { contractSchema, hire, terms,selectStarter } from '../src/game-core/recruitment.ts';
import {phaseOneSchema} from '../src/game-core/identity.ts';
import { deleteCareer } from '../src/game-core/career.ts';

test('excluir uma carreira remove seus contratos e lançamentos sem afetar as demais', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(schema + contractSchema);
  const run = (sql:string, values:(string|number)[]) => { db.prepare(sql).run(...values); };
  const read = (sql:string, values:(string|number)[]) => db.prepare(sql).get(...values);
  for (const id of ['a', 'b']) {
    run("INSERT INTO careers VALUES(?,'Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',1)",[id]);
    hire(run,read,id,{id:1,mode:'MOBA',role:'top',organization:null,overall:45});
  }
  deleteCareer(run,'a');
  assert.deepEqual(db.prepare('SELECT id FROM careers ORDER BY id').all().map(row=>row.id),['b']);
  for (const table of ['web_contracts','web_finances']) {
    assert.deepEqual(db.prepare('SELECT career_id FROM '+table).all().map(row=>row.career_id),['b']);
  }
  db.close();
});

test('contratação persiste custos e impede duplicatas e saldo negativo', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(schema + contractSchema);
  db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',1)");
  const run = (sql:string, values:(string|number)[]) => { db.prepare(sql).run(...values); };
  const read = (sql:string, values:(string|number)[]) => db.prepare(sql).get(...values);
  const player = {id:1,mode:'MOBA',role:'top',organization:null,overall:45};
  assert.deepEqual(terms(45),{bonus:1350000, salary:220000, days:365});
  hire(run,read,'a',player);
  assert.throws(() => hire(run,read,'a',player), /já tem contrato/);
  assert.throws(() => hire(run,read,'a',{...player,id:2,overall:75}), /insuficiente/);
  assert.throws(() => hire(run,read,'a',{...player,id:3,organization:'t1'}), /indisponível/);
  assert.throws(() => hire(run,read,'a',{...player,id:4,mode:'FPS'}), /modalidade/);
  assert.equal(read("SELECT balance FROM careers WHERE id=?",['a'])?.balance,3650000);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM web_contracts').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM web_finances').get().n,1);
  db.close();
});

test('promover reserva troca um titular e preserva a escalação ao rejeitar atleta inválido',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(schema+contractSchema+phaseOneSchema);
  db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',1)");
  const run=(sql:string,bind:(string|number)[])=>{db.prepare(sql).run(...bind);};
  const read=(sql:string,bind:(string|number)[])=>db.prepare(sql).get(...bind);
  for(const id of [1,2])hire(run,read,'a',{id,mode:'MOBA',role:'top',organization:null,overall:45});
  selectStarter(run,read,'a',2);
  assert.throws(()=>selectStarter(run,read,'a',101),/contrato ativo/);
  assert.deepEqual(db.prepare('SELECT player_id FROM web_contracts WHERE starter=1').all().map(row=>row.player_id),[2]);
  db.close();
});
