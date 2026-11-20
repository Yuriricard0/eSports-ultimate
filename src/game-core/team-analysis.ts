import {roles,type Mode} from './attributes.ts';
import type {Player} from './recruitment.ts';

const measure=(player:Player,keys:string[])=>keys.reduce((sum,key)=>sum+(player.attributes[player.mode.toLowerCase()+'_'+key]??player.overall),0)/keys.length;
const styleDimensions={
  MOBA:{Agressivo:['mechanics','reflexes','precision'],Estratégico:['reading','decisions','vision'],Coletivo:['communication','teamwork','coordination'],Adaptável:['adaptation','consistency','meta']},
  FPS:{Agressivo:['aim','reflexes','reaction'],Estratégico:['reading','decisions','map'],Coletivo:['communication','coordination','utility'],Adaptável:['adaptation','consistency','awareness']},
};
export function styleOf(player:Player){
  const scores=Object.entries(styleDimensions[player.mode as Mode]??styleDimensions.MOBA)
    .map(([style,keys])=>({style,score:measure(player,keys)})).sort((a,b)=>b.score-a.score);
  return scores[0].score-scores[1].score<2?'Equilibrado':scores[0].style;
}

const pairedRoles=[['adc','support_moba'],['jungle','mid'],['entry','support_fps'],['awper','igl']];
export function affinity(left:Player,right:Player,sharedDays:number){
  if(left.mode!==right.mode)return 0;
  const social=(measure(left,['communication','coordination','leadership'])+measure(right,['communication','coordination','leadership']))/2;
  const complementary=pairedRoles.some(pair=>pair.includes(left.role)&&pair.includes(right.role)&&left.role!==right.role);
  const styles=[styleOf(left),styleOf(right)];
  const styleBonus=styles.includes('Coletivo')?4:styles.every(style=>style==='Agressivo')?-4:0;
  const roleBonus=left.role===right.role?-8:complementary?8:3;
  return Math.round(Math.max(0,Math.min(100,25+55*(1-Math.exp(-Math.max(0,sharedDays)/85))+(social-50)*0.24+roleBonus+styleBonus)));
}

export function estimatedStrength(players:Player[],actualStarters?:Player[]){
  if(!players.length)return null;
  const positions=roles[players[0].mode as Mode]??[];
  if(!positions.length)return null;
  const candidates=actualStarters??players;
  const score=positions.reduce((sum,role)=>sum+Math.max(0,...candidates.filter(player=>player.role===role).map(player=>player.overall)),0);
  const starters=positions.filter(role=>candidates.some(player=>player.role===role)).length;
  const depth=Math.min(2,Math.max(0,players.length-starters));
  return Math.round(10*(score/positions.length*0.97+depth*1.5))/10;
}

export function clubPhilosophy(reputation:number,academy:boolean,hasAcademy:boolean){
  if(academy)return 'Formação de talentos';
  if(hasAcademy)return 'Desenvolvimento interno';
  if(reputation>=80)return 'Competitividade imediata';
  if(reputation>=60)return 'Estabilidade de elenco';
  return 'Contratações de baixo custo';
}
