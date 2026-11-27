import type {Mode} from './attributes.ts';
import type {MatchSide} from './matches.ts';

export const phaseNames=['Early Game','Mid Game','Late Game'] as const;
export type MobaPhase=typeof phaseNames[number];
export type MobaObjective='tower'|'dragon'|'baron';
export const objectiveNames:Record<MobaObjective,string>={tower:'torre',dragon:'dragão',baron:'Barão'};
export type MobaPhaseResult={phase:MobaPhase;gold:[number,number];experience:[number,number];vision:[number,number];objectives:[number,number];pressure:[number,number];fights:[number,number]};
export type MobaFrame={phase:MobaPhase;at:number;lane:'top'|'mid'|'bot'|'river';team:0|1;objective?:MobaObjective};
const phaseAttributes:Record<MobaPhase,string[]>={
 'Early Game':['laning','mechanics','positioning'],
 'Mid Game':['vision','map','objectives','reading'],
 'Late Game':['consistency','teamfights','coordination','decisions'],
};
export const strategyNames={
 MOBA:{balanced:'Equilibrada',early:'Pressão inicial',objectives:'Controle de objetivos',scaling:'Escala para o fim',teamfight:'Confrontos coletivos',side:'Pressão lateral'},
 FPS:{balanced:'Equilibrada',rush:'Ritmo acelerado',control:'Controle tático',picks:'Busca por picks',execution:'Execução coordenada',reactive:'Jogo reativo'},
};
export type Strategy=keyof typeof strategyNames.MOBA|keyof typeof strategyNames.FPS;
export type TacticalMap={id:string;name:string;traits:string[];sites:[[number,number],[number,number]];paths:[number,number][][]};
export const tacticalMaps:TacticalMap[]=[
 {id:'mirage',name:'Mirage',traits:['aim','angles','space'],sites:[[75,72],[25,24]],paths:[[[9,76],[35,76],[53,57],[75,72],[91,57]],[[9,76],[20,44],[25,24],[65,23],[91,57]],[[53,57],[65,23]]]},
 {id:'inferno',name:'Inferno',traits:['utility','coordination','decisions'],sites:[[75,71],[66,21]],paths:[[[10,52],[34,67],[50,65],[75,71],[92,39]],[[10,52],[30,35],[45,37],[66,21],[92,39]],[[50,65],[73,43],[66,21]]]},
 {id:'nuke',name:'Nuke',traits:['map','reading','execution'],sites:[[62,32],[68,77]],paths:[[[10,25],[34,25],[45,45],[62,32],[88,29]],[[10,25],[20,69],[48,74],[68,77],[88,29]],[[45,45],[48,74]],[[62,32],[68,77]]]},
 {id:'ancient',name:'Ancient',traits:['awareness','positioning','utility'],sites:[[29,30],[72,27]],paths:[[[50,91],[22,67],[29,30],[51,10]],[[50,91],[78,65],[72,27],[51,10]],[[29,30],[49,51],[72,27]],[[49,51],[50,91]]]},
 {id:'anubis',name:'Anubis',traits:['reaction','adaptation','coordination'],sites:[[75,26],[28,69]],paths:[[[12,28],[34,31],[51,47],[75,26],[88,56]],[[12,28],[15,59],[28,69],[65,79],[88,56]],[[51,47],[45,68],[65,79]]]},
];
export function seriesMaps(seed:number){
 const start=(seed>>>0)%tacticalMaps.length;
 return [...tacticalMaps.slice(start),...tacticalMaps.slice(0,start)];
}
export function mapAffinity(team:MatchSide,map:TacticalMap){
 const mean=team.lineup.reduce((sum,slot)=>sum+slot.player.overall,0)/team.lineup.length;
 return Math.max(-2,Math.min(2,(tacticalAttribute(team,'FPS',map.traits)-mean)*.16));
}
const emphasis:Partial<Record<Strategy,string[]>>={
 early:['laning','mechanics'],objectives:['objectives','vision'],scaling:['consistency','decisions'],teamfight:['teamfights','coordination'],side:['map','positioning'],
 rush:['reaction','space'],control:['map','utility'],picks:['aim','angles'],execution:['coordination','execution'],reactive:['adaptation','awareness'],
};
export function tacticalAttribute(team:MatchSide,mode:Mode,keys:string[]){
 return team.lineup.reduce((sum,{player})=>sum+keys.reduce((value,key)=>value+player.attributes[mode.toLowerCase()+'_'+key],0),0)/(team.lineup.length*keys.length);
}
export function preferredStrategy(team:MatchSide,mode:Mode):Strategy{
 const candidates=Object.keys(strategyNames[mode]).filter(key=>key!=='balanced') as Strategy[];
 const scored=candidates.map(key=>({key,value:tacticalAttribute(team,mode,emphasis[key]!)})).sort((a,b)=>b.value-a.value);
 return scored[0].value-scored.at(-1)!.value>=3?scored[0].key:'balanced';
}
export function strategyFit(team:MatchSide,mode:Mode,strategy:Strategy){
 const keys=emphasis[strategy];
 if(!keys)return 0;
 const average=team.lineup.reduce((sum,{player})=>sum+player.overall,0)/team.lineup.length;
 return Math.max(-1.8,Math.min(1.8,(tacticalAttribute(team,mode,keys)-average)*.15));
}
export function roundTempo(strategy:Strategy,round:number){
 switch(strategy){
   case 'rush':return round%3===1?.014:-.006;
   case 'reactive':return round%3===1?-.014:.006;
   case 'control':return round%4===0?.012:-.004;
   case 'picks':return round%2===0?.009:-.009;
   case 'execution':return round%4===2?.015:-.005;
   default:return 0;
 }
}
export function phaseStrength(team:MatchSide,phase:MobaPhase){
 return tacticalAttribute(team,'MOBA',phaseAttributes[phase]);
}
export function phasePlan(strategy:Strategy,phase:MobaPhase,stage:number){
 const targets:Partial<Record<Strategy,MobaPhase>>={early:'Early Game',objectives:'Mid Game',side:'Mid Game',scaling:'Late Game',teamfight:'Late Game'};
 if(targets[strategy]===undefined)return 0;
 if(strategy==='side')return stage===0||stage===2?1:-.35;
 if(strategy==='teamfight')return stage>=2?.65:-.55;
 return targets[strategy]===phase?1:-.5;
}
export const roleRatings:Record<string,[kills:number,assists:number,deaths:number,contribution:number]>={
 top:[.18,.11,.16,.23],jungle:[.13,.14,.11,.21],mid:[.19,.13,.12,.15],adc:[.23,.08,.15,.15],support_moba:[.08,.19,.1,.22],
 entry:[.20,.10,.10,.21],awper:[.23,.07,.15,.17],igl:[.11,.16,.11,.20],support_fps:[.10,.19,.1,.22],lurker:[.18,.11,.15,.18],
};
