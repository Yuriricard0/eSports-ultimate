import {athleteAge} from './development.ts';
import type {Player} from './recruitment.ts';
import type {PerkInstance} from './traits.ts';

export const personalObjectiveNames={titles:'Conquistar títulos',recognition:'Ganhar reconhecimento',stability:'Buscar estabilidade profissional'};
export type PersonalObjective=keyof typeof personalObjectiveNames;
export type PerkInfluence={day:number;perkId:string;metric:'strength'|'morale'|'fatigue';delta:number;result:'win'|'loss'};

export function withPersonalObjective(player:Player,day:number):Player{
 if(player.personalObjective)return player;
 const age=athleteAge(player.birthDay,day);
 const experienced=!!player.team||!!player.organization||player.history?.some(event=>event.day<=day);
 const personalObjective=player.personality==='ambitious'&&experienced?'titles':
   player.personality==='methodical'||age>=27?'stability':
   player.personality==='ambitious'||age<=21?'recognition':experienced?'titles':'stability';
 return {...player,personalObjective};
}

export function publicPerkInfluences(history:PerkInfluence[]|undefined,visible:PerkInstance[]){
 return (history??[]).filter(effect=>visible.some(perk=>perk.known&&perk.id===effect.perkId));
}
