import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allocateSqliteBytes} from '../src/persistence/sqlite-bytes.ts';

test('importação copia bytes após crescimento da memória WASM sem usar heap destacado',()=>{
 const memory=new WebAssembly.Memory({initial:1,maximum:4});
 const stale=new Uint8Array(memory.buffer);
 const bytes=Uint8Array.from({length:70000},(_,i)=>i%251);
 const ptr=allocateSqliteBytes({alloc:size=>{assert.equal(size,bytes.length);memory.grow(2);return 16;},heap8u:()=>new Uint8Array(memory.buffer)},bytes);
 assert.equal(stale.byteLength,0);
 assert.deepEqual(new Uint8Array(memory.buffer).slice(ptr,ptr+bytes.length),bytes);
});
