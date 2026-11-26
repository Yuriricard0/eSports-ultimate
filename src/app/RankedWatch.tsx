import {formatCareerDay} from '../game-core/calendar';
import type {RankedObservation} from '../game-core/talent-development';

export function RankedHistory({history,currentPosition}:{history:RankedObservation[];currentPosition?:number}){
 const start=history[0],latest=history.at(-1);
 if(!start||!latest)return <p className="muted">Ainda sem registros na Solo Queue.</p>;
 const rise=start.position-latest.position;
 const previous=history.filter(row=>row.day<=latest.day-7).at(-1);
 const highlight=previous&&previous.position-latest.position>=10;
 const plotted=history.length>12?[start,...history.slice(-11)]:history;
 const scale=Math.max(...plotted.map(row=>row.position));
 return <div className="ranked-history">
   <p>Posição mundial por modalidade · inicial <strong>#{start.position}</strong> · última observação <strong>#{latest.position}</strong>
     {currentPosition!==undefined&&<> · atual <strong>#{currentPosition}</strong></>}
     {history.length>1&&<> · variação {rise===0?'sem mudança':rise>0?`subiu ${rise}`:`caiu ${-rise}`}</>}
   </p>
   {highlight&&<p><strong>Grande subida</strong> · ganhou {previous.position-latest.position} posições entre as duas observações.</p>}
   {history.length===1&&<p className="muted">Aguardando o próximo registro do calendário.</p>}
   <ol aria-label="Histórico observado na Solo Queue">
     {plotted.map(row=><li key={row.day}>
       <time>{formatCareerDay(row.day)}</time><meter min={0} max={scale} value={scale-row.position+1} aria-hidden="true"/>
       <span>#{row.position} · {row.points.toLocaleString('pt-BR')} pts</span>
     </li>)}
   </ol>
   {history.length>12&&<details><summary>Ver todas as observações ({history.length})</summary><ul>
     {history.map(row=><li key={row.day}>{formatCareerDay(row.day)} · #{row.position} · {row.points.toLocaleString('pt-BR')} pts</li>)}
   </ul></details>}
   <p className="muted">O histórico registra a classificação observada. A avaliação profissional também depende de outras evidências.</p>
 </div>;
}
