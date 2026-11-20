import {incompatible,perks} from './perk-data.ts';
import type {Player} from './recruitment.ts';

export type PerkInstance={id:string;intensity:number;known:boolean};
export const personalityNames={balanced:'Equilibrado',ambitious:'Ambicioso',methodical:'Metódico',adaptable:'Adaptável'};
export type Personality=keyof typeof personalityNames;
export type Temperament={discipline:number;professionalism:number;ambition:number};
export const perkById=new Map(perks.map(perk=>[perk.id,perk]));

export function prospect(age:number,low:number|null,high:number|null,overall:number){
  if(low===null||high===null)return 'Sem avaliação';
  const estimate=(low+high)/2;
  if(age>=22&&age<=26&&estimate-overall>=8)return 'Desenvolvimento tardio';
  if(age>21)return 'Perfil estabelecido';
  if(estimate>=90)return 'Talento geracional';
  if(estimate>=85)return 'Grande promessa';
  if(estimate>=70)return 'Promessa regional';
  if(estimate>=55)return 'Em formação';
  return 'Jovem comum';
}

export function qualifiesForPerk(id:string,player:Pick<Player,'attributes'|'mode'>,personality:Personality,scores:Temperament){
  const perk=perkById.get(id);
  if(!perk)return false;
  const conditions=perk.conditions as Record<string,string|number|undefined>;
  if(conditions.exclude_personality===personality)return false;
  for(const [key,value] of Object.entries(scores)){
    if(value<Number(conditions['min_'+key]??0)||value>Number(conditions['max_'+key]??100))return false;
  }
  if(!conditions.relative_attribute)return true;
  const values=Object.values(player.attributes);
  const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
  const difference=player.attributes[player.mode.toLowerCase()+'_'+conditions.relative_attribute]-mean;
  return difference>=Number(conditions.min_relative??-Infinity)&&difference<=Number(conditions.max_relative??Infinity);
}

export function assignTraits(player:Pick<Player,'overall'|'mode'|'attributes'>,random:()=>number){
  const discipline=Math.floor(35+random()*61);
  const professionalism=Math.floor(40+random()*56);
  const ambition=Math.floor(40+random()*56);
  const prefix=player.mode.toLowerCase()+'_';
  const personality:Personality=professionalism>=75&&discipline>=70?'methodical':
    ambition>=75?'ambitious':player.attributes[prefix+'adaptation']>=player.overall?'adaptable':'balanced';
  const scores={discipline,professionalism,ambition};
  const eligible=perks.filter(perk=>qualifiesForPerk(perk.id,player,personality,scores));
  const roll=random();
  const count=roll<0.70?0:roll<0.97?1:2;
  const assigned:PerkInstance[]=[];
  for(let i=0;i<count;i++){
    const options=eligible.filter(perk=>assigned.every(instance=>instance.id!==perk.id&&
      !incompatible.some(pair=>pair.includes(instance.id)&&pair.includes(perk.id))));
    if(!options.length)break;
    const perk=options[Math.floor(random()*options.length)];
    assigned.push({id:perk.id,intensity:Math.round(60+random()*40)/100,known:random()<0.5});
  }
  return {personality,perks:assigned,temperament:scores};
}

export function publicTraits(instances:PerkInstance[],discovered:boolean){
  return instances.filter(perk=>discovered||perk.known).map(perk=>({...perk,known:true}));
}

export function perkEffects(instances:PerkInstance[],context:Record<string,boolean|number>,personality:Personality='balanced'){
  const factors:Record<string,number>={execution:1,decision:1,coordination:1,learning:1,morale_recovery:1,adaptation:1,risk:1,variance:1,fatigue_cost:1};
  const confidence=Number(context.confidence??50);
  for(const trait of instances){
    const perk=perkById.get(trait.id);
    if(!perk)continue;
    let active=Boolean(context[perk.trigger]);
    if(perk.trigger==='mistakes')active=Number(context.mistakes??0)>=2;
    if(perk.trigger==='comfortable_training')active=Boolean(context.training)&&Number(context.happiness??50)>=75;
    if(perk.trigger==='confidence_extreme')active=confidence>=75||confidence<=35;
    if(trait.id==='hypercompetitive'&&context.defeat)active=true;
    if(!active)continue;
    const intensity=Math.max(0,Math.min(1,trait.intensity));
    let amount=perk.amount;
    if(trait.id==='confidence_dependent'&&confidence<=35)amount=-amount;
    if(trait.id==='hypercompetitive'&&context.defeat)amount=-0.12;
    factors[perk.metric]+=amount*intensity;
    if(trait.id==='creative'||trait.id==='instinctive')factors.variance+=0.08*intensity;
    if(trait.id==='aggressive')factors.variance+=0.10*intensity;
    if(trait.id==='perfectionist')factors.fatigue_cost+=0.10*intensity;
  }
  if(personality==='methodical'&&context.planning)factors.decision+=0.02;
  if(personality==='adaptable'&&context.role_change)factors.adaptation+=0.03;
  if(personality==='ambitious'&&context.challenge)factors.morale_recovery+=0.03;
  if(personality==='balanced'&&context.criticism)factors.morale_recovery+=0.02;
  for(const key of Object.keys(factors)){
    factors[key]=Math.max(key==='variance'?0.7:0.75,Math.min(key==='variance'?1.5:1.25,factors[key]));
  }
  return factors;
}
