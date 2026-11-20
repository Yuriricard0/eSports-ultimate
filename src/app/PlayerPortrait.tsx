export function PlayerPortrait({index}:{index:number}) {
  if(index<0)return <span className="player-portrait empty-portrait" aria-label="Retrato indisponível">—</span>;
  const frame=index%128;
  const page=String(Math.floor(index/128)).padStart(2,'0');
  return <span className="player-portrait" aria-hidden="true" style={{
    backgroundImage:`url(/assets/players/players-${page}.webp)`,
    backgroundPosition:`${frame%16/15*100}% ${Math.floor(frame/16)/7*100}%`,
  }}/>;
}
