import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Isolated component logic test, without DOM/browser. Reuses JSX element objects
// and minimal hook state; external data boundaries are explicitly supplied.
export function appHarness(repository:Record<string,unknown>,players:unknown[]=[],entry='App',props:Record<string,unknown>={},storage=new Map<string,string>()){
 const values:any[]=[],effects=new Map<number,{deps:unknown[];cleanup?:()=>void}>(),components=new Map<string,any>();let cursor=0,queued:(()=>void)[]=[];
 const hooks={
   useState(initial:any){const index=cursor++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;return [values[index],(value:any)=>{values[index]=typeof value==='function'?value(values[index]):value;}];},
   useRef(initial:any){const index=cursor++;if(!(index in values))values[index]={current:initial};return values[index];},
   useEffect(callback:()=>any,deps:unknown[]){const index=cursor++,old=effects.get(index);if(old&&deps.every((value,i)=>Object.is(value,old.deps[i])))return;
     queued.push(()=>{old?.cleanup?.();effects.set(index,{deps,cleanup:callback()});});},
 };
 const req=createRequire(import.meta.url),file=resolve(`src/app/${entry}.tsx`),exports:any={};
 const compile=(path:string)=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const source=compile(file),preferences={};
 runInNewContext(compile(resolve('src/app/view-preferences.ts')),{exports:preferences,require:()=>hooks});
 runInNewContext(source,{exports,console,localStorage:{getItem:(key:string)=>storage.get(key)??null,
   setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)},
   fetch:async(url:string)=>({ok:true,json:async()=>url.includes('players-v1')?players:{organizations:[],teams:[],leagues:[]}}),
   require:(name:string)=>{
     if(name==='react')return hooks;if(name==='react/jsx-runtime')return req(name);
     if(name==='./view-preferences')return preferences;
     if(name==='./player-labels')return req(resolve(dirname(file),name)+'.ts');
     if(name.includes('/persistence/repository'))return repository;
     if(name.startsWith('../game-core/'))return req(resolve(dirname(file),name)+'.ts');
     if(name==='../version')return req(resolve(dirname(file),name)+'.ts');
     return new Proxy({}, {get:(_target,key:string)=>{
       if(key==='money')return (amount:number)=>String(amount);
       if(!components.has(key)){const component=()=>null;Object.assign(component,{displayName:key});components.set(key,component);}return components.get(key);
     }});
   },
 });
 let tree:any;
 const render=()=>{cursor=0;tree=exports[entry](props);const next=queued;queued=[];next.forEach(effect=>effect());return tree;};
 const walk=(node:any):any[]=>Array.isArray(node)?node.flatMap(walk):node&&typeof node==='object'&&node.props?[node,...walk(node.props.children)]:[];
 const text=(node:any):string=>Array.isArray(node)?node.map(text).join(' '):node&&typeof node==='object'?text(node.props?.children):node==null?'':String(node);
 return {render,async flush(){for(let i=0;i<10;i++){await Promise.resolve();render();}},
   remount(){for(const effect of effects.values())effect.cleanup?.();effects.clear();values.length=0;render();},
   control(label:string){const node=walk(tree).find(node=>node.props['aria-label']===label);if(!node)throw Error('Controle ausente: '+label);return node;},
   button(label:string){const node=walk(tree).find(node=>node.type==='button'&&text(node).includes(label));if(!node)throw Error('Botão ausente: '+label);return node;},
   component(name:string){return walk(tree).find(node=>node.type?.displayName===name);},text:()=>text(tree),
 };
}
