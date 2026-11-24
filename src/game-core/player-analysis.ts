import {attributeWeight,definitions,overall,roles,type Mode} from './attributes.ts';
import type {DevelopmentPoint} from './development.ts';
import type {Player} from './recruitment.ts';

export function analyzeRoles(attributes:Record<string,number>,mode:Mode,role:string){
 const rating=overall(attributes,mode,role);
 if(rating<1)return null;
 const rows=definitions[mode].map(key=>({key,id:`${mode.toLowerCase()}_${key}`,value:attributes[`${mode.toLowerCase()}_${key}`],weight:attributeWeight(role,key)}));
 const totalWeight=rows.reduce((sum,row)=>sum+row.weight,0);
 const contributions=rows.map(row=>({...row,contribution:row.value*row.weight/totalWeight})).sort((a,b)=>b.weight-a.weight||b.value-a.value);
 const gap=(row:typeof rows[number])=>(row.value-rating)*row.weight;
 const strengths=rows.filter(row=>gap(row)>0).sort((a,b)=>gap(b)-gap(a)).slice(0,3);
 const weaknesses=rows.filter(row=>gap(row)<0).sort((a,b)=>gap(a)-gap(b)).slice(0,3);
 const ratings=roles[mode].map(candidate=>({role:candidate,rating:overall(attributes,mode,candidate)}))
   .sort((a,b)=>b.rating-a.rating||Number(b.role===role)-Number(a.role===role));
 const close=ratings.filter(candidate=>ratings[0].rating-candidate.rating<=2).length;
 return {rating,attributes:contributions,strengths,weaknesses,roles:ratings,versatility:close===1?'Especialista':close===2?'Adaptável':'Versátil'};
}

type Comparable=Pick<Player,'id'|'mode'|'role'|'attributes'|'status'>;

export function playerMarkers(player:Pick<Player,'estimateLow'|'estimateHigh'>,age:number,versatility?:string){
 const markers:{label:string;description:string}[]=[];
 if(age<=21&&player.estimateLow!=null&&player.estimateHigh!=null&&(player.estimateLow+player.estimateHigh)/2>=70)
   markers.push({label:'Jovem talento',description:'Até 21 anos e média da faixa de potencial conhecida de pelo menos 70.'});
 if(age>=27)markers.push({label:'Veterano',description:'Atleta com 27 anos ou mais no calendário da carreira.'});
 if(versatility==='Versátil')markers.push({label:'Jogador versátil',description:'Três ou mais funções estão a até dois pontos de Overall da melhor função.'});
 return markers;
}
export function attributeReference(player:Comparable,universe:Comparable[],keys:string[]){
 const stats=Object.fromEntries(keys.map(key=>[key,{sum:0,count:0}]));
 for(const peer of universe){
   if(peer.id===player.id||peer.mode!==player.mode||peer.role!==player.role||peer.status==='retired')continue;
   for(const key of keys){
     const value=peer.attributes[key];
     if(!Number.isFinite(value)||value<1||value>100)continue;
     stats[key].sum+=value;stats[key].count++;
   }
 }
 return Object.fromEntries(keys.map(key=>{
   const {sum,count}=stats[key];return [key,{average:count?sum/count:null,count}];
 }));
}

export function observeOverall(player:Player,day:number):Player{
 if(player.status==='retired'||!Number.isFinite(player.overall)||player.overall<1||player.overall>100)return player;
 const history=player.developmentHistory??[];
 const latest=history.at(-1);
 if(latest&&day-latest.day<60)return player;
 return {...player,developmentHistory:[...history,{day,overall:Math.round(player.overall*100)/100}].slice(-24)};
}

export function recentTrend(history:DevelopmentPoint[]|undefined,current:number,day:number){
 if(!Number.isFinite(current)||current<1||current>100)return null;
 const previous=history?.filter(point=>point.day>=day-90&&point.day<=day-30&&Number.isFinite(point.overall)&&point.overall>=1&&point.overall<=100)
   .reduce<DevelopmentPoint|undefined>((earliest,point)=>!earliest||point.day<earliest.day?point:earliest,undefined);
 if(!previous)return null;
 const change=Math.round((current-previous.overall)*100)/100;
 return {previous,current,change,days:day-previous.day,label:change>=0.25?'Em ascensão':change<=-0.25?'Em declínio':'Estável'};
}
