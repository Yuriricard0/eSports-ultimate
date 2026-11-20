import {useEffect,useState} from 'react';
import {formatCareerDay} from '../game-core/calendar';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';
import {listTimeline,type TimelineEntry} from '../persistence/repository';

const names={hired:'Início do contrato',expired:'Fim do contrato',starter:'Promovido a titular',sold:'Vendido',released:'Dispensado',renewed:'Contrato renovado',match:'Partida concluída · resultado na tela Partidas'};
export function CareerTimeline({career,players,contracts}:{career:Career;players:Player[];contracts:Contract[]}){
  const [events,setEvents]=useState<TimelineEntry[]|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    listTimeline(career.id).then(rows=>{if(active)setEvents(rows);}).catch(reason=>{if(active)setError(String(reason));});
    return()=>{active=false;};
  },[career.id,career.day]);
  const roster=new Set([...(events??[]).map(event=>event.player_id),...contracts.map(contract=>contract.player_id)]);
  const nicknames=new Map(players.map(player=>[player.id,player.nickname]));
  const entries=[
    ...(events??[]).map(event=>({day:event.day,text:names[event.kind]+(event.kind==='match'?'':' · '+(nicknames.get(event.player_id)??'Atleta '+event.player_id))})),
    ...players.filter(player=>roster.has(player.id)).flatMap(player=>[
      ...(player.developmentHistory??[]).filter(point=>
        contracts.some(contract=>contract.player_id===player.id&&contract.start_day<=point.day&&contract.end_day>=point.day)||
        (events??[]).some(event=>event.kind==='hired'&&event.player_id===player.id&&event.day<=point.day&&
          !(events??[]).some(end=>['expired','sold','released'].includes(end.kind)&&end.player_id===player.id&&end.day>=event.day&&end.day<=point.day))
      ).map(point=>({day:point.day,text:player.nickname+' · Overall '+point.overall.toLocaleString('pt-BR')})),
      ...(player.perkHistory??[]).map(event=>({day:event.day,text:player.nickname+' · Mudança de traço. Veja o perfil do atleta.'})),
    ]),
  ].sort((a,b)=>b.day-a.day).slice(0,200);
  return <>
    <h1>Linha do tempo</h1>
    {error&&<p role="alert">{error}</p>}
    {!error&&events===null&&<p role="status">Carregando histórico…</p>}
    {events&&<section className="panel">
      {entries.length?<ol className="career-timeline">{entries.map((entry,index)=>
        <li key={entry.day+':'+index}><time>{formatCareerDay(entry.day)}</time> · {entry.text}</li>)}</ol>
        :<p>Ainda não há movimentações de elenco ou desenvolvimento registradas.</p>}
    </section>}
  </>;
}
