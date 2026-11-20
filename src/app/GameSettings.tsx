import {useState} from 'react';
import {getOfflineStatus,prepareOffline} from './offline';

export function GameSettings(){
  const [contrast,setContrast]=useState(localStorage.getItem('uem:contrast')==='high');
  const [message,setMessage]=useState('');
  const [progress,setProgress]=useState(false);
  return <main className="content">
    <h1>Configurações</h1>
    <section className="panel">
      <h2>Exibição</h2>
      <label className="compare-choice"><input type="checkbox" checked={contrast} onChange={event=>{
        const value=event.target.checked?'high':'default';
        localStorage.setItem('uem:contrast',value);
        document.documentElement.dataset.contrast=value;
        setContrast(event.target.checked);
      }}/> Alto contraste</label>
      {document.fullscreenEnabled&&<button onClick={()=>void (document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(()=>setMessage('Tela cheia indisponível.'))}>Alternar tela cheia</button>}
    </section>
    <section className="panel">
      <h2>Modo offline</h2>
      <p>Baixe os recursos uma vez para abrir o jogo e seus saves neste navegador sem conexão.</p>
      <button className="primary" disabled={progress} onClick={async()=>{
        setProgress(true);
        setMessage('Baixando recursos…');
        try{await prepareOffline();setMessage('Jogo disponível offline neste navegador.');}
        catch(reason){setMessage(reason instanceof Error?reason.message:String(reason));}
        finally{setProgress(false);}
      }}>Preparar modo offline</button>
      <button disabled={progress} onClick={async()=>setMessage(await getOfflineStatus()?'Jogo disponível offline neste navegador.':'O jogo ainda não está preparado para abrir offline.')}>Conferir disponibilidade</button>
      {message&&<p role="status">{message}</p>}
    </section>
  </main>;
}
