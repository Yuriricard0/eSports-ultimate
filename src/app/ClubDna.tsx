import {athleteAge} from '../game-core/development';
import {clubPhilosophy} from '../game-core/team-analysis';
import type {Contract,Player} from '../game-core/recruitment';
import {money} from './Players';

export function ClubDna({players,day,reputation,academy=false,hasAcademy,contracts}:{
 players:Player[];day:number;reputation:number;academy?:boolean;hasAcademy:boolean;contracts?:Contract[];
}){
 const ages=players.map(player=>athleteAge(player.birthDay,day)).filter(age=>Number.isFinite(age)&&age>=0);
 const youth=ages.filter(age=>age<=21).length,veterans=ages.filter(age=>age>=27).length;
 const starters=contracts?.filter(contract=>contract.starter&&!contract.academy&&contract.start_day>0)??[];
 const currentTenure=starters.length?Math.floor(starters.reduce((sum,contract)=>sum+Math.max(0,day-contract.start_day),0)/starters.length):null;
 const paidContracts=contracts?.filter(contract=>contract.salary>0)??[];
 return <details className="club-dna"><summary>DNA competitivo</summary>
   <ul>
     <li><strong>Filosofia no jogo</strong> · {clubPhilosophy(reputation,academy,hasAcademy)} <small>(classificação por reputação e presença de Academy)</small></li>
     {ages.length>0&&<li><strong>Composição atual</strong> · {youth} de {ages.length} com até 21 anos · {veterans} com 27 anos ou mais</li>}
     {hasAcademy&&<li><strong>Formação</strong> · Academy registrada</li>}
     {!!paidContracts.length&&<li><strong>Folha contratada</strong> · {money(paidContracts.reduce((sum,contract)=>sum+contract.salary,0))} a cada 30 dias</li>}
     {currentTenure!==null&&<li><strong>Permanência dos titulares</strong> · média de {currentTenure} dias desde o início do vínculo ({starters.length} com data registrada)</li>}
   </ul>
   {!ages.length&&<p className="muted">Sem elenco disponível para avaliar a composição.</p>}
 </details>;
}
