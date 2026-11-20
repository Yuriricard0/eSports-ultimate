import {symbols} from './symbols.ts';

export const shapes={
  traditional_shield:'Tradicional',modern_shield:'Moderno',rounded_shield:'Arredondado',pointed_shield:'Pontudo',
  circle:'Circular',hexagon:'Hexagonal',triangle:'Triangular',diamond:'Losango',unframed:'Sem moldura',free_monogram:'Monograma',
};
export const patterns={none:'Nenhum',claws:'Garras',stripes:'Listras',chevron:'Divisas',dots:'Pontos'};
export type Identity={
  shape:keyof typeof shapes;pattern:keyof typeof patterns;symbol:string;
  primary:string;secondary:string;detail:string;text:string;png:string;
  border?:number;scale?:number;offsetX?:number;offsetY?:number;font?:'Barlow'|'Arial'|'Georgia';tint?:boolean;
};
export const defaultIdentity:Identity={
  shape:'modern_shield',pattern:'none',symbol:'animals_wolf',
  primary:'#ef123b',secondary:'#090a12',detail:'#ffffff',text:'',png:'',
};
export const maxPngBytes=4*1024*1024;
export function pngDimensions(bytes:Uint8Array){
  const header=[137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82];
  if(bytes.length<45||bytes.length>maxPngBytes||!header.every((value,index)=>bytes[index]===value)){
    throw Error('Selecione um PNG válido de até 4 MB.');
  }
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const width=view.getUint32(16),height=view.getUint32(20);
  if(!width||!height||width>2048||height>2048)throw Error('A imagem deve ter até 2048 × 2048 pixels.');
  return {width,height};
}
export function validateIdentity(value:unknown):Identity{
  if(!value||typeof value!=='object')throw Error('Identidade inválida.');
  const i=value as Identity;
  if(!Object.hasOwn(shapes,i.shape)||!Object.hasOwn(patterns,i.pattern)||!Object.hasOwn(symbols,i.symbol))throw Error('Formato, padrão ou símbolo inválido.');
  if(![i.primary,i.secondary,i.detail].every(color=>typeof color==='string'&&/^#[\da-f]{6}$/i.test(color)))throw Error('Cor inválida.');
  if(typeof i.text!=='string'||i.text.length>24)throw Error('O texto do escudo deve ter até 24 caracteres.');
  if(typeof i.png!=='string'||i.png.length>Math.ceil(maxPngBytes/3)*4)throw Error('PNG excede o limite.');
  if(i.png)pngDimensions(Uint8Array.from(atob(i.png),letter=>letter.charCodeAt(0)));
  for(const [number,min,max] of [[i.border,0,12],[i.scale,60,130],[i.offsetX,-25,25],[i.offsetY,-25,25]] as const){
    if(number!==undefined&&(!Number.isInteger(number)||number<min||number>max))throw Error('Ajuste de escudo inválido.');
  }
  if(i.font!==undefined&&!['Barlow','Arial','Georgia'].includes(i.font))throw Error('Tipografia inválida.');
  if(i.tint!==undefined&&typeof i.tint!=='boolean')throw Error('Cor do símbolo inválida.');
  const {shape,pattern,symbol,primary,secondary,detail,text,png,border,scale,offsetX,offsetY,font,tint}=i;
  const result:Identity={shape,pattern,symbol,primary,secondary,detail,text,png};
  if(border!==undefined)result.border=border;
  if(scale!==undefined)result.scale=scale;
  if(offsetX!==undefined)result.offsetX=offsetX;
  if(offsetY!==undefined)result.offsetY=offsetY;
  if(font!==undefined)result.font=font;
  if(tint!==undefined)result.tint=tint;
  return result;
}

export const phaseOneSchema=`
CREATE TABLE IF NOT EXISTS web_identity(career_id TEXT PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE, config TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS web_godot_source(career_id TEXT PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE, file BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS web_save_names(career_id TEXT PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS web_career_entry(career_id TEXT PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE, league_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('career_slot','open_circuit')), displaced_team_id TEXT);
CREATE TABLE IF NOT EXISTS web_career_world(career_id TEXT PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE, seed INTEGER NOT NULL, version INTEGER NOT NULL, players TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS web_lineup_history(career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE, day INTEGER NOT NULL, player_id INTEGER NOT NULL, PRIMARY KEY(career_id,day,player_id));
CREATE TABLE IF NOT EXISTS web_imported_players(career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE, player_id INTEGER NOT NULL, data TEXT NOT NULL, member INTEGER NOT NULL, starter INTEGER NOT NULL, PRIMARY KEY(career_id,player_id));
`;
