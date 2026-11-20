import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {schema} from '../src/game-core/career.ts';
import {contractSchema} from '../src/game-core/recruitment.ts';
import {negotiationSchema} from '../src/game-core/negotiation.ts';
import {migrateCalendar} from '../src/game-core/calendar.ts';
import {defaultIdentity,phaseOneSchema} from '../src/game-core/identity.ts';
import {restoreWebBackup,readGodotCareer} from '../src/game-core/backup.ts';

type Bind=(string|number|Uint8Array|null)[];
function createDatabase(){
  const db=new DatabaseSync(':memory:');
  db.exec(schema+contractSchema);
  migrateCalendar(sql=>db.exec(sql),1);
  db.exec(phaseOneSchema+negotiationSchema+'PRAGMA user_version=3;');
  return {db,all:(sql:string,bind:Bind[]=[])=>db.prepare(sql).all(...bind),
    run:(sql:string,bind:Bind[]=[])=>{db.prepare(sql).run(...bind);}};
}
test('restauração mantém o save atual e duplica identidade e folha com um novo ID',()=>{
  const source=createDatabase(),target=createDatabase();
  const id='career-existing';
  for(const {db} of [source,target]){
    db.exec(`INSERT INTO careers VALUES('${id}','ARES','ARS','BR','MOBA','Normal',25000000,'#ef123b','animals_wolf','2026',43)`);
  }
  source.run('INSERT INTO web_identity VALUES(?,?)',[id,JSON.stringify({...defaultIdentity,shape:'hexagon',text:'ARES'})]);
  source.run('INSERT INTO web_save_names VALUES(?,?)',[id,'Temporada 1']);
  source.run('INSERT INTO web_career_world VALUES(?,?,?,?)',[id,412,1,'[{"id":42}]']);
  source.run('INSERT INTO web_negotiations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    ['offer-one',id,42,43,50,'counter',10000,10000,365,12000,12000,'contraproposta']);
  source.run('INSERT INTO web_imported_players VALUES(?,?,?,?,?)',[id,-42,'{"id":-42,"history":[]}',1,1]);
  source.run('INSERT INTO web_payroll VALUES(?,?,?,?,?,?)',[id,42,1,30,10000,7500]);
  assert.equal(restoreWebBackup(source.all,target.run,()=>'restored'),1);
  assert.equal(target.all('SELECT id FROM careers ORDER BY id').length,2);
  assert.equal(JSON.parse(String(target.all('SELECT config FROM web_identity WHERE career_id=?',['restored'])[0].config)).shape,'hexagon');
  assert.equal(target.all('SELECT paid FROM web_payroll WHERE career_id=?',['restored'])[0].paid,7500);
  assert.equal(target.all('SELECT name FROM web_save_names WHERE career_id=?',['restored'])[0].name,'Temporada 1');
  assert.deepEqual({...target.all('SELECT seed,version,players FROM web_career_world WHERE career_id=?',['restored'])[0]},
    {seed:412,version:1,players:'[{"id":42}]'});
  assert.equal(target.all('SELECT player_id FROM web_imported_players WHERE career_id=?',['restored'])[0].player_id,-42);
  assert.equal(target.all('SELECT counter_salary FROM web_negotiations WHERE career_id=?',['restored'])[0].counter_salary,12000);
  assert.throws(()=>restoreWebBackup(source.all,target.run,()=>id));
  assert.equal(target.all('SELECT id FROM careers').length,2);
  source.db.close();target.db.close();
});

test('conversor Godot passa saldo para centavos e recupera identidade',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA user_version=15;
    CREATE TABLE career(id INTEGER, organization TEXT, abbreviation TEXT, country TEXT, modality TEXT, difficulty TEXT, balance INTEGER, day INTEGER, color TEXT);
    CREATE TABLE career_settings(id INTEGER, organization_id INTEGER);
    CREATE TABLE organization_identities(organization_id INTEGER, shape_id TEXT, symbol_id TEXT, secondary_color TEXT, detail_color TEXT, display_text TEXT, pattern_id TEXT, custom_png BLOB);
    INSERT INTO career VALUES(1,'ARES','ARS','Brasil','MOBA','Normal',123456,31,'#ef123b');
    INSERT INTO career_settings VALUES(1,8);
    INSERT INTO organization_identities VALUES(8,'diamond','sports_trophy','#090a12','#ffffff','ARES','dots',NULL);
  `);
  const result=readGodotCareer((sql,bind=[])=>db.prepare(sql).all(...bind));
  assert.equal(result.balance,12345600);
  assert.equal(result.day,31);
  assert.equal(result.country,'BR');
  assert.equal(result.identity.symbol,'sports_trophy');
  db.close();
});
