import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import {formatCareerDay} from '../game-core/calendar';
import {defaultTravelPolicy,operationsAreas,travelStandards,type OperationsArea,type TravelPolicy,type Trip} from '../game-core/operations';
import {bookTravel,getTravelState,saveTravelPolicy,type TravelState} from '../persistence/repository';
import {money} from './Players';

const suggestions:Record<OperationsArea,{screen:string;label:string}>={
 training:{screen:'training',label:'Ver planejamento semanal'},lineup:{screen:'roster',label:'Ver cobertura e reservas'},
 scouting:{screen:'ranked:scouting',label:'Ver atletas acompanhados'},market:{screen:'market',label:'Revisar propostas e vencimentos'},
 equipment:{screen:'shop',label:'Revisar inventário e setups'},
};

export function CareerOperations({career,onUpdated,navigate}:{career:Career;onUpdated:(career:Career)=>Promise<void>;navigate:(screen:string)=>void}){
 const [state,setState]=useState<TravelState|null>(null),[draft,setDraft]=useState<TravelPolicy>(()=>defaultTravelPolicy(career.mode));
 const [budget,setBudget]=useState('0');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
   let active=true;
   getTravelState(career.id).then(value=>{if(active){setState(value);setDraft(value.policy);setBudget(String(value.policy.budget/100));}})
     .catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[career.id,career.day]);
 const submit=async(action:()=>Promise<void>,message:string)=>{
   if(busy)return;
   setBusy(true);setError('');setNotice('');
   try{await action();setState(await getTravelState(career.id));setNotice(message);}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
   finally{setBusy(false);}
 };
 const quote=(trip:Trip)=><li key={trip.fixtureId+trip.standard}>
   <strong>{trip.edition} · {trip.standard}</strong> · {trip.destination} · {trip.travelers} atletas
   <p>Saída em {formatCareerDay(trip.departure)} · Chegada em {formatCareerDay(trip.arrival)} · Série em {formatCareerDay(trip.matchDay)}</p>
   <p>Transporte {money(trip.transport)} · Hospedagem {money(trip.lodging)} · Alimentação {money(trip.meals)} · Fadiga +{trip.fatigue}</p>
   <button disabled={busy||trip.total>(state?.balance??0)} onClick={()=>{
     if(window.confirm(`Reservar a viagem por ${money(trip.total)}? O valor será debitado agora.`))
       void submit(async()=>onUpdated(await bookTravel(career.id,trip)),'Viagem confirmada.');
   }}>Reservar por {money(trip.total)}</button>
 </li>;
 return <section>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   {!state&&!error&&<p role="status">Consultando operações…</p>}
   {state&&<>
     <form onSubmit={event=>{event.preventDefault();void submit(async()=>{
       setDraft(await saveTravelPolicy(career.id,{...draft,budget:Math.round(Number(budget)*100)}));
     },'Permissões atualizadas.');}}>
       <label>Viagens · {career.mode==='FPS'?'CS2':'MOBA'}<select value={draft.mode} onChange={event=>setDraft({...draft,mode:event.target.value as TravelPolicy['mode']})}>
         <option value="manual">Manual</option><option value="recommend">Recomendação</option><option value="automatic" disabled={!state.logisticsReady}>Automático</option>
       </select></label>
       <label>Padrão preferido<select value={draft.standard} onChange={event=>setDraft({...draft,standard:event.target.value as Trip['standard']})}>
         {travelStandards.map(standard=><option key={standard}>{standard}</option>)}
       </select></label>
       {draft.mode==='automatic'&&<label>Limite automático por ciclo de 30 dias ($)<input type="number" min="0.01" max="10000000" step="0.01" required value={budget} onChange={event=>setBudget(event.target.value)}/></label>}
       <p className="muted">Automação de viagens exige centro de treinamento nível 1 e reserva o valor de um ciclo de folha. Selecione Manual para interromper novas reservas automáticas.</p>
       <fieldset><legend>Recomendações nas demais áreas</legend>
         {(Object.keys(operationsAreas) as OperationsArea[]).map(area=><label className="compare-choice" key={area}>
           <input type="checkbox" checked={!!draft.recommend?.[area]} onChange={event=>setDraft({...draft,recommend:{...draft.recommend,[area]:event.target.checked}})}/>{operationsAreas[area]}
         </label>)}
       </fieldset>
       <button type="submit" disabled={busy}>Salvar permissões</button>
     </form>
     <ul>{(Object.keys(operationsAreas) as OperationsArea[]).filter(area=>state.policy.recommend?.[area]).map(area=><li key={area}>
       <strong>{operationsAreas[area]}</strong> · {state.recommendations[area]} <button onClick={()=>navigate(suggestions[area].screen)}>{suggestions[area].label}</button>
     </li>)}</ul>
     <h4>Próximas viagens elegíveis</h4>
     <p className="muted">Orçamentos fictícios do jogo. Só aparecem eventos marcados como presenciais e com datas livres no calendário.</p>
     {!state.options.length?<p>Nenhuma viagem disponível.</p>:<ul>{[...state.options].sort((a,b)=>a.matchDay-b.matchDay||
       (state.policy.mode==='manual'?0:Number(b.standard===state.policy.standard)-Number(a.standard===state.policy.standard))||a.total-b.total).slice(0,12).map(quote)}</ul>}
     {!!state.bookings.length&&<details><summary>Histórico de reservas e decisões automáticas</summary><ul>{state.bookings.map(trip=><li key={trip.fixtureId}>
       {formatCareerDay(trip.bookedDay)} · {trip.edition} · {trip.standard} · {money(trip.total)} · {trip.automatic?'Automática':'Manual'}
       <p>Saída {formatCareerDay(trip.departure)} · chegada {formatCareerDay(trip.arrival)} · série {formatCareerDay(trip.matchDay)}</p>
     </li>)}</ul></details>}
   </>}
 </section>;
}
