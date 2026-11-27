import type {Mode} from '../game-core/attributes';
import type {Career} from '../game-core/career';
import {defaultIdentity} from '../game-core/identity';
import type {Offer} from '../game-core/negotiation';
import type {Contract,Player} from '../game-core/recruitment';
import {reinforcementPreview} from '../game-core/reinforcement-preview';
import {Emblem} from './IdentityEditor';
import {PlayerPortrait} from './PlayerPortrait';
import {roleNames} from './player-labels';
import type {CSSProperties} from 'react';

const money=(value:number)=>'$ '+(value/100).toLocaleString('pt-BR',{maximumFractionDigits:2});
const rating=(value:number)=>value.toLocaleString('pt-BR',{maximumFractionDigits:1});
const modeName=(mode:string)=>mode==='FPS'?'CS2':mode;
const valueOrUnavailable=(value:number|null)=>value===null?'Indisponível':rating(value);
const regions=new Intl.DisplayNames(['pt-BR'],{type:'region'});

export function ReinforcementPreview({career,players,contracts,player,offer}:{
 career:Career;players:Player[];contracts:Contract[];player:Player;offer:Offer;
}){
 const result=reinforcementPreview(career.mode as Mode,career.day,players,contracts,player,offer);
 if(!result)return null;
 const delta=result.currentOverall===null||result.projectedOverall===null?null:result.projectedOverall-result.currentOverall;
 return <details className="reinforcement-preview">
   <summary>Simular reforço · {modeName(player.mode)}</summary>
   <div className="reinforcement-lineups">
     <section aria-label="Elenco atual">
       <h3>Elenco atual</h3>
       <strong>{valueOrUnavailable(result.currentOverall)}</strong>
       <small>Overall coletivo · {result.currentSlots}/{result.totalSlots} funções</small>
       <ReinforcementPlayer player={result.incumbent} role={player.role}/>
     </section>
     <section aria-label="Com o reforço">
       <h3>Com o reforço</h3>
       <strong>{valueOrUnavailable(result.projectedOverall)}</strong>
       <small>Overall coletivo estimado · {result.projectedSlots}/{result.totalSlots} funções</small>
       <ReinforcementPlayer player={player} role={player.role}/>
     </section>
   </div>
   <dl className="reinforcement-impact">
     <div><dt>Variação do Overall</dt><dd>{delta===null?'Indisponível':(delta>0?'+':'')+rating(delta)}</dd></div>
     <div><dt>Entrosamento atual → estimado</dt><dd>{valueOrUnavailable(result.currentChemistry)} → {valueOrUnavailable(result.projectedChemistry)}</dd></div>
     <div><dt>Folha a cada 30 dias</dt><dd>{money(result.currentPayroll)} → {money(result.projectedPayroll)} (+{money(offer.salary)})</dd></div>
     <div><dt>Taxa de transferência</dt><dd>{money(result.fee)}</dd></div>
     <div><dt>Pagamento imediato e caixa restante</dt><dd>{money(result.cost.immediate)} · {money(career.balance-result.cost.immediate)}</dd></div>
     <div><dt>Custo total estimado do contrato</dt><dd>{money(result.cost.total)}</dd></div>
   </dl>
   <p className="muted">Prévia para a função {roleNames[player.role]??player.role}. O entrosamento parte de zero dias juntos com o reforço. A folha inclui o atleta que iria para a reserva.</p>
 </details>;
}

function ReinforcementPlayer({player,role}:{player?:Player;role:string}){
 return <div className="reinforcement-athlete">
   {player&&<PlayerPortrait index={player.portraitIndex}/>}
   <div><b>{player?.nickname??'Vaga em aberto'}</b><small>{roleNames[role]??role}{player?' · OVR '+rating(player.overall):''}</small></div>
 </div>;
}

export function SigningPresentation({career,player,onClose}:{career:Career;player:Player;onClose:()=>void}){
 const identity=career.identity??{...defaultIdentity,primary:career.color,symbol:career.symbol};
 const country=/^[A-Z]{2}$/.test(player.country)?regions.of(player.country)??player.country:player.country;
 return <section className="signing-presentation" aria-label="Apresentação do reforço"
   style={{'--signing-primary':identity.primary,'--signing-secondary':identity.secondary} as CSSProperties}>
   <div className="signing-portrait"><PlayerPortrait index={player.portraitIndex}/>
     {career.uniforms?.home&&<Jersey uniform={career.uniforms.home} identity={identity} code={career.code}/>}
   </div>
   <div className="signing-copy">
     <div className="signing-club"><Emblem identity={identity} code={career.code}/><strong>{career.name}</strong></div>
     <h2>{player.nickname}</h2>
     <p>{country} · {roleNames[player.role]??player.role} · {modeName(player.mode)} · OVR {rating(player.overall)}</p>
     <button onClick={onClose}>Continuar para o mercado</button>
   </div>
 </section>;
}
import {Jersey} from './UniformEditor';
