import {overall,roles,type Mode} from './attributes.ts';
import {playerCondition,reactToResult,teamChemistry} from './development.ts';
import {perkById,perkEffects} from './traits.ts';
import type {PerkInfluence} from './player-identity.ts';
import type {Contract,Player} from './recruitment.ts';
import type {Identity} from './identity.ts';
import {mapAffinity,objectiveNames,phaseNames,phasePlan,phaseStrength,preferredStrategy,roleRatings,roundTempo,strategyFit,strategyNames,tacticalMaps,
 type MobaFrame,type MobaObjective,type MobaPhaseResult,type Strategy} from './match-tactics.ts';

type Side=0|1;
export type MatchStarter={player:Player;role:string;startDay:number};
export type MatchSide={id:string;name:string;code:string;logo:string;identity?:Identity;uniform?:import('./uniform.ts').Uniform;lineup:MatchStarter[]};
export type MatchTeam=Omit<MatchSide,'lineup'>;
export type MatchStat={playerId:number;team:Side;nickname:string;role:string;kills:number;deaths:number;assists:number;roundsWon:number;rating?:number;contribution?:number;portraitIndex?:number};
export type MatchEvent={at:number;kind:'early'|'fight'|'objective'|'comeback'|'round'|'victory'|'plant'|'defuse';team:Side;text:string;score:[number,number]};
export type RoundMoment={label:string;alive:number[];bomb:RoundFrame['bomb'];score:[number,number];text:string};
export type RoundFrame={round:number;site:0|1;attack:Side;winner:Side;alive:number[];utility:Side|null;bomb:'não plantada'|'plantada'|'desarmada'|'detonada';moments?:RoundMoment[]};
export type RoleAction={at:number;playerId:number;kind:'objective'|'opening'|'utility'|'anchor';detail:string};
export type MatchOptions={strategy?:Strategy;mapId?:string};
export type MatchResult={mode:Mode;day:number;teams:[MatchTeam,MatchTeam];winner:Side;score:[number,number];kills:[number,number];durationMinutes:number;
 strengths:[number,number];homeWinProbability:number;events:MatchEvent[];stats:MatchStat[];mvp:number;
 strategies?:[Strategy,Strategy];mapId?:string;mapEdge?:[number,number];phases?:MobaPhaseResult[];mobaFrames?:MobaFrame[];roundFrames?:RoundFrame[];roleActions?:RoleAction[]};
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

export function simulateMatch(mode:Mode,day:number,teams:[MatchSide,MatchSide],seed:number,options:MatchOptions={}):MatchResult{
 if(!roles[mode]||!Number.isInteger(day)||day<1||!Number.isSafeInteger(seed))throw Error('Partida inválida.');
 teams.forEach(side=>validateSide(side,mode));
 if(teams[0].id===teams[1].id||new Set(teams.flatMap(team=>team.lineup.map(s=>s.player.id))).size!==10)throw Error('As equipes precisam ser distintas e não podem repetir atletas.');
 if(options.strategy&&!Object.hasOwn(strategyNames[mode],options.strategy))throw Error('Estratégia incompatível com a modalidade.');
 const strategies=teams.map(team=>team.id.startsWith('career')?options.strategy??'balanced':preferredStrategy(team,mode)) as [Strategy,Strategy];
 const map=mode==='FPS'?tacticalMaps.find(row=>row.id===options.mapId)??tacticalMaps[(seed>>>0)%tacticalMaps.length]:undefined;
 const mapEdge=map?teams.map(team=>mapAffinity(team,map)) as [number,number]:undefined;
 let state=seed>>>0;
 const random=()=>{
   state=(state+0x6d2b79f5)>>>0;let t=state;
   t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
   return ((t^(t>>>14))>>>0)/4294967296;
 };
 const integer=(min:number,max:number)=>min+Math.floor(random()*(max-min+1));
 const strengths=teams.map(team=>matchStrength(team,mode,day)) as [number,number];
 const tactics=teams.map((team,index)=>strategyFit(team,mode,strategies[index])+(mapEdge?.[index]??0));
 const probability=clamp(1/(1+Math.exp((strengths[1]-strengths[0]+tactics[1]-tactics[0])/12)),.08,.92);
 const killWeights=teams.map(team=>team.lineup.map(slot=>athleteStrength(slot,mode,day)));
 const killTotals=killWeights.map(weights=>weights.reduce((sum,weight)=>sum+weight,0));
 const stats:MatchStat[]=teams.flatMap((team,side)=>team.lineup.map(slot=>({playerId:slot.player.id,team:side as Side,nickname:slot.player.nickname,role:slot.role,kills:0,deaths:0,assists:0,roundsWon:0,contribution:0,portraitIndex:slot.player.portraitIndex})));
 const bySide=[stats.slice(0,5),stats.slice(5)] as const;
 const events:MatchEvent[]=[],score:[number,number]=[0,0];
 const roleActions:RoleAction[]=[];
 const credit=(stat:MatchStat,at:number,kind:RoleAction['kind'],detail:string)=>{
   stat.contribution!++;
   roleActions.push({at,playerId:stat.playerId,kind,detail});
 };
 const kills=()=>[bySide[0].reduce((sum,s)=>sum+s.kills,0),bySide[1].reduce((sum,s)=>sum+s.kills,0)] as [number,number];
 const event=(at:number,kind:MatchEvent['kind'],side:Side,text:string)=>events.push({at,kind,team:side,text,score:mode==='FPS'?[...score]:kills()});
 const weightedKiller=(side:Side)=>{
   const weights=killWeights[side];
   let roll=random()*killTotals[side];
   for(let index=0;index<weights.length;index++){roll-=weights[index];if(roll<=0)return index;}
   return 4;
 };
 const recordKills=(side:Side,count:number,uniqueVictims:boolean,openingRound?:number)=>{
   const victims=[0,1,2,3,4];
   const eliminated:number[]=[];
   const highlights:string[]=[];
   for(let i=0;i<count;i++){
     const killer=weightedKiller(side),opponent=(1-side) as Side;
     const victim=uniqueVictims?victims.splice(integer(0,victims.length-1),1)[0]:integer(0,4);
     bySide[side][killer].kills++;bySide[opponent][victim].deaths++;
     const attacker=bySide[side][killer];
     if(i===0&&openingRound!==undefined&&['entry','awper','lurker'].includes(attacker.role))
       credit(attacker,openingRound,'opening','Primeira eliminação registrada pela equipe · '+bySide[opponent][victim].nickname);
     eliminated.push(bySide[opponent][victim].playerId);
     if(i===0)highlights.push(attacker.nickname+' elimina '+bySide[opponent][victim].nickname);
     const assistants=[0,1,2,3,4].filter(index=>index!==killer);
     const countAssist=mode==='MOBA'?integer(1,3):Number(random()<.65);
     for(let j=0;j<countAssist;j++)bySide[side][assistants.splice(integer(0,assistants.length-1),1)[0]].assists++;
   }
   return {eliminated,highlight:highlights[0]};
 };
 const phases:MobaPhaseResult[]=phaseNames.map(phase=>({phase,gold:[0,0],experience:[0,0],vision:[0,0],objectives:[0,0],pressure:[0,0],fights:[0,0]}));
 const mobaFrames:MobaFrame[]=[],roundFrames:RoundFrame[]=[];
 let winner:Side,durationMinutes:number;
 if(mode==='MOBA'){
   durationMinutes=integer(24,44);const objectives=[0,0];let initial:Side=0;
   for(let stage=0;stage<5;stage++){
     const phase=phases[stage<2?0:stage<4?1:2];
     const phaseGap=phaseStrength(teams[0],phase.phase)-phaseStrength(teams[1],phase.phase);
     const plan=phasePlan(strategies[0],phase.phase,stage)-phasePlan(strategies[1],phase.phase,stage);
     const side=(random()<clamp(probability+phaseGap*.002+plan*.025+(kills()[0]-kills()[1])*.004,.1,.9)?0:1) as Side;
     if(stage===0)initial=side;
     const at=Math.round(durationMinutes*(.15+stage*.17));
     const other=(1-side) as Side,wonKills=integer(2,5);
     const before=bySide[side].map(stat=>stat.kills+stat.assists);
     const fight=recordKills(side,wonKills,false);
     const lostKills=integer(0,2);
     recordKills(other,lostKills,false);
     const objective=(['tower','dragon','tower','dragon','baron'] as MobaObjective[])[stage];
     const lane=objective==='tower'?(stage===0?'top':'bot'):'river';
     mobaFrames.push({phase:phase.phase,at,team:side,lane},{phase:phase.phase,at:at+1,team:side,lane,objective});
     phase.fights[side]++;phase.objectives[side]++;phase.pressure[side]+=objective==='tower'?2:1;
     phase.gold[side]+=wonKills*300+450;phase.gold[other]+=lostKills*300+250;
     phase.experience[side]+=wonKills*140+240;phase.experience[other]+=lostKills*140+200;
     phase.vision[side]+=2;phase.vision[other]++;
     event(at,stage===0?'early':'fight',side,`${teams[side].name}${stage===0?' constrói vantagem inicial':' vence um confronto'} (${wonKills} a ${lostKills} em abates). ${fight.highlight??''}.`);
     const role=objective==='tower'?(lane==='top'?'top':'adc'):'jungle';
     bySide[side].forEach((stat,index)=>{
       const participated=stat.kills+stat.assists>before[index];
       if(participated&&(stat.role===role||stat.role==='support_moba'||stat.role==='mid'&&lane==='river'))
         credit(stat,at+1,'objective','Participou do confronto que antecedeu a conquista de '+objectiveNames[objective]);
     });
     objectives[side]++;event(at+1,'objective',side,teams[side].name+' conquista '+objectiveNames[objective]+'.');
   }
   winner=random()<clamp(probability+(kills()[0]-kills()[1])*.002+(objectives[0]-objectives[1])*.008,.06,.94)?0:1;
   if(winner!==initial)event(durationMinutes-1,'comeback',winner,teams[winner].name+' vira a disputa pelos objetivos decisivos.');
   recordKills(winner,integer(2,5),false);recordKills((1-winner) as Side,integer(0,2),false);
   score[winner]=1;event(durationMinutes,'victory',winner,teams[winner].name+' conquista a vitória.');
 }else{
   let target=13,leader:Side|null=null;
   const mapSwing=(random()-.5)*.18;
   while(Math.max(...score)<target){
     const roundNumber=score[0]+score[1]+1;
     const comeback=(score[0]-score[1])*.004;
     // A map already compounds the advantage over many rounds.
     const tempo=roundTempo(strategies[0],roundNumber)-roundTempo(strategies[1],roundNumber);
     const p=clamp(.5+(probability-.5)*.33+mapSwing-comeback+tempo,.28,.72);
     const side=(random()<p?0:1) as Side;
     const combat=recordKills(side,integer(3,5),true,roundNumber);
     const response=recordKills((1-side) as Side,integer(0,4),true,roundNumber);
     const eliminated=[...combat.eliminated,...response.eliminated];
     const attack=(roundNumber<=12?0:roundNumber<=24?1:roundNumber%2) as Side;
     const site=((roundNumber+(seed>>>0))%2) as 0|1;
     const utility=roundNumber%3===0?attack:null;
     const plant=roundNumber%4!==1&&eliminated.length>=4;
     const bomb=plant?(side===attack?'detonada':'desarmada'):'não plantada';
     if(plant)event(roundNumber,'plant',attack,'Bomba plantada no ponto '+(site===0?'A':'B')+'.');
     if(bomb==='desarmada')event(roundNumber,'defuse',side,teams[side].name+' desarma a bomba.');
     const alive=stats.filter(stat=>!eliminated.includes(stat.playerId)).map(stat=>stat.playerId);
     const roster=stats.map(stat=>stat.playerId);
     const closing:[number,number]=[score[0]+Number(side===0),score[1]+Number(side===1)];
     const moments:RoundMoment[]=[{label:'Entrada',alive:roster,bomb:'não plantada',score:[...score],
       text:teams[attack].name+' avança para o ponto '+(site===0?'A':'B')+(utility===attack?' com uso de utilitário.':'.')}];
     if(plant)moments.push({label:'Plant',alive:roster,bomb:'plantada',score:[...score],text:'Bomba plantada no ponto '+(site===0?'A':'B')+'.'});
     moments.push({label:'Confronto',alive,bomb:plant?'plantada':'não plantada',score:[...score],
       text:[combat.highlight,response.highlight].filter(Boolean).join(' · ')});
     moments.push({label:'Fim do round',alive,bomb,score:closing,text:teams[side].name+' vence o round.'});
     roundFrames.push({round:roundNumber,site,attack,winner:side,utility,bomb,alive,moments});
     for(const stat of bySide[side])if(!eliminated.includes(stat.playerId)){
       if(stat.role==='igl')credit(stat,roundNumber,'anchor','IGL sobreviveu ao round vencido');
       else if(stat.role==='support_fps'&&utility===side)credit(stat,roundNumber,'utility','Suporte sobreviveu ao round vencido com utilitário registrado para sua equipe');
     }
     const alone=bySide[side].filter(stat=>!eliminated.includes(stat.playerId));
     const clutch=alone.length===1?(' '+alone[0].nickname+' é o único sobrevivente da equipe.'):'';
     score[side]++;event(roundNumber,'round',side,`${teams[side].name} vence o round ${roundNumber}. ${combat.highlight??''}.${clutch}`);
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
 for(const stat of stats){
   const [kills,assists,deaths,contribution]=roleRatings[stat.role],scale=mode==='FPS'?24/(score[0]+score[1]):1;
   stat.rating=round(clamp(5.5+scale*(stat.kills*kills+stat.assists*assists-stat.deaths*deaths+stat.contribution!*contribution)+(stat.team===winner?.3:0),1,10));
 }
 const mvp=[...stats].sort((a,b)=>b.rating!-a.rating!||a.playerId-b.playerId)[0].playerId;
 return {mode,day,teams:teams.map(({lineup:_,...team})=>team) as [MatchTeam,MatchTeam],winner,score,kills:kills(),durationMinutes,
   strengths,homeWinProbability:probability,events,stats,mvp,strategies,roleActions,
   ...(mode==='MOBA'?{phases,mobaFrames}:{mapId:map?.id,mapEdge,roundFrames})};
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
