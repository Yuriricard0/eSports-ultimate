import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {schema,deleteCareer} from '../src/game-core/career.ts';
import {contractSchema,hire} from '../src/game-core/recruitment.ts';
import {migrateCalendar,advanceCareerDay} from '../src/game-core/calendar.ts';

function fixture(balance=5000000){
  const db=new DatabaseSync(':memory:');
  db.exec(schema+contractSchema);
  const run=(sql:string,values:(string|number)[])=>{db.prepare(sql).run(...values);};
  const read=(sql:string,values:(string|number)[])=>db.prepare(sql).get(...values);
  const all=(sql:string,values:(string|number)[])=>db.prepare(sql).all(...values);
  run("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',?,'#aabbcc','animals_wolf','2026',1)",[balance]);
  const player={id:1,mode:'MOBA',role:'top',organization:null,overall:45};
  hire(run,read,'a',player);
  migrateCalendar(sql=>db.exec(sql),1);
  return {db,run,read,all,player};
}

test('salário é lançado uma vez, contrato vence e atleta pode voltar ao elenco',()=>{
  const {db,run,read,all,player}=fixture(10000000);
  for(let day=1;day<=365;day++)advanceCareerDay(run,read,all,'a',day,1);
  assert.equal(read('SELECT day,balance FROM careers WHERE id=?',['a'])?.day,366);
  assert.throws(()=>advanceCareerDay(run,read,all,'a',365,1),/atualizado/);
  const entries=all('SELECT due_day,amount,paid FROM web_payroll WHERE career_id=? ORDER BY due_day',['a']);
  assert.equal(entries.length,13);
  assert.equal(entries[0].due_day,30);
  assert.equal(entries[0].paid,220000);
  assert.equal(entries[12].amount,36667);
  assert.equal(read('SELECT starter FROM web_contracts WHERE player_id=?',[1])?.starter,0);
  hire(run,read,'a',player);
  assert.equal(all('SELECT * FROM web_contracts WHERE career_id=?',['a']).length,2);
  deleteCareer(run,'a');
  assert.equal(all('SELECT * FROM web_payroll WHERE career_id=?',['a']).length,0);
  db.close();
});

test('folha sem caixa registra pendência sem saldo negativo',()=>{
  const {db,run,read,all,player}=fixture(1400000);
  advanceCareerDay(run,read,all,'a',1,30);
  const entry=read('SELECT amount,paid FROM web_payroll WHERE career_id=?',['a']);
  assert.equal(entry?.amount,220000);
  assert.equal(entry?.paid,50000);
  assert.equal(read('SELECT balance FROM careers WHERE id=?',['a'])?.balance,0);
  assert.throws(()=>hire(run,read,'a',{...player,id:2}),/folha/);
  db.close();
});

test('falha durante avanço reverte salários e data sem perder contratos migrados',()=>{
  const {db,run,read,all}=fixture(10000000);
  const oldSigning=read('SELECT day,amount FROM web_finances WHERE career_id=?',['a']);
  assert.equal(oldSigning?.amount,-1350000);
  assert.equal(oldSigning?.day,1);
  assert.equal(db.prepare('PRAGMA user_version').get()?.user_version,2);
  db.exec("CREATE TRIGGER reject_day BEFORE UPDATE OF day ON careers BEGIN SELECT RAISE(ABORT,'falha simulada'); END");
  assert.throws(()=>advanceCareerDay(run,read,all,'a',1,30),/falha simulada/);
  assert.equal(read('SELECT balance FROM careers WHERE id=?',['a'])?.balance,8650000);
  assert.equal(read('SELECT day FROM careers WHERE id=?',['a'])?.day,1);
  assert.equal(all('SELECT * FROM web_payroll WHERE career_id=?',['a']).length,0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  db.close();
});
