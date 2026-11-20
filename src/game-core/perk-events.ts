import {incompatible} from './perk-data.ts';
import {qualifiesForPerk} from './traits.ts';
import type {Player} from './recruitment.ts';

const rules=[
  ['new_team','moves',1,'versatile','acquired',0.04],
  ['adaptation','shared_days',30,'change_resistant','removed',0.18],
  ['adaptation','shared_days',60,'versatile','acquired',0.12],
  ['defeats','streak',5,'tilted','acquired',0.12],
  ['comeback','pressure_wins',3,'fragile_pressure','removed',0.18],
  ['comeback','pressure_wins',3,'cold_blood','acquired',0.10],
  ['discipline','incidents',3,'undisciplined','acquired',0.15],
  ['professional_growth','practice_days',60,'undisciplined','removed',0.20],
  ['professional_growth','practice_days',60,'fast_learner','acquired',0.10],
  ['finals','appearances',3,'stage_player','acquired',0.12],
  ['rivalry','appearances',3,'rivalry_specialist','acquired',0.10],
  ['decisive_growth','decisive_games',5,'decisive','intensified',0.16],
] as const;
type EventKind=typeof rules[number][0];
const fallback={discipline:60,professionalism:60,ambition:60};

export function applyPerkEvent(player:Player,event:{id:string;kind:EventKind;day:number;metrics:Record<string,number>},seed:number):Player{
  if(player.status==='retired'||player.perkEvents?.includes(event.id))return player;
  const matching=rules.filter(([kind,metric,minimum])=>kind===event.kind&&event.metrics[metric]>=minimum&&
    // Each adaptation threshold is a separate event.
    (kind!=='adaptation'||event.metrics[metric]===minimum));
  if(!matching.length)return player;
  const marked={...player,perkEvents:[...(player.perkEvents??[]),event.id]};
  if((player.perkHistory?.at(-1)?.day??-1000)>event.day-30)return marked;
  const perks=player.perks??[];
  let randomState=seed^player.id^event.day;
  for(const [,, ,id,action,chance] of matching){
    const roll=(Math.imul(randomState,1597334677)>>>0)/4294967296;
    randomState+=1;
    if(roll>=chance)continue;
    const present=perks.find(perk=>perk.id===id);
    if(action==='acquired'){
      const conflict=incompatible.some(pair=>pair.includes(id)&&perks.some(perk=>pair.includes(perk.id)));
      if(present||conflict||perks.length>=3||!qualifiesForPerk(id,player,player.personality??'balanced',player.temperament??fallback))continue;
    }else if(!present||(action==='intensified'&&present.intensity>=1))continue;
    const updated=action==='removed'?perks.filter(perk=>perk.id!==id):action==='acquired'?
      [...perks,{id,known:true,intensity:0.6}]:perks.map(perk=>perk.id===id?{...perk,intensity:Math.min(1,Math.round((perk.intensity+0.1)*100)/100)}:perk);
    return {...marked,perks:updated,perkHistory:[...(player.perkHistory??[]),{day:event.day,id,action}]};
  }
  return marked;
}
