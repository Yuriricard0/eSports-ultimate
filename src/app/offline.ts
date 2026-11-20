export async function getOfflineStatus(){
  if(!import.meta.env.PROD||!('serviceWorker' in navigator)||!('caches' in window))return false;
  try{
    if(!(await navigator.serviceWorker.getRegistration())?.active)return false;
    return (await caches.keys()).some(key=>key.startsWith('uem-offline-'));
  }catch{return false;}
}

export async function prepareOffline(){
  if(!import.meta.env.PROD)throw Error('O modo offline está disponível na versão compilada.');
  if(!('serviceWorker' in navigator))throw Error('Use HTTPS ou localhost para preparar o modo offline.');
  const registration=await navigator.serviceWorker.register('/offline-worker.js',{updateViaCache:'none'});
  if(registration.active&&await getOfflineStatus())return;
  const installer=registration.installing??registration.waiting;
  if(!installer){if(await getOfflineStatus())return;throw Error('Não foi possível preparar o cache offline.');}
  await new Promise<void>((resolve,reject)=>{
    const worker=installer;
    const onState=()=>{
      if(worker.state==='activated'||worker.state==='installed')finish();
      if(worker.state==='redundant')finish(Error('O download dos recursos offline falhou.'));
    };
    const timer=window.setTimeout(()=>finish(Error('O download demorou demais. Confira a conexão e tente novamente.')),120000);
    function finish(error?:Error){
      window.clearTimeout(timer);
      worker.removeEventListener('statechange',onState);
      error?reject(error):resolve();
    }
    worker.addEventListener('statechange',onState);
    onState();
  });
  await navigator.serviceWorker.ready;
}
