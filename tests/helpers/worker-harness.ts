import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

type HarnessOptions={players?:unknown;filePath?:string;scratchDirectory?:string;seed?:number;observe?:(action:string,milliseconds:number)=>void};
export function workerHarness(db:DatabaseSync,catalog:unknown,options:HarnessOptions={}){
 const adapt=(initial:DatabaseSync)=>{
 let connection=initial,temporaryFile:string|undefined;
 const adapter={
  exec(input:any){if(typeof input==='string')connection.exec(input);else connection.prepare(input.sql).run(...(input.bind??[]));},
  selectObject(sql:string,bind:any[]=[]){return connection.prepare(sql).get(...bind);},
  selectObjects(sql:string,bind:any[]=[]){return connection.prepare(sql).all(...bind);},
  selectValue(sql:string,bind:any[]=[]){const row=connection.prepare(sql).get(...bind);return row&&Object.values(row)[0];},
  transaction(callback:()=>void){connection.exec('BEGIN IMMEDIATE');try{callback();connection.exec('COMMIT');}catch(error){connection.exec('ROLLBACK');throw error;}},
  pointer:null as any,
  deserialize(bytes:Uint8Array){
    if(!options.scratchDirectory)throw Error('Importação de teste requer diretório temporário.');
    const path=join(options.scratchDirectory,globalThis.crypto.randomUUID()+'.sqlite');
    writeFileSync(path,bytes);connection.close();connection=new DatabaseSync(path,{readOnly:true});temporaryFile=path;
  },
  close(){connection.close();if(temporaryFile)unlinkSync(temporaryFile);},
 };
 adapter.pointer=adapter;return adapter;
 };
 const adapter=adapt(db),buffers=new Map<number,Uint8Array>();let pointer=0;
 const sqlite={
   installOpfsSAHPoolVfs:async()=>({OpfsSAHPoolDb:class {constructor(){return adapter;}},exportFile:async()=>{
     if(!options.filePath)throw Error('Exportação de teste requer arquivo SQLite.');return new Uint8Array(readFileSync(options.filePath));
   }}),
   oo1:{DB:class {constructor(){return adapt(new DatabaseSync(':memory:'));}}},
   wasm:{alloc(size:number){buffers.set(++pointer,new Uint8Array(size));return pointer;},
     heap8u:()=>({set(bytes:Uint8Array,offset:number){buffers.set(offset,bytes.slice());}})},
   capi:{SQLITE_OK:0,SQLITE_DESERIALIZE_FREEONCLOSE:1,SQLITE_DESERIALIZE_READONLY:2,
     sqlite3_deserialize(target:any,_name:string,id:number){target.deserialize(buffers.get(id)!);buffers.delete(id);return 0;}},
 };
 let seq=0;const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
 const self:any={postMessage(data:any){if(!data.id)return;const entry=pending.get(data.id)!;pending.delete(data.id);data.error?entry.reject(Error(data.error)):entry.resolve(data.result);}};
 const require=createRequire(import.meta.url);
 const workerPath=resolve('src/persistence/worker.ts');
 const source=ts.transpileModule(readFileSync(workerPath,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 runInNewContext(source,{
   exports:{},self,crypto:options.seed===undefined?globalThis.crypto:{randomUUID:()=>globalThis.crypto.randomUUID(),getRandomValues:(array:Uint32Array)=>{array.fill(options.seed!);return array;}},Uint8Array,console,
   fetch:async(url:string)=>({ok:true,json:async()=>url.includes('players-v1')?options.players??catalog:catalog}),
   require:(name:string)=>name==='@sqlite.org/sqlite-wasm'?async()=>sqlite:require(resolve('src/persistence',name)+'.ts'),
 });
 return (action:string,input?:unknown)=>{
   const start=performance.now();return new Promise<any>((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});self.onmessage({data:{id,action,input}});})
     .finally(()=>options.observe?.(action,performance.now()-start));
 };
}

