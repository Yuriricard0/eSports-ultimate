import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {schema} from '../src/game-core/career.ts';
import {contractSchema,hire} from '../src/game-core/recruitment.ts';
import {migrateCalendar} from '../src/game-core/calendar.ts';
import {phaseOneSchema} from '../src/game-core/identity.ts';
import {workerHarness} from './helpers/worker-harness.ts';
import {definitions} from '../src/game-core/attributes.ts';
import {migrateZeroSigningBonus} from '../src/game-core/contract-migration.ts';

test('importa contrato Godot sem luvas e preserva a carreira web anterior na migração',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'uem-godot-alpha-')),sourcePath=join(dir,'original.sqlite'),path=join(dir,'web.sqlite');
 const source=new DatabaseSync(sourcePath),db=new DatabaseSync(path);
 try{
   source.exec(`PRAGMA user_version=15;
     CREATE TABLE career(id INTEGER,organization TEXT,abbreviation TEXT,country TEXT,modality TEXT,difficulty TEXT,balance INTEGER,day INTEGER,color TEXT);
     CREATE TABLE career_settings(id INTEGER,organization_id INTEGER);
     CREATE TABLE organization_identities(organization_id INTEGER,shape_id TEXT,symbol_id TEXT,secondary_color TEXT,detail_color TEXT,display_text TEXT,pattern_id TEXT,custom_png BLOB);
     CREATE TABLE teams(id INTEGER,organization_id INTEGER,discipline_id TEXT);
     CREATE TABLE players(id INTEGER,nickname TEXT,name TEXT,country_id TEXT,birth_day INTEGER,role_id TEXT);
     CREATE TABLE roster_memberships(player_id INTEGER,team_id INTEGER,end_day INTEGER);
     CREATE TABLE team_lineups(player_id INTEGER,team_id INTEGER,role_id TEXT);
     CREATE TABLE player_attributes(player_id INTEGER,attribute_id TEXT,value REAL);
     CREATE TABLE player_assessments(id INTEGER,player_id INTEGER,observer_organization_id INTEGER,assessed_day INTEGER,potential_low REAL,potential_high REAL);
     CREATE TABLE player_history(id INTEGER,player_id INTEGER,day INTEGER,description TEXT);
     CREATE TABLE player_contracts(player_id INTEGER,organization_id INTEGER,start_day INTEGER,end_day INTEGER,salary_cents INTEGER,signing_bonus_cents INTEGER,status TEXT);
     INSERT INTO career VALUES(1,'Alpha Godot','AGD','Brasil','MOBA','Normal',250000,1,'#ef123b');
     INSERT INTO career_settings VALUES(1,8);
     INSERT INTO organization_identities VALUES(8,'modern_shield','animals_wolf','#090a12','#ffffff','','none',NULL);
     INSERT INTO teams VALUES(1,8,'MOBA');
     INSERT INTO players VALUES(42,'Zero','Zero Silva','BR',-7000,'top');
     INSERT INTO roster_memberships VALUES(42,1,NULL);INSERT INTO team_lineups VALUES(42,1,'top');
     INSERT INTO player_contracts VALUES(42,8,1,365,700000,0,'active');`);
   for(const key of definitions.MOBA)source.prepare('INSERT INTO player_attributes VALUES(?,?,?)').run(42,'moba_'+key,50);
   const originalBytes=new Uint8Array(readFileSync(sourcePath));
   db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql.replace('bonus>=0','bonus>0')),1);db.exec(phaseOneSchema+'PRAGMA user_version=9;');
   db.exec("INSERT INTO careers VALUES('old','Old','OLD','BR','MOBA','Normal',25000000,'#ef123b','animals_wolf','2026',1)");
   hire((sql,bind)=>{db.prepare(sql).run(...bind);},(sql,bind)=>db.prepare(sql).get(...bind),'old',{id:7,mode:'MOBA',role:'top',overall:45,organization:null});
   const balance=db.prepare('SELECT balance FROM careers WHERE id=?').get('old')!.balance;
   const signedAmount=db.prepare('SELECT amount FROM web_finances WHERE career_id=?').get('old')!.amount;
   const catalog=JSON.parse(readFileSync('public/data/real_teams_2026.json','utf8'));
   const request=workerHarness(db,catalog,{filePath:path,scratchDirectory:dir});
   const imported=await request('import',{bytes:originalBytes.buffer,kind:'godot'});
   assert.equal(imported.length,2);const career=imported.find((c:any)=>c.id!=='old');
   const contract=(await request('contracts',career.id))[0];assert.equal(contract.salary,700000);assert.equal(contract.bonus,0);
   assert.equal((await request('contracts','old')).length,1);assert.equal(db.prepare('SELECT balance FROM careers WHERE id=?').get('old')!.balance,balance);
   assert.equal(db.prepare('SELECT amount FROM web_finances WHERE career_id=?').get('old')!.amount,signedAmount);
   assert.deepEqual(new Uint8Array(await request('godot-source',career.id)),originalBytes);
   assert.deepEqual(new Uint8Array(readFileSync(sourcePath)),originalBytes);
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{source.close();db.close();if(!resolve(dir).startsWith(resolve(tmpdir(),'uem-godot-alpha-')))throw Error('Diretório temporário inesperado.');rmSync(dir,{recursive:true,force:true});}
});

test('falha durante migração de contratos desfaz tabelas e preserva os lançamentos',()=>{
 const db=new DatabaseSync(':memory:');
 try{
   db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql.replace('bonus>=0','bonus>0')),1);
   db.exec("INSERT INTO careers VALUES('old','Old','OLD','BR','MOBA','Normal',25000000,'#ef123b','animals_wolf','2026',1)");
   hire((sql,bind)=>{db.prepare(sql).run(...bind);},(sql,bind)=>db.prepare(sql).get(...bind),'old',{id:7,mode:'MOBA',role:'top',overall:45,organization:null});
   const original=db.prepare("SELECT sql FROM sqlite_schema WHERE name='web_contracts'").get()!.sql;
   const amount=db.prepare('SELECT amount FROM web_finances').get()!.amount;
   assert.throws(()=>migrateZeroSigningBonus(sql=>{db.exec(sql);if(sql.includes('INSERT INTO web_contracts SELECT'))throw Error('falha induzida');}),/induzida/);
   assert.equal(db.prepare("SELECT sql FROM sqlite_schema WHERE name='web_contracts'").get()!.sql,original);
   assert.equal(db.prepare('SELECT amount FROM web_finances').get()!.amount,amount);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM web_current_contracts').get()!.n,1);
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();}
});
