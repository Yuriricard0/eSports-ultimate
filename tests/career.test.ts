import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {careerInput, schema} from '../src/game-core/career.ts';
test('aceita até três letras e valida símbolos de todo o catálogo',()=>{
 const draft={name:'Aurora',code:'aur',country:'BR',mode:'MOBA',difficulty:'Normal',color:'#ef123b',symbol:'sports_trophy'};
 assert.equal(careerInput(draft).code,'AUR');
 for(const code of ['ABCD','A1','A B'])assert.throws(()=>careerInput({...draft,code}));
 assert.throws(()=>careerInput({...draft,symbol:'sports_unknown'}));
});
test('criação valida campos e mantém os capitais aprovados',()=>{
 for(const [difficulty,cents] of [['Fácil',50000000],['Normal',25000000],['Difícil',12500000],['Realista',7500000]] as const){
 assert.equal(careerInput({name:'Aurora',code:'AUR',country:'BR',mode:'MOBA',difficulty,color:'#ef123b',symbol:'animals_wolf'}).balance,cents);
 }
 assert.throws(()=>careerInput({name:' ',mode:'MOBA'}));
 assert.throws(()=>careerInput({name:'Aurora',code:'AUR',country:'BR',mode:'OTHER',difficulty:'Normal',color:'#ef123b',symbol:'animals_wolf'}));
});
test('SQLite mantém carreiras independentes e desfaz transação incompleta',()=>{
 const db=new DatabaseSync(':memory:');db.exec(schema);
 const insert=db.prepare('INSERT INTO careers(id,name,code,country,mode,difficulty,balance,color,symbol,created) VALUES(?,?,?,?,?,?,?,?,?,?)');
 insert.run('a','Aurora','AUR','BR','MOBA','Normal',25000000,'#ef123b','animals_wolf','2026-11-16');
 db.exec('BEGIN');db.prepare('UPDATE careers SET balance=0 WHERE id=?').run('a');db.exec('ROLLBACK');
 assert.equal(db.prepare('SELECT balance FROM careers WHERE id=?').get('a')?.balance,25000000);
 assert.throws(()=>insert.run('a','Outra','OUT','BR','FPS','Normal',25000000,'#ef123b','animals_wolf','2026-11-16'));
 db.close();
});
