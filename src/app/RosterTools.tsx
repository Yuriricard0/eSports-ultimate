import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Player,Contract} from '../game-core/recruitment';
import {rosterDepth} from '../game-core/roster-depth';
import type {FavoriteLineup} from '../game-core/lineup-favorites';
import {createFavoriteLineup,listFavoriteLineups,updateFavoriteLineup} from '../persistence/repository';

export function RosterTools({career,players,contracts,roleNames,attributeLabels,onUpdated}:{
 career:Career;players:Player[];contracts:Contract[];roleNames:Record<string,string>;attributeLabels:Record<string,string>;onUpdated:(career:Career)=>Promise<void>;
}){
 const [depthOpen,setDepthOpen]=useState(false),[favoritesOpen,setFavoritesOpen]=useState(false);
 const [position,setPosition]=useState('');
 const depth=depthOpen?rosterDepth(players,contracts,career.mode==='FPS'?'FPS':'MOBA',career.day):[];
 const selected=depth.find(row=>row.role===position)??depth[0];
 return <section className="panel roster-tools">
   <details onToggle={event=>setDepthOpen(event.currentTarget.open)}><summary>Profundidade do elenco e reservas</summary>
     {depthOpen&&<>
       <p>Somente reservas do elenco principal na função. A cobertura é limitada quando falta titular ou o melhor reserva está mais de 10 pontos abaixo dele.</p>
       <div className="player-table"><table><thead><tr><th>Função</th><th>Titulares</th><th>Reservas</th><th>Melhor reserva</th><th>Cobertura</th></tr></thead><tbody>
         {depth.map(row=><tr key={row.role}><th scope="row">{roleNames[row.role]}</th><td>{row.starters.length}</td><td>{row.reserves.length}</td><td>{row.reserves[0]?.player.nickname??'—'}</td><td>{row.label}</td></tr>)}
       </tbody></table></div>
       <label>Consultar reservas por função<select value={selected.role} onChange={event=>setPosition(event.target.value)}>{depth.map(row=><option key={row.role} value={row.role}>{roleNames[row.role]}</option>)}</select></label>
       <p className="muted">Ranking por Overall da função. Em empate, menor fadiga e maior moral têm prioridade.</p>
       {!selected.reserves.length?<p>Nenhum reserva elegível.</p>:<ul>{selected.reserves.map(({player,rating,condition})=><li key={player.id}>
         <strong>{player.nickname}</strong> · OVR {rating.toFixed(1)} · moral {Math.round(condition.morale)} · fadiga {Math.round(condition.fatigue)}
         <small> · {selected.principal.map(key=>`${attributeLabels[key]??key} ${Math.round(player.attributes[`${player.mode.toLowerCase()}_${key}`])}`).join(' · ')}</small>
       </li>)}</ul>}
     </>}
   </details>
   <details onToggle={event=>setFavoritesOpen(event.currentTarget.open)}><summary>Escalações favoritas</summary>
     {favoritesOpen&&<Favorites career={career} players={players} onUpdated={onUpdated}/>}
   </details>
 </section>;
}

function Favorites({career,players,onUpdated}:{career:Career;players:Player[];onUpdated:(career:Career)=>Promise<void>}){
 const [lineups,setLineups]=useState<FavoriteLineup[]>([]),[name,setName]=useState('');
 const [editing,setEditing]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
   let active=true;
   void listFavoriteLineups(career.id).then(rows=>{if(active)setLineups(rows);}).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[career.id]);
 const names=new Map(players.map(player=>[player.id,player.nickname]));
 const perform=async(action:()=>Promise<unknown>,message:string)=>{
   setBusy(true);setError('');setNotice('');
   try{await action();setLineups(await listFavoriteLineups(career.id));setNotice(message);}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
   finally{setBusy(false);}
 };
 return <>
   <form onSubmit={event=>{
     event.preventDefault();if(busy)return;
     void perform(async()=>{
       if(editing)await updateFavoriteLineup(career.id,editing,'rename',name);
       else await createFavoriteLineup(career.id,name);
       setName('');setEditing(null);
     },editing?'Nome atualizado.':'Escalação atual salva.');
   }}>
     <label>{editing?'Novo nome':'Nome da escalação'}<input maxLength={40} required value={name} onChange={event=>setName(event.target.value)}/></label>
     <button disabled={busy||!name.trim()}>{editing?'Salvar nome':'Salvar titulares atuais'}</button>
     {editing&&<button type="button" onClick={()=>{setEditing(null);setName('');}}>Cancelar</button>}
   </form>
   {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
   {!lineups.length&&<p>Nenhuma escalação favorita.</p>}
   <ul>{lineups.map(lineup=><li key={lineup.id}>
     <strong>{lineup.name}</strong> · {lineup.playerIds.map(id=>names.get(id)??`Atleta ${id}`).join(', ')}{' '}
     <button disabled={busy} onClick={()=>void perform(async()=>{
       await onUpdated(await updateFavoriteLineup(career.id,lineup.id,'apply'));
     },'Escalação aplicada.')}>Aplicar</button>{' '}
     <button disabled={busy} onClick={()=>{setEditing(lineup.id);setName(lineup.name);}}>Renomear</button>{' '}
     <button disabled={busy} onClick={()=>{
       if(window.confirm(`Excluir a escalação favorita ${lineup.name}?`))void perform(async()=>{
         await updateFavoriteLineup(career.id,lineup.id,'delete');
         if(editing===lineup.id){setEditing(null);setName('');}
       },'Escalação excluída.');
     }}>Excluir</button>
   </li>)}</ul>
 </>;
}
