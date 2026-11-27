import {definitions,roles} from '../src/game-core/attributes.ts';
import {simulateMatch} from '../src/game-core/matches.ts';

const samples=Number(process.argv[2]??500);
if(!Number.isSafeInteger(samples)||samples<1)throw Error('Informe uma quantidade inteira e positiva de confrontos por cenário.');
const percent=(count,total)=>Math.round(10000*count/total)/100;
const mean=values=>Math.round(100*values.reduce((sum,value)=>sum+value,0)/values.length)/100;
const distribution=values=>{
 const sorted=values.slice().sort((a,b)=>a-b);
 return {min:sorted[0],p10:sorted[Math.floor((sorted.length-1)*.1)],median:sorted[Math.floor((sorted.length-1)*.5)],
   p90:sorted[Math.floor((sorted.length-1)*.9)],max:sorted.at(-1),mean:mean(values)};
};
const day=150;
function side(mode,index,overall,settings={}){
 return {id:index===0?'career:calibration':'side-'+index,name:'Equipe '+index,code:'E'+index,logo:'',
   lineup:roles[mode].map((role,i)=>({role,startDay:settings.startDay??day,player:{
     id:index*10+i+1,nickname:role,mode,role,overall,
     attributes:Object.fromEntries(definitions[mode].map(key=>[mode.toLowerCase()+'_'+key,settings.strengths?.includes(key)?overall+12:overall])),
     condition:{day,morale:settings.morale??55,form:settings.form??50,fatigue:0},
     perks:settings.perks??[],
   }}))};
}
const scenarios=[
 ...[-30,-15,-5,0,5,15,30].map(gap=>({name:'Overall '+gap,homeRating:60+gap/2,awayRating:60-gap/2})),
 {name:'Moral 85 × 35',home:{morale:85},away:{morale:35}},
 {name:'Forma 80 × 30',home:{form:80},away:{form:30}},
 {name:'Entrosamento 149 × 0 dias',home:{startDay:1}},
 {name:'Perk Sangue Frio',home:{perks:[{id:'cold_blood',intensity:1,known:true}]}},
];
const output={samples,simulations:samples*(scenarios.length+2)*2,
 definitions:{comeback:'Vitória de quem saiu atrás no primeiro evento de placar (round ou confronto inicial).',
   dominance:'CS2: perdedor com até 4 rounds. MOBA: vencedor com pelo menos três vezes os abates do perdedor.'},modes:{}};
for(const mode of ['MOBA','FPS']){
 const profile={strengths:mode==='MOBA'?['laning','mechanics']:['reaction','space']};
 output.modes[mode]=[...scenarios,{name:'Perfil especializado · equilibrada',home:profile},
   {name:'Perfil especializado · plano compatível',home:profile,strategy:mode==='MOBA'?'early':'rush'}].map(scenario=>{
   const teams=[side(mode,0,scenario.homeRating??60,scenario.home),side(mode,1,scenario.awayRating??60,scenario.away)];
   let wins=0,comebacks=0,dominance=0;
   const strengths=[],durations=[],probabilities=[],notes=new Map();
   for(let seed=1;seed<=samples;seed++){
     const result=simulateMatch(mode,day,teams,seed,{strategy:scenario.strategy});
     wins+=Number(result.winner===0);
     comebacks+=Number(result.events.find(event=>event.kind===(mode==='MOBA'?'early':'round')).team!==result.winner);
     const winnerKills=result.kills[result.winner],loserKills=result.kills[1-result.winner];
     dominance+=Number(mode==='FPS'?result.score[1-result.winner]<=4:winnerKills>=Math.max(1,loserKills)*3);
     strengths.push(result.strengths[0]-result.strengths[1]);durations.push(result.durationMinutes);probabilities.push(result.homeWinProbability);
     for(const stat of result.stats)if(stat.team===0&&stat.rating!==undefined){
       const values=notes.get(stat.role)??[];values.push(stat.rating);notes.set(stat.role,values);
     }
   }
   return {name:scenario.name,homeWin:percent(wins,samples),expectedWin:mean(probabilities.map(value=>value*100)),meanStrengthGap:mean(strengths),
     comeback:percent(comebacks,samples),dominance:percent(dominance,samples),duration:distribution(durations),
     ratingsByRole:Object.fromEntries([...notes].map(([role,values])=>[role,distribution(values)]))};
 });
 const balanced=output.modes[mode].find(row=>row.name==='Overall 0').homeWin;
 for(const row of output.modes[mode])row.winDeltaFromBalanced=Math.round((row.homeWin-balanced)*100)/100;
 const [control,experiment]=output.modes[mode].slice(-2);
 experiment.winDeltaFromSameProfile=Math.round((experiment.homeWin-control.homeWin)*100)/100;
}
process.stdout.write(JSON.stringify(output,null,2)+'\n');
