import {useState,type CSSProperties} from 'react';
import {defaultIdentity,maxPngBytes,patterns,pngDimensions,shapes,type Identity} from '../game-core/identity';
import {SymbolArt,SymbolLibrary} from './SymbolLibrary';

export function Emblem({identity,code}:{identity:Identity;code:string}){
  const [broken,setBroken]=useState('');
  const text=identity.text||code||'UEM';
  const transform=`translate(${identity.offsetX??0}%,${identity.offsetY??0}%) scale(${(identity.scale??100)/100})`;
  return <div className={'club-emblem shape-'+identity.shape} style={{'--emblem-main':identity.primary,'--emblem-back':identity.secondary,'--emblem-ink':identity.detail,'--emblem-border':(identity.border??4)+'px'} as CSSProperties}>
    <div className={'emblem-face pattern-'+identity.pattern}/>
    <div className="emblem-symbol" style={{transform}}>
      {identity.png&&identity.png!==broken?<img className="uploaded-emblem" src={'data:image/png;base64,'+identity.png} alt="Escudo importado" onError={()=>setBroken(identity.png)}/>:<SymbolArt id={identity.symbol} tint={identity.tint?identity.detail:undefined}/>}
    </div>
    <strong style={{fontFamily:identity.font??'Barlow'}}>{text}</strong>
  </div>;
}

export function IdentityEditor({value,onChange,code}:{value:Identity;onChange:(identity:Identity)=>void;code:string}){
  const [tab,setTab]=useState('Composição');
  const [light,setLight]=useState(false);
  const [error,setError]=useState('');
  const [reading,setReading]=useState(false);
  const update=(change:Partial<Identity>)=>onChange({...value,...change});
  const importImage=async(file:File)=>{
    setError('');
    setReading(true);
    try{
      if(file.size>maxPngBytes)throw Error('O PNG deve ter até 4 MB.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      const dimensions=pngDimensions(bytes);
      const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
      const valid=bitmap.width===dimensions.width&&bitmap.height===dimensions.height;
      bitmap.close();
      if(!valid)throw Error('PNG inválido.');
      const encoded=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result).split(',')[1]);
        reader.onerror=()=>reject(Error('Não foi possível ler o PNG.'));
        reader.readAsDataURL(file);
      });
      update({png:encoded});
    }catch(reason){setError(reason instanceof Error?reason.message:'PNG inválido.');}
    finally{setReading(false);}
  };
  return <div className="identity-editor identity">
    <div className={'identity-preview'+(light?' light-preview':'')}>
      <Emblem identity={value} code={code}/>
      <div className="compact-emblem"><Emblem identity={value} code={code}/></div>
      <button onClick={()=>setLight(!light)}>{light?'Fundo escuro':'Fundo claro'}</button>
    </div>
    <div className="identity-controls">
      <div className="symbol-categories">{['Composição','Símbolos','Texto e arquivos'].map(name=><button key={name} aria-pressed={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</div>
      {tab==='Composição'&&<>
        <fieldset><legend>Formato e moldura</legend><div className="symbol-categories">
          {Object.entries(shapes).map(([id,label])=><button key={id} aria-pressed={value.shape===id} onClick={()=>update({shape:id as Identity['shape']})}>{label}</button>)}
        </div><label>Espessura da borda<input type="range" min={0} max={12} value={value.border??4} onChange={event=>update({border:Number(event.target.value)})}/></label></fieldset>
        <fieldset><legend>Cores</legend><div className="identity-colors">
          {(['primary','secondary','detail'] as const).map((key,index)=><label key={key}>{['Principal','Secundária','Detalhes'][index]}
            <input type="color" value={value[key]} onChange={event=>update({[key]:event.target.value})}/>
          </label>)}
        </div><div className="symbol-categories">{[['Titã','#c72e42','animals_wolf','modern_shield'],['Horizonte','#15bfff','sports_wings','circle'],['Vértice','#8b3dff','monogram_v','free_monogram']].map(([name,color,symbol,shape])=>
          <button key={name} onClick={()=>update({primary:color,symbol,shape:shape as Identity['shape'],secondary:'#151b2b',detail:'#ffffff',png:''})}>{name}</button>)}</div></fieldset>
        <fieldset><legend>Padrão</legend><div className="symbol-categories">{Object.entries(patterns).map(([id,label])=><button key={id} aria-pressed={value.pattern===id} onClick={()=>update({pattern:id as Identity['pattern']})}>{label}</button>)}</div></fieldset>
      </>}
      {tab==='Símbolos'&&<>
        <SymbolLibrary value={value.symbol} onChange={symbol=>update({symbol,png:''})}/>
        <div className="identity-colors">
          {([['scale','Tamanho',60,130,100],['offsetX','Posição horizontal',-25,25,0],['offsetY','Posição vertical',-25,25,0]] as const).map(([key,label,min,max,fallback])=>
            <label key={key}>{label}<input type="range" min={min} max={max} value={value[key]??fallback} onChange={event=>update({[key]:Number(event.target.value)})}/></label>)}
          <label>Usar cor dos detalhes no símbolo<input type="checkbox" checked={value.tint??false} disabled={Boolean(value.png)} onChange={event=>update({tint:event.target.checked})}/></label>
        </div>
      </>}
      {tab==='Texto e arquivos'&&<>
        <label>Texto do escudo<input maxLength={24} placeholder={code} value={value.text} onChange={event=>update({text:event.target.value})}/></label>
        <label>Tipografia<select value={value.font??'Barlow'} onChange={event=>update({font:event.target.value as Identity['font']})}>
          <option>Barlow</option><option>Arial</option><option>Georgia</option>
        </select></label>
        <label>Importar escudo PNG<input type="file" accept=".png,image/png" disabled={reading} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void importImage(file);}}/></label>
        {reading&&<p role="status">Validando PNG…</p>}
        {error&&<p role="alert">{error}</p>}
        {value.png&&<button onClick={()=>update({png:''})}>Remover PNG</button>}
        <button onClick={()=>onChange({...defaultIdentity})}>Restaurar composição inicial</button>
      </>}
    </div>
  </div>;
}
