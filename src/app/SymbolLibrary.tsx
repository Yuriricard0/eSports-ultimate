import {useState} from 'react';
import {atlasSize,symbols} from '../game-core/symbols';

const categories = {
  all:'Todos',animals:'Animais',sports:'Esportes',elements:'Elementos',abstract:'Abstratos',monogram:'Monogramas',
};
const names:Record<string,string> = {
  wolf:'Lobo',lion:'Leão',panther:'Pantera',tiger:'Tigre',bear:'Urso',eagle:'Águia',falcon:'Falcão',
  owl:'Coruja',fox:'Raposa',snake:'Serpente',dragon:'Dragão',bull:'Touro',rhino:'Rinoceronte',
  deer:'Cervo',shark:'Tubarão',penguin:'Pinguim',butterfly:'Borboleta',panda:'Panda',scorpion:'Escorpião',
  crown:'Coroa',star:'Estrela',trophy:'Troféu',laurel:'Louro',wings:'Asas',flame:'Chama',lightning:'Raio',
  crossed_swords:'Espadas',star_shield:'Escudo estrelado',medal:'Medalha',mountain:'Montanha',
  helmet:'Elmo',hood:'Capuz',skull:'Caveira',crossbones:'Ossos',anchor:'Âncora',chess_knight:'Cavalo',
  tower:'Torre',tree:'Árvore',trident:'Tridente',woven_triangle:'Triângulo entrelaçado',
  geometric_spiral:'Espiral',angular_infinity:'Infinito',diagonal_bars:'Barras',vortex:'Vórtice',
  open_hexagon:'Hexágono aberto',triangle_knot:'Nó triangular',symmetric_columns:'Colunas',
  geometric_wings:'Asas geométricas',angular_cross:'Cruz angular',
};
function nameOf(id:string) {
  const key=id.slice(id.indexOf('_')+1);
  return names[key] ?? key.toUpperCase();
}

export function SymbolArt({id,tint}:{id:string;tint?:string}) {
  const region=symbols[id];
  if(!region&&tint)return <span role="img" aria-label={nameOf(id)} className="symbol-art" style={{
    aspectRatio:1,backgroundColor:tint,mask:`url(/assets/symbols/${id}.png) center/contain no-repeat`,
  }}/>;
  if(!region) return <img className="symbol-art" src={'/assets/symbols/'+id+'.png'} alt={nameOf(id)}/>;
  const [x,y,width,height]=region;
  const size=`${atlasSize[0]/width*100}% ${atlasSize[1]/height*100}%`;
  const position=`${x/(atlasSize[0]-width)*100}% ${y/(atlasSize[1]-height)*100}%`;
  return <span role="img" aria-label={nameOf(id)} className={tint?'symbol-art':'symbol-art sprite'} style={tint
    ?{aspectRatio:width/height,backgroundColor:tint,mask:`url(/assets/symbols/detailed-atlas.png) ${position}/${size} no-repeat`}
    :{aspectRatio:width/height,backgroundSize:size,backgroundPosition:position}}/>;
}

export function SymbolLibrary({value,onChange}:{value:string;onChange:(id:string)=>void}) {
  const [category,setCategory]=useState('all');
  const [query,setQuery]=useState('');
  const normalized=(text:string)=>text.normalize('NFD').replace(/\p{Mark}/gu,'').toLowerCase();
  const items=Object.keys(symbols).filter(id=>query
    ? normalized(nameOf(id)).includes(normalized(query.trim()))
    : category==='all'||id.startsWith(category+'_'));
  return <div className="symbol-library">
    <input aria-label="Buscar símbolo" placeholder="Buscar entre 54 símbolos" value={query} onChange={event=>setQuery(event.target.value)}/>
    {!query&&<div className="symbol-categories" aria-label="Categorias">
      {Object.entries(categories).map(([id,name])=><button key={id} aria-pressed={category===id} onClick={()=>setCategory(id)}>{name}</button>)}
    </div>}
    <div className="symbol-grid">{items.map(id=><button key={id} aria-pressed={id===value} aria-label={nameOf(id)} onClick={()=>onChange(id)}>
      <SymbolArt id={id}/><span>{nameOf(id)}</span>
    </button>)}</div>
    {!items.length&&<p>Nenhum símbolo encontrado.</p>}
  </div>;
}
