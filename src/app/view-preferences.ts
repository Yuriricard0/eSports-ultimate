import {useState} from 'react';

const preferences=new Map<string,unknown>();

// Entries live for the current app session and are isolated by career and screen.
export function useViewPreference<T>(key:string,initial:T){
 const [value,setValue]=useState<T>(()=>preferences.has(key)?preferences.get(key) as T:initial);
 function update(next:T){
   preferences.set(key,next);
   setValue(next);
 }
 return [value,update] as const;
}
