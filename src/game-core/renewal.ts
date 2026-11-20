import {athleteAge} from './development.ts';
import {fillRankedCoverage} from './generation.ts';
import {applyPerkEvent} from './perk-events.ts';
import type {Player} from './recruitment.ts';

type Tenure={player_id:number;start_day:number;end_day:number};
const initial=Date.UTC(2027,2,15);
const dayMs=86_400_000;
export function seasonBoundaries(from:number,to:number){
  const last=new Date(initial+(to-1)*dayMs).getUTCFullYear();
  const first=new Date(initial+(from-1)*dayMs).getUTCFullYear();
  const boundaries:number[]=[];
  for(let year=Math.max(2028,first);year<=last;year++){
    const day=1+(Date.UTC(year,2,15)-initial)/dayMs;
    if(day>from&&day<=to)boundaries.push(day);
  }
  return boundaries;
}

export function renewWorld(players:Player[],seed:number,day:number,contracts:Tenure[],canHire?:(organization:string,player:Player)=>boolean){
  const protectedIds=new Set(contracts.filter(contract=>contract.start_day<=day&&contract.end_day>=day).map(contract=>contract.player_id));
  const available=players.filter(player=>!player.team&&!player.organization&&player.status!=='retired'&&!protectedIds.has(player.id)&&
    athleteAge(player.birthDay,day)>=18&&athleteAge(player.birthDay,day)<=24);
  const taken=new Set<number>();
  const replacements=new Map<number,Player>();
  const retiringRivals=new Set<number>();
  for(const veteran of players){
    if(!veteran.team||protectedIds.has(veteran.id)||athleteAge(veteran.birthDay,day)<35)continue;
    const pick=available.filter(player=>player.mode===veteran.mode&&player.role===veteran.role&&!taken.has(player.id))
      .sort((a,b)=>Number(b.country===veteran.country)-Number(a.country===veteran.country)||b.overall-a.overall||a.id-b.id)
      .find(player=>!canHire||canHire(veteran.organization!,player));
    if(!pick)continue;
    taken.add(pick.id);
    retiringRivals.add(veteran.id);
    replacements.set(pick.id,{...pick,team:veteran.team,organization:veteran.organization,status:undefined,
      history:[{day,description:'Entrou no elenco rival na renovação anual.'},...(pick.history??[])]});
  }
  const updated=players.map((player):Player=>{
    const replacement=replacements.get(player.id);
    if(replacement)return replacement;
    if(retiringRivals.has(player.id))return {...player,team:null,organization:null,status:'retired',retiredDay:day,
      history:[{day,description:'Encerrou a carreira no elenco rival.'},...(player.history??[])]};
    if(player.team||player.status==='retired'||protectedIds.has(player.id))return player;
    const age=athleteAge(player.birthDay,day);
    if(age>=35)return {...player,status:'retired',retiredDay:day};
    if(player.status==='ranked'&&age>=22)return {...player,status:undefined};
    return player;
  });
  return fillRankedCoverage(updated,seed^day,day,3);
}

export function applyAdaptation(player:Player,contract:Tenure,day:number,seed:number):Player {
  const days=day-contract.start_day;
  if(![30,60].includes(days)||day>contract.end_day)return player;
  return applyPerkEvent(player,{id:contract.start_day+':'+days,kind:'adaptation',day,metrics:{shared_days:days}},seed);
}
