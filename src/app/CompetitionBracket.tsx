import type {Competition} from '../game-core/competitions';
import type {BracketNode} from '../game-core/competition-formats';
import {formatCareerDay} from '../game-core/calendar';
import {Emblem} from './IdentityEditor';

const labels={upper:'Chave superior',lower:'Chave inferior',final:'Grande final',reset:'Série de desempate'};
const cardWidth=200,cardHeight=104,columnWidth=242,rowHeight=116;

export function CompetitionBracket({edition,open}:{edition:Competition;open:(id:string)=>void}){
 const bracket=edition.doubleElimination!;
 const lastWeek=Math.max(...bracket.nodes.map(node=>node.week));
 const columns=new Map<string,{x:number;y:number}>();
 let height=0;
 const headers:{title:string;y:number}[]=[];
 for(const lane of ['upper','lower'] as const){
   const laneNodes=bracket.nodes.filter(node=>node.lane===lane);
   if(!laneNodes.length)continue;
   headers.push({title:labels[lane],y:height});
   const size=Math.max(...laneNodes.map(node=>laneNodes.filter(other=>other.round===node.round).length));
   for(const node of laneNodes){
     const round=laneNodes.filter(other=>other.round===node.round);
     columns.set(node.id,{x:node.week*columnWidth,y:height+36+((round.indexOf(node)+.5)*size/round.length-.5)*rowHeight});
   }
   height+=36+size*rowHeight;
 }
 for(const node of bracket.nodes.filter(node=>node.lane==='final'||node.lane==='reset'))
   columns.set(node.id,{x:node.week*columnWidth,y:Math.max(36,(height-cardHeight)/2)});
 const width=lastWeek*columnWidth+cardWidth;
 const games=new Map(edition.fixtures.map(game=>[game.id,game]));
 const teams=new Map(edition.participants.map(team=>[team.id,team]));
 const title=(node:BracketNode)=>node.lane==='upper'||node.lane==='lower'?labels[node.lane]+' · Rodada '+node.round:labels[node.lane];
 return <section className="panel competition-bracket">
   <h2>Playoffs de eliminação dupla</h2>
   <p>{bracket.rules.grandFinal==='reset'?'A final reinicia se a equipe da chave inferior vencer a primeira série.':'A grande final é disputada em série única.'}</p>
   <p className="muted">Linha contínua para o vencedor da série. Linha tracejada para o perdedor.</p>
   <div className="bracket-scroll" tabIndex={0} aria-label="Chave de playoffs com rolagem horizontal">
     <div className="bracket-board" style={{width,height}}>
       <svg width={width} height={height} className="bracket-links" aria-hidden="true">
         {bracket.nodes.flatMap(node=>node.sources.flatMap(source=>{
           if(!('node' in source))return [];
           const from=columns.get(source.node)!,to=columns.get(node.id)!,x=from.x+cardWidth,y=from.y+cardHeight/2,targetY=to.y+cardHeight/2;
           const mid=x+(to.x-x)/2;
           return [<path key={node.id+source.node+source.result} d={`M${x} ${y} H${mid} V${targetY} H${to.x}`} className={source.result==='loser'?'drop':''}/>];
         }))}
       </svg>
       {headers.map(header=><strong key={header.title} className="bracket-lane" style={{top:header.y}}>{header.title}</strong>)}
       {bracket.nodes.map(node=>{
         const game=games.get(edition.id+':'+node.id),position=columns.get(node.id)!;
         const content=<><small>{title(node)} · MD{node.bestOf}</small>
           {node.sources.map((source,index)=>{
             const team=teams.get(game?(index?game.away:game.home):'team' in source?source.team??'':'');
             const fallback='team' in source?'Bye':source.result==='loser'?'Perdedor da série anterior':'Vencedor da série anterior';
             return <span key={index} className={team&&game?.result?.winner===team.id?'bracket-winner':''}>
               {team&&(team.logo?<img src={team.logo.replace('res://','/')} alt=""/>:team.identity?<Emblem identity={team.identity} code={team.code}/>:<b>{team.code}</b>)}
               <span>{team?.name??fallback}</span>{game?.result&&<b>{game.result.score[index]}</b>}
             </span>;
           })}
           <small>{game?formatCareerDay(game.day):node.lane==='reset'?(edition.champion?'Desempate dispensado':'Se necessário'):'Aguardando classificação'}</small></>;
         const props={className:'bracket-match '+((node.lane==='final'||node.lane==='reset')?'bracket-final':''),style:{left:position.x,top:position.y,width:cardWidth,minHeight:cardHeight}};
         return game?<button key={node.id} {...props} onClick={()=>open(game.id)}>{content}</button>:<div key={node.id} {...props}>{content}</div>;
       })}
     </div>
   </div>
 </section>;
}
