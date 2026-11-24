import {useMemo,useState} from 'react';
import {formatCareerDay} from '../game-core/calendar';
import {analyzeRoles,attributeReference,recentTrend} from '../game-core/player-analysis';
import type {Player} from '../game-core/recruitment';

const number=(value:number)=>value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const signed=(value:number)=>(value>0?'+':'')+number(value);

export function PlayerAnalysis({player,players,day,attributeLabels,roleNames}:{
 player:Player;players:Player[];day:number;attributeLabels:Record<string,string>;roleNames:Record<string,string>;
}){
 const [selectedRole,setRole]=useState(player.role);
 const mode=player.mode==='MOBA'||player.mode==='FPS'?player.mode:null;
 const primary=useMemo(()=>mode?analyzeRoles(player.attributes,mode,player.role):null,[player,mode]);
 const analysis=useMemo(()=>selectedRole===player.role?primary:mode?analyzeRoles(player.attributes,mode,selectedRole):null,[player,mode,selectedRole,primary]);
 const reference=useMemo(()=>primary?attributeReference(player,players,primary.attributes.filter(row=>row.weight===4).map(row=>row.id)):null,[player,players,primary]);
 const trend=recentTrend(player.developmentHistory,player.overall,day);
 const name=(key:string)=>attributeLabels[key]??key;
 return <section aria-label="Análise do atleta" className="player-analysis">
   <h3>Evolução recente</h3>
   {trend?<p><strong>{trend.label}</strong> · OVR {number(trend.previous.overall)} → {number(trend.current)} ({signed(trend.change)}) · {trend.days} dias, de {formatCareerDay(trend.previous.day)} a {formatCareerDay(day)}.</p>:
     <p>Histórico insuficiente. A análise precisa de um Overall registrado entre 30 e 90 dias atrás.</p>}
   <details><summary>Como a moral funciona</summary>
     <ul>
       <li>Resultados das partidas disputadas pelo atleta afetam sua moral. Vitórias elevam e derrotas reduzem o indicador.</li>
       <li>Acontecimentos registrados no mundo podem causar pequenas variações. Com o tempo, a moral se aproxima do nível neutro.</li>
       <li>Características individuais podem modificar a resposta aos resultados. O save não guarda a contribuição de cada causa para a moral atual.</li>
     </ul>
   </details>
   {primary&&analysis&&reference?<>
     <h3>Adequação técnica</h3>
     <p>Função principal <strong>{roleNames[player.role]}</strong> · Melhor adequação <strong>{roleNames[primary.roles[0].role]}</strong> · <strong>{primary.versatility}</strong></p>
     <p className="muted">Funções até 2 pontos do melhor Overall: uma indica especialista, duas indicam adaptável e três ou mais indicam versátil.</p>
     <ul>{primary.roles.map(row=><li key={row.role}>{roleNames[row.role]} · OVR {number(row.rating)}</li>)}</ul>
     <h3>Pontos fortes e fracos</h3>
     <p className="muted">Os maiores desvios em relação ao Overall na função principal, dando prioridade aos atributos de maior peso.</p>
     <p><strong>Fortes</strong> · {primary.strengths.map(row=>`${name(row.key)} (${number(row.value)})`).join(', ')||'Nenhum desvio positivo'}</p>
     <p><strong>Fracos</strong> · {primary.weaknesses.map(row=>`${name(row.key)} (${number(row.value)})`).join(', ')||'Nenhum desvio negativo'}</p>
     <details><summary>Pesos e contribuições para o Overall</summary>
       <label>Função analisada<select value={selectedRole} onChange={event=>setRole(event.target.value)}>{primary.roles.map(row=><option key={row.role} value={row.role}>{roleNames[row.role]}</option>)}</select></label>
       <p>Os atributos principais pesam 4 e os demais pesam 1. As contribuições somam <strong>{number(analysis.rating)} pontos de Overall</strong> antes do arredondamento das linhas.</p>
       <div className="player-table"><table><thead><tr><th>Atributo</th><th>Valor</th><th>Peso</th><th>Contribuição (pts)</th></tr></thead><tbody>
         {analysis.attributes.map(row=><tr key={row.id}><th scope="row">{name(row.key)}{row.weight===4?' · Principal':''}</th><td>{number(row.value)}</td><td>{row.weight}</td><td>{number(row.contribution)}</td></tr>)}
       </tbody></table></div>
     </details>
     <details><summary>Comparação com a média da função principal</summary>
       <p className="muted">Referência: outros atletas não aposentados da mesma modalidade e função no catálogo desta carreira, incluindo agentes livres e jogadores da ranked.</p>
       <div className="player-table"><table><thead><tr><th>Atributo principal</th><th>Atleta</th><th>Média da função</th><th>Diferença</th></tr></thead><tbody>
         {primary.attributes.filter(row=>row.weight===4).map(row=>{
           const {average,count}=reference[row.id];
           return <tr key={row.id}><th scope="row">{name(row.key)}</th><td>{number(row.value)}</td><td>{average===null?'—':`${number(average)} (${count})`}</td><td>{average===null?'—':signed(row.value-average)}</td></tr>;
         })}
       </tbody></table></div>
     </details>
   </>:<p className="muted">Atributos insuficientes para calcular a adequação técnica.</p>}
 </section>;
}
