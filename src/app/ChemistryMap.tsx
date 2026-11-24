import type {Player} from '../game-core/recruitment';

type Relationship={left:Player;right:Player;score:number;days:number};
const level=(score:number)=>score>=70?'Forte':score>=45?'Média':'Fraca';
const colors={Forte:'#f35a7c',Média:'#c0a9bd',Fraca:'#727e92'};

export function ChemistryMap({players,relationships}:{players:Player[];relationships:Relationship[]}){
 const nodes=players.map((player,index)=>{
   const angle=index*2*Math.PI/players.length-Math.PI/2;
   return {player,x:180+95*Math.cos(angle),y:123+84*Math.sin(angle)};
 });
 const coordinates=new Map(nodes.map(node=>[node.player.id,node]));
 return <>
   <svg viewBox="0 0 360 248" className="chemistry-map" role="img" aria-label="Mapa de afinidades entre titulares. Os detalhes de cada ligação estão abaixo.">
     {relationships.map(({left,right,score})=>{
       const a=coordinates.get(left.id)!,b=coordinates.get(right.id)!,category=level(score);
       return <line key={`${left.id}:${right.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colors[category]} strokeWidth={category==='Forte'?4:2} strokeDasharray={category==='Fraca'?'5 4':undefined}>
         <title>{left.nickname} × {right.nickname} · {score}% · {category}</title>
       </line>;
     })}
     {nodes.map(({player,x,y})=><g key={player.id}>
       <circle cx={x} cy={y} r={8} fill="#e9effb" stroke="#ef123b" strokeWidth={2}/>
       <text x={x} y={y+23} textAnchor="middle" fill="#e9effb" fontSize="13" paintOrder="stroke" stroke="#12151f" strokeWidth="3">{player.nickname}</text>
     </g>)}
   </svg>
   <p className="muted">Forte a partir de 70%, média de 45% a 69%, fraca abaixo de 45%.</p>
   <ul>{relationships.map(pair=><li key={`${pair.left.id}:${pair.right.id}`}>
     <details><summary>{pair.left.nickname} × {pair.right.nickname} · {pair.score}% · {level(pair.score)}</summary>
       <p>{pair.days} dias desde o início do vínculo mais recente. O cálculo também considera comunicação, coordenação, liderança, estilos de jogo e complementaridade das funções.</p>
     </details>
   </li>)}</ul>
 </>;
}
