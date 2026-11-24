import {overall,roles,type Mode} from './attributes.ts';
import {playerCondition,reactToResult,teamChemistry} from './development.ts';
import {perkById,perkEffects} from './traits.ts';
import type {PerkInfluence} from './player-identity.ts';
import type {Contract,Player} from './recruitment.ts';
import type {Identity} from './identity.ts';

type Side=0|1;
export type MatchStarter={player:Player;role:string;startDay:number};
export type MatchSide={id:string;name:string;code:string;logo:string;identity?:Identity;lineup:MatchStarter[]};
export type MatchTeam=Omit<MatchSide,'lineup'>;
export type MatchStat={playerId:number;team:Side;nickname:string;role:string;kills:number;deaths:number;assists:number;roundsWon:number};
export type MatchEvent={at:number;kind:'early'|'fight'|'objective'|'comeback'|'round'|'victory';team:Side;text:string;score:[number,number]};
export type MatchResult={mode:Mode;day:number;teams:[MatchTeam,MatchTeam];winner:Side;score:[number,number];kills:[number,number];durationMinutes:number;
 strengths:[number,number];homeWinProbability:number;events:MatchEvent[];stats:MatchStat[];mvp:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const round=(value:number)=>Math.round(value*100)/100;

export function careerLineup(players:Player[],contracts:Contract[]):MatchStarter[]{
 const byId=new Map(players.map(player=>[player.id,player]));
 return contracts.filter(c=>c.starter&&!c.academy).flatMap(c=>{
   const player=byId.get(c.player_id);return player?[{player,role:player.role,startDay:Math.max(1,c.start_day)}]:[];
 });
}

export function rivalLineup(players:Player[],teamId:string,mode:Mode,day:number):MatchStarter[]{
 return roles[mode].flatMap(role=>{
   const player=players.filter(p=>p.team===teamId&&p.mode===mode&&p.role===role&&!p.status)
     .sort((a,b)=>b.overall-a.overall||a.id-b.id)[0];
   return player?[{player,role,startDay:Math.min(day,player.history?.[0]?.day??-59)}]:[];
 });
}

function validateSide(side:MatchSide,mode:Mode){
 if(side.lineup.length!==5)throw Error('Cada equipe precisa de cinco titulares.');
 if(new Set(side.lineup.map(slot=>slot.player.id)).size!==5)throw Error('A escalação tem atletas repetidos.');
 if(new Set(side.lineup.map(slot=>slot.role)).size!==5||roles[mode].some(role=>!side.lineup.some(slot=>slot.role===role)))throw Error('Preencha as cinco funções da modalidade.');
 for(const slot of side.lineup){
   if(slot.player.mode!==mode||slot.player.status)throw Error('Atleta indisponível ou modalidade incompatível.');
   if(overall(slot.player.attributes,mode,slot.role)<1||!Number.isFinite(slot.player.overall))throw Error('Atributos incompletos na escalação.');
 }
}

function athleteStrength(slot:Pick<MatchStarter,'player'|'role'>,mode:Mode,day:number){
 const p=slot.player,condition=playerCondition(p,day);
 const effects=perkEffects(p.perks??[],{planning:true,challenge:true,pressure:true,confidence:condition.morale,happiness:condition.morale},p.personality);
 const ability=(p.overall*.75+overall(p.attributes,mode,slot.role)*.25)*(p.role===slot.role?1:.94);
 return clamp(ability+(condition.morale-55)*.035+(condition.form-50)*.04-condition.fatigue*.07+
   ((effects.execution+effects.decision+effects.coordination)/3-1)*15,1,100);
}

export function matchStrength(side:MatchSide,mode:Mode,day:number){
 validateSide(side,mode);
 const chemistry=teamChemistry(side.lineup,day)??0;
 return round(side.lineup.reduce((sum,slot)=>sum+athleteStrength(slot,mode,day),0)/5+(chemistry-50)*.05);
}

export function simulateMatch(mode:Mode,day:number,teams:[MatchSide,MatchSide],seed:number):MatchResult{
 if(!roles[mode]||!Number.isInteger(day)||day<1||!Number.isSafeInteger(seed))throw Error('Partida inválida.');
 teams.forEach(side=>validateSide(side,mode));
 if(teams[0].id===teams[1].id||new Set(teams.flatMap(team=>team.lineup.map(s=>s.player.id))).size!==10)throw Error('As equipes precisam ser distintas e não podem repetir atletas.');
 let state=seed>>>0;
 const random=()=>{
   state=(state+0x6d2b79f5)>>>0;let t=state;
   t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
   return ((t^(t>>>14))>>>0)/4294967296;
 };
 const integer=(min:number,max:number)=>min+Math.floor(random()*(max-min+1));
 const strengths=teams.map(team=>matchStrength(team,mode,day)) as [number,number];
 const probability=clamp(1/(1+Math.exp((strengths[1]-strengths[0])/12)),.08,.92);
 const stats:MatchStat[]=teams.flatMap((team,side)=>team.lineup.map(slot=>({playerId:slot.player.id,team:side as Side,nickname:slot.player.nickname,role:slot.role,kills:0,deaths:0,assists:0,roundsWon:0})));
 const bySide=[stats.slice(0,5),stats.slice(5)] as const;
 const events:MatchEvent[]=[],score:[number,number]=[0,0];
 const kills=()=>[bySide[0].reduce((sum,s)=>sum+s.kills,0),bySide[1].reduce((sum,s)=>sum+s.kills,0)] as [number,number];
 const event=(at:number,kind:MatchEvent['kind'],side:Side,text:string)=>events.push({at,kind,team:side,text,score:mode==='FPS'?[...score]:kills()});
 const weightedKiller=(side:Side)=>{
   const weights=teams[side].lineup.map(slot=>athleteStrength(slot,mode,day));
   let roll=random()*weights.reduce((sum,w)=>sum+w,0);
   for(let index=0;index<weights.length;index++){roll-=weights[index];if(roll<=0)return index;}
   return 4;
 };
 const recordKills=(side:Side,count:number,uniqueVictims:boolean)=>{
   const victims=[0,1,2,3,4];
   for(let i=0;i<count;i++){
     const killer=weightedKiller(side),opponent=(1-side) as Side;
     const victim=uniqueVictims?victims.splice(integer(0,victims.length-1),1)[0]:integer(0,4);
     bySide[side][killer].kills++;bySide[opponent][victim].deaths++;
     const assistants=[0,1,2,3,4].filter(index=>index!==killer);
     const countAssist=mode==='MOBA'?integer(1,3):Number(random()<.65);
     for(let j=0;j<countAssist;j++)bySide[side][assistants.splice(integer(0,assistants.length-1),1)[0]].assists++;
   }
 };
 let winner:Side,durationMinutes:number;
 if(mode==='MOBA'){
   durationMinutes=integer(24,44);const objectives=[0,0];let initial:Side=0;
   for(let stage=0;stage<5;stage++){
     const side=(random()<clamp(probability+(kills()[0]-kills()[1])*.004,.1,.9)?0:1) as Side;
     if(stage===0)initial=side;
     const at=Math.round(durationMinutes*(.15+stage*.17));
     recordKills(side,integer(2,5),false);recordKills((1-side) as Side,integer(0,2),false);
     event(at,stage===0?'early':'fight',side,teams[side].name+(stage===0?' constrói vantagem inicial.':' vence um confronto entre equipes.'));
     objectives[side]++;event(at+1,'objective',side,teams[side].name+' conquista um objetivo.');
   }
   winner=random()<clamp(probability+(kills()[0]-kills()[1])*.004+(objectives[0]-objectives[1])*.015,.06,.94)?0:1;
   if(winner!==initial)event(durationMinutes-1,'comeback',winner,teams[winner].name+' vira a disputa pelos objetivos decisivos.');
   recordKills(winner,integer(2,5),false);recordKills((1-winner) as Side,integer(0,2),false);
   score[winner]=1;event(durationMinutes,'victory',winner,teams[winner].name+' conquista a vitória.');
 }else{
   let target=13,leader:Side|null=null;
   const mapSwing=(random()-.5)*.18;
   while(Math.max(...score)<target){
     const roundNumber=score[0]+score[1]+1;
     const comeback=(score[0]-score[1])*.004;
     const p=clamp(.5+(probability-.5)*.55+mapSwing-comeback,.28,.72);
     const side=(random()<p?0:1) as Side;
     recordKills(side,integer(3,5),true);recordKills((1-side) as Side,integer(0,4),true);
     score[side]++;event(roundNumber,'round',side,teams[side].name+' vence o round '+roundNumber+'.');
     if(score[0]!==score[1]){
       const next=score[0]>score[1]?0:1;
       if(leader!==null&&leader!==next)event(roundNumber,'comeback',next,teams[next].name+' vira o placar.');
       leader=next;
     }
     if(score[0]===12&&score[1]===12)target=16;
   }
   winner=score[0]>score[1]?0:1;durationMinutes=round((score[0]+score[1])*1.7);
   for(const stat of stats)stat.roundsWon=score[stat.team];
   event(score[0]+score[1],'victory',winner,teams[winner].name+' vence o mapa'+(target===16?' na prorrogação.':'.'));
 }
 const mvp=[...stats].sort((a,b)=>
   (b.kills*3+b.assists-b.deaths*1.2+Number(b.team===winner)*2)-(a.kills*3+a.assists-a.deaths*1.2+Number(a.team===winner)*2)||a.playerId-b.playerId)[0].playerId;
 return {mode,day,teams:teams.map(({lineup:_,...team})=>team) as [MatchTeam,MatchTeam],winner,score,kills:kills(),durationMinutes,
   strengths,homeWinProbability:probability,events,stats,mvp};
}

export function applyMatchConditions(players:Player[],result:MatchResult,recordInfluences=true):Player[]{
 const played=new Map(result.stats.map(stat=>[stat.playerId,stat]));
 return players.map(player=>{
   const stat=played.get(player.id);if(!stat)return player;
   const before=playerCondition(player,result.day),outcome=stat.team===result.winner?'win':'loss';
   const load=Math.min(12,result.durationMinutes/5),perks=player.perks??[];
   const condition=reactToResult(before,outcome,load,perks,player.personality);
   const updated={...player,condition:{...condition,day:result.day}};
   if(!recordInfluences||!perks.length)return updated;
   const effects:PerkInfluence[]=[];
   let strength:number|undefined;
   for(const [index,perk] of perks.entries()){
     const metric=perkById.get(perk.id)?.metric;
     if(metric==='execution'||metric==='decision'||metric==='coordination'){
       const otherPerks=perks.filter((_,i)=>i!==index);
       strength??=athleteStrength({player,role:stat.role},result.mode,result.day);
       const delta=round(strength-athleteStrength({player:{...player,perks:otherPerks},role:stat.role},result.mode,result.day));
       if(delta)effects.push({day:result.day,perkId:perk.id,metric:'strength',delta,result:outcome});
     }
     if(metric!=='morale_recovery'&&metric!=='fatigue_cost'&&perk.id!=='perfectionist')continue;
     const without=reactToResult(before,outcome,load,perks.filter((_,i)=>i!==index),player.personality);
     for(const field of ['morale','fatigue'] as const){
       const delta=round(condition[field]-without[field]);
       if(delta)effects.push({day:result.day,perkId:perk.id,metric:field,delta,result:outcome});
     }
   }
   return effects.length?{...updated,perkInfluences:[...(player.perkInfluences??[]),...effects].slice(-8)}:updated;
 });
}
