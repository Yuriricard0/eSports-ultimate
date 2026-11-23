import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {workerHarness} from './helpers/worker-harness.ts';

test('abre e restaura um backup web V1.0 sem metadados de versão',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'uem-save-version-'));
 const filePath=join(directory,'careers.sqlite');
 let db=new DatabaseSync(filePath);
 const catalog=JSON.parse(readFileSync('public/data/real_teams_2026.json','utf8'));
 const connect=()=>workerHarness(db,catalog,{filePath,scratchDirectory:directory});
 try{
   await connect()('list');
   db.exec(`DROP TABLE web_save_versions;
     INSERT INTO careers VALUES('legacy','Antiga','ANT','BR','MOBA','Normal',21500000,'#ef123b','animals_wolf','2026-10-01',38);
     PRAGMA user_version=10;`);
   db.close();
   const bytes=new Uint8Array(readFileSync(filePath));
   db=new DatabaseSync(filePath);
   const request=connect();
   const [original]=await request('list');
   assert.equal(original.createdVersion,null);
   const restored=await request('import',{bytes:bytes.buffer,kind:'web'});
   assert.equal(restored.length,2);
   const copy=restored.find((save:{id:string})=>save.id!=='legacy');
   assert.ok(copy);
   assert.equal(copy.createdVersion,null);
   assert.equal(copy.balance,21500000);
   assert.equal(copy.day,38);
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});
