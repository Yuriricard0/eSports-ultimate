export type SaveStatus='Salvando…'|'Salvo'|'Erro ao salvar';
let current:SaveStatus|undefined;
let pending=0;
let failed=false;
const listeners=new Set<(status:SaveStatus|undefined)=>void>();

export function observeSaveStatus(listener:(status:SaveStatus|undefined)=>void){
 listeners.add(listener);
 listener(current);
 return ()=>{listeners.delete(listener);};
}

function publish(status:SaveStatus){
 current=status;
 for(const listener of listeners)listener(status);
}

export async function trackSave<T>(operation:()=>Promise<T>):Promise<T>{
 if(pending++===0){failed=false;publish('Salvando…');}
 try{return await operation();}
 catch(error){failed=true;throw error;}
 finally{if(--pending===0)publish(failed?'Erro ao salvar':'Salvo');}
}
