/** Allocation may grow WASM memory and detach every previous heap view. */
export function allocateSqliteBytes(wasm:{alloc:(size:number)=>number;heap8u:()=>Uint8Array},bytes:Uint8Array){
 const pointer=wasm.alloc(bytes.byteLength||1);
 wasm.heap8u().set(bytes,pointer);
 return pointer;
}
