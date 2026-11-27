import type {Competition,Fixture} from './competitions.ts';

export type BestOf=1|3|5;
export type DoubleRules={upper:BestOf;lower:BestOf;final:BestOf;grandFinal:'reset'|'single'};
type Source={team:string|null}|{node:string;result:'winner'|'loser'};
export type BracketNode={id:string;lane:'upper'|'lower'|'final'|'reset';round:number;week:number;bestOf:BestOf;sources:[Source,Source]};
export type DoubleElimination={rules:DoubleRules;nodes:BracketNode[]};
export type OpeningStage={system:'groups';groups:string[][];bestOf:BestOf;advancePerGroup:number}|{system:'swiss';teams:string[];bestOf:BestOf;rounds:number;advance:number};
type Outcome={winner:string|null;loser:string|null;day:number};

export function createDoubleElimination(teams:string[],rules:DoubleRules):DoubleElimination{
 if(teams.length<2||teams.length>32||new Set(teams).size!==teams.length)throw Error('A chave exige de duas a 32 equipes únicas.');
 const nodes:BracketNode[]=[];
 const add=(lane:BracketNode['lane'],round:number,week:number,sources:[Source,Source],index=0)=>{
   const node:BracketNode={id:lane+'-'+round+'-'+index,lane,round,week,bestOf:lane==='upper'?rules.upper:lane==='lower'?rules.lower:rules.final,sources};
   nodes.push(node);return node;
 };
 const ref=(node:BracketNode,result:OutcomeKey='winner'):Source=>({node:node.id,result});
 type OutcomeKey='winner'|'loser';
 const pair=(items:Source[],lane:BracketNode['lane'],round:number,week:number)=>Array.from({length:items.length/2},(_,i)=>
   add(lane,round,week,[items[i*2],items[i*2+1]],i));
 let seeds=[1,2];
 while(seeds.length<teams.length){const sum=seeds.length*2+1;seeds=seeds.flatMap(seed=>[seed,sum-seed]);}
 const upper=[pair(seeds.map(seed=>({team:teams[seed-1]??null})),'upper',1,0)];
 while(upper.at(-1)!.length>1)upper.push(pair(upper.at(-1)!.map(node=>ref(node)),'upper',upper.length+1,upper.length*2));
 let challenger=ref(upper[0][0],'loser');
 if(upper.length>1){
   let lower=pair(upper[0].map(node=>ref(node,'loser')),'lower',1,1);
   for(let index=1;index<upper.length;index++){
     const drops=[...upper[index]].reverse();
     lower=lower.map((node,i)=>add('lower',index*2,index*2+1,[ref(node),ref(drops[i],'loser')],i));
     if(lower.length>1)lower=pair(lower.map(node=>ref(node)),'lower',index*2+1,index*2+2);
   }
   challenger=ref(lower[0]);
 }
 const final=add('final',1,Math.max(...nodes.map(node=>node.week))+1,[ref(upper.at(-1)![0]),challenger]);
 if(rules.grandFinal==='reset')add('reset',1,final.week+1,[ref(final,'loser'),ref(final)]);
 return {rules,nodes};
}

export function progressDoubleElimination(edition:Competition){
 const bracket=edition.doubleElimination!;
 const outcomes=new Map<string,Outcome>();
 const games=new Map(edition.fixtures.map(game=>[game.id,game]));
 const resolve=(source:Source)=>'team' in source?{team:source.team,day:edition.startDay-7}:
   outcomes.has(source.node)?{team:outcomes.get(source.node)![source.result],day:outcomes.get(source.node)!.day}:undefined;
 const eliminated:string[]=[];
 let decisive:Outcome|undefined;
 for(const node of bracket.nodes){
   const [home,away]=node.sources.map(resolve);
   if(!home||!away)continue;
   const prior=outcomes.get('final-1-0');
   if(node.lane==='reset'&&(!prior||decisive))continue;
   const id=edition.id+':'+node.id;
   const day=Math.max((edition.bracketStartDay??edition.startDay)+node.week*7,home.day+7,away.day+7,node.lane==='reset'?(prior?.day??0)+7:0);
   const game=games.get(id);
   let outcome:Outcome;
   if(!home.team||!away.team){
     outcome={winner:home.team??away.team,loser:null,day:Math.max(home.day,away.day)};
   }else if(game?.result){
     outcome={winner:game.result.winner,loser:game.result.winner===home.team?away.team:home.team,day:game.result.completedDay};
   }else{
     if(!game){
       const phase:Fixture['phase']=node.lane==='final'||node.lane==='reset'?'final':node.round===1?'quarterfinal':'semifinal';
       edition.fixtures.push({id,competitionId:edition.id,season:edition.season,day,home:home.team,away:away.team,phase,round:node.round,
         bestOf:node.bestOf,status:'scheduled',result:null});
       edition.endDay=Math.max(edition.endDay,day);
     }
     continue;
   }
   outcomes.set(node.id,outcome);
   if(node.lane==='lower'&&outcome.loser)eliminated.push(outcome.loser);
   if(node.lane==='reset'||node.lane==='final'&&(bracket.rules.grandFinal==='single'||outcome.winner===home.team))decisive=outcome;
 }
 if(decisive?.winner&&decisive.loser){
   edition.champion=decisive.winner;
   edition.endDay=decisive.day;
   const qualifying=[decisive.winner,decisive.loser,...eliminated.reverse()];
   edition.finalOrder=[...new Set([...qualifying,...edition.finalOrder])];
 }
}

export function addOpeningRound(edition:Competition,pairs:[string,string][],round:number,day:number,bestOf:BestOf){
 for(const [index,[home,away]] of pairs.entries()){
   edition.fixtures.push({id:edition.id+':opening:'+round+':'+index,competitionId:edition.id,season:edition.season,
     day,home,away,phase:'regular',round,bestOf,status:'scheduled',result:null});
 }
}

export function groupRound(groups:string[][],round:number):[string,string][]{
 return groups.flatMap(group=>{
   let circle:(string|null)[]=[...group];
   if(circle.length%2)circle.push(null);
   if(round>=circle.length)return [];
   for(let i=1;i<round;i++)circle=[circle[0],circle.at(-1)!,...circle.slice(1,-1)];
   return circle.slice(0,circle.length/2).flatMap((home,i):[string,string][]=>{
     const away=circle[circle.length-1-i];
     return home&&away?[round%2?[home,away]:[away,home]]:[];
   });
 });
}

export function swissPairs(order:string[],played:Pick<Fixture,'home'|'away'>[]):[string,string][]{
 if(order.length%2||new Set(order).size!==order.length)throw Error('O suíço exige número par de participantes únicos.');
 const seen=(a:string,b:string)=>played.some(game=>game.home===a&&game.away===b||game.home===b&&game.away===a);
 const pair=(pool:string[],permitted:number):[string,string][]|undefined=>{
   if(!pool.length)return [];
   const [home,...rest]=pool;
   for(const away of rest){
     const rematch=Number(seen(home,away));
     if(rematch>permitted)continue;
     const next=pair(rest.filter(team=>team!==away),permitted-rematch);
     if(next)return [[home,away],...next];
   }
 };
 for(let allowed=0;allowed<=order.length/2;allowed++){
   const result=pair(order,allowed);
   if(result)return result;
 }
 throw Error('Não foi possível formar os pares do suíço.');
}
