import {overall,type Mode} from './attributes.ts';
import {perkEffects, type PerkInstance, type Personality} from './traits.ts';
import type {Player} from './recruitment.ts';
import {affinity} from './team-analysis.ts';
import {trainingMultipliers,type TrainingPlan} from './training.ts';

export type Condition={morale:number;form:number;fatigue:number};
export type DevelopmentPoint={day:number;overall:number};
const bound=(value:number)=>Math.max(0,Math.min(100,value));
const round=(value:number)=>Math.round(value*100)/100;

export function athleteAge(birthDay:number,day:number){
  const date=(value:number)=>new Date(Date.UTC(2027,2,14+value));
  const birth=date(birthDay),current=date(day);
  const beforeBirthday=current.getUTCMonth()<birth.getUTCMonth()||
    (current.getUTCMonth()===birth.getUTCMonth()&&current.getUTCDate()<birth.getUTCDate());
  return current.getUTCFullYear()-birth.getUTCFullYear()-Number(beforeBirthday);
}

export function playerCondition(player:Pick<Player,'condition'|'personality'>,day:number):Condition {
  const previous=player.condition??{morale:55,form:50,fatigue:0,day:1};
  const elapsed=Math.max(0,day-previous.day);
  const recovery=perkEffects([],{team_recovery:true},player.personality).morale_recovery;
  return {
    morale:round(55+(previous.morale-55)*Math.exp(-elapsed*0.045*recovery)),
    form:round(50+(previous.form-50)*Math.exp(-elapsed*0.03)),
    fatigue:round(Math.max(0,previous.fatigue-elapsed*2)),
  };
}

export function reactToResult(current:Condition,result:'win'|'loss'|'draw',load:number,perks:PerkInstance[]=[],personality?:Personality):Condition {
  const effects=perkEffects(perks,{challenge:result==='win',defeat:result==='loss',team_recovery:result!=='loss'},personality);
  const form=result==='win'?80:result==='loss'?25:50;
  const morale=result==='win'?6:result==='loss'?-7:0;
  return {morale:round(bound(current.morale+morale*(morale<0?2-effects.morale_recovery:effects.morale_recovery))),
    form:round(current.form*0.78+form*0.22),fatigue:round(bound(current.fatigue+Math.max(0,load)*effects.fatigue_cost))};
}

export function developPlayer(player:Player,fromDay:number,toDay:number,training:TrainingPlan[]=[]):Player {
  if(player.status==='retired')return player;
  if(Math.floor((fromDay-1)/30)===Math.floor((toDay-1)/30))return player;
  let current=player;
  for(let day=(Math.floor((fromDay-1)/30)+1)*30+1;day<=toDay;day+=30){
    const age=athleteAge(player.birthDay,day);
    const ceiling=player.ceiling??Math.max(player.overall,((player.estimateLow??player.overall)+(player.estimateHigh??player.overall))/2);
    const condition=playerCondition(current,day);
    const effects=perkEffects(current.perks??[],{team_recovery:true,happiness:condition.morale,confidence:condition.morale},current.personality);
    const growth=age<=25?Math.min(age<=21?0.34:0.17,Math.max(0,ceiling-current.overall)*0.018):0;
    const decline=age>=30?Math.min(0.45,(age-29)*0.05):0;
    const plan=training.find(plan=>plan.fromDay<=day&&plan.toDay>=day);
    const efficiency=Math.max(1,Math.min(1.12,plan?.efficiency??1));
    const delta=growth*(0.75+condition.morale/220)*effects.morale_recovery*efficiency*(plan?.focus==='maintenance'?.75:1)-decline;
    if(Math.abs(delta)<0.005)continue;
    const focus=plan?.focus??'balanced';
    const multipliers=trainingMultipliers(Object.keys(current.attributes),delta>0?focus:'balanced',current.role);
    const attributes=Object.fromEntries(Object.entries(current.attributes).map(([key,value])=>[key,round(Math.max(1,bound(value+delta*multipliers[key])))]));
    const rating=overall(attributes,current.mode as Mode,current.role);
    if(rating<1||rating===current.overall)continue;
    current={...current,attributes,overall:rating,developmentHistory:[...(current.developmentHistory??[]),{day,overall:round(rating)}].slice(-24)};
  }
  return current;
}

export function teamChemistry(lineup:{player:Player;startDay:number}[],day:number){
  if(lineup.length<2)return null;
  let sum=0,pairs=0;
  for(let i=0;i<lineup.length;i++){
    for(let j=i+1;j<lineup.length;j++){
      const a=lineup[i],b=lineup[j];
      const days=Math.max(0,day-Math.max(a.startDay,b.startDay));
      sum+=affinity(a.player,b.player,days);
      pairs++;
    }
  }
  return Math.round(bound(sum/pairs));
}
