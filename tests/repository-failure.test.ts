import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import * as saveStatus from '../src/game-core/save-status.ts';

test('falha fatal do Worker rejeita ações pendentes e futuras sem deixá-las travadas',async()=>{
 let worker:any;
 const sourcePath=resolve('src/persistence/repository.ts');
 const source=readFileSync(sourcePath,'utf8').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(sourcePath).href));
 const exports:any={};
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
   exports,URL,console,require:()=>saveStatus,navigator:{locks:{request:async(_name:unknown,_options:unknown,callback:any)=>callback({})}},
   Worker:class {onmessage:any;onerror:any;postMessage(){}constructor(){worker=this;}},
 });
 await exports.initialize();const pending=exports.listCareers();worker.onerror();
 await assert.rejects(pending,/armazenamento/i);
 const outcome=await Promise.race([exports.listCareers().then(()=> 'resolved',()=> 'rejected'),new Promise(resolve=>setTimeout(()=>resolve('hung'),30))]);
 assert.equal(outcome,'rejected');
});

test('indicador espera as gravações simultâneas e sinaliza falhas',async()=>{
 const observed:unknown[]=[];
 const stop=saveStatus.observeSaveStatus(value=>observed.push(value));
 try{
   let finish!:()=>void;
   const first=saveStatus.trackSave(()=>new Promise<void>(resolve=>{finish=resolve;}));
   await assert.rejects(saveStatus.trackSave(async()=>{throw Error('disco');}),/disco/);
   assert.equal(observed.at(-1),'Salvando…');
   finish();await first;
   assert.equal(observed.at(-1),'Erro ao salvar');
   await saveStatus.trackSave(async()=>{});
   assert.equal(observed.at(-1),'Salvo');
 }finally{stop();}
});
