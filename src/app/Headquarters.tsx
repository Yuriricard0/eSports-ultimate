import type {ReactNode} from 'react';
import type {Career} from '../game-core/career';
import {headquartersStage,headquartersStages} from '../game-core/headquarters';
import type {FinanceState} from '../persistence/repository';
import {money} from './Players';

export function Headquarters({career,data,children}:{career:Career;data:FinanceState;children:ReactNode}){
 const level=data.facilities.find(row=>row.kind==='training')?.level??0;
 const stage=headquartersStage(level);
 return <section className="panel headquarters" id="sede">
   <h2>Sede da organização</h2>
   <div className="headquarters-scene">
     <img src={`${import.meta.env.BASE_URL}assets/headquarters/${stage.image}.jpg`} alt={stage.alt} width={764} height={508} loading="lazy" decoding="async"/>
     <div><span>{career.name}</span><h3>{stage.name}</h3><p>Divisão ativa · {career.mode==='FPS'?'CS2':'MOBA'}</p></div>
   </div>
   <ol className="headquarters-stages" aria-label="Evolução da sede">{headquartersStages.map((step,index)=>
     <li key={step.image} aria-current={index===level?'step':undefined} className={index<level?'complete':''}>{step.name}</li>)}</ol>
   <div className="headquarters-summary">
     <div><h3>Ambientes da sede</h3><ul>{stage.rooms.map(room=><li key={room}>{room}</li>)}</ul></div>
     <div><h3>Investimento registrado</h3><strong>{money(data.facilityInvestment??0)}</strong><p>Melhorias de instalações ao longo da carreira.</p></div>
   </div>
   <h3>Melhorias das instalações</h3>
   <p>O nível do centro de treinamento define o estágio visual. Academy e scouting têm níveis próprios.</p>
   {children}
 </section>;
}
