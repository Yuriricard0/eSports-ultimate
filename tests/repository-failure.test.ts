import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

test('falha fatal do Worker rejeita ações pendentes e futuras sem deixá-las travadas',async()=>{
 let worker:any;
 const sourcePath=resolve('src/persistence/repository.ts');
 const source=readFileSync(sourcePath,'utf8').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(sourcePath).href));
 const exports:any={};
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
   exports,URL,console,navigator:{locks:{request:async(_name:unknown,_options:unknown,callback:any)=>callback({})}},
   Worker:class {onmessage:any;onerror:any;postMessage(){}constructor(){worker=this;}},
 });
 await exports.initialize();const pending=exports.listCareers();worker.onerror();
 await assert.rejects(pending,/armazenamento/i);
 const outcome=await Promise.race([exports.listCareers().then(()=> 'resolved',()=> 'rejected'),new Promise(resolve=>setTimeout(()=>resolve('hung'),30))]);
 assert.equal(outcome,'rejected');
});
