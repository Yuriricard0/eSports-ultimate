import {analyzeRoles,recentTrend} from './player-analysis.ts';
import {roles,type Mode} from './attributes.ts';
import {rankedStats} from './ranked.ts';
import type {Player} from './recruitment.ts';

export const talentSchema=`
CREATE TABLE IF NOT EXISTS web_ranked_watch (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,player_id INTEGER NOT NULL,
 active INTEGER NOT NULL CHECK(active IN (0,1)),PRIMARY KEY(career_id,player_id)
);
CREATE TABLE IF NOT EXISTS web_ranked_history (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,player_id INTEGER NOT NULL,
 day INTEGER NOT NULL,position INTEGER NOT NULL,points INTEGER NOT NULL,
 PRIMARY KEY(career_id,player_id,day)
);`;
export type RankedObservation={player_id:number;day:number;position:number;points:number};
export function observeRanked(players:Player[],ids:ReadonlySet<number>,day:number):RankedObservation[]{
 if(!ids.size)return [];
 return Object.keys(roles).flatMap(mode=>players.filter(player=>player.mode===mode&&player.status==='ranked')
   .map(player=>({id:player.id,points:rankedStats(player).points}))
   .sort((a,b)=>b.points-a.points||a.id-b.id)
   .flatMap(({id,points},index)=>ids.has(id)?[{player_id:id,day,position:index+1,points}]:[]));
}

export function promotionRecommendation(player:Player,main:Player[],day:number){
 const mode=player.mode as Mode;
 const analysis=roles[mode]?.includes(player.role)?analyzeRoles(player.attributes,mode,player.role):null;
 const cover=main.filter(peer=>peer.mode===mode&&peer.role===player.role&&!peer.status);
 const peerRating=cover.length?Math.max(...cover.map(peer=>analyzeRoles(peer.attributes,mode,peer.role)?.rating??peer.overall)):null;
 const form=recentTrend(player.developmentHistory,player.overall,day);
 const value=(attribute:string)=>{
   const current=player.attributes[mode.toLowerCase()+'_'+attribute];
   return Number.isFinite(current)&&current>=1&&current<=100?current:null;
 };
 const consistency=value('consistency'),adaptation=value('adaptation');
 const roleFit=!!analysis&&analysis.roles[0].rating-analysis.rating<=3;
 const roleCovered=peerRating!==null&&cover.length>=2;
 const close=!!analysis&&(peerRating===null||analysis.rating>=peerRating-5);
 const momentum=form!==null&&form.change>=0.25;
 const ready=roleFit&&close&&momentum&&consistency!==null&&consistency>=60&&adaptation!==null&&adaptation>=55&&(!roleCovered||analysis!.rating>=peerRating!);
 const evaluate=roleFit&&close&&(momentum||!roleCovered)&&(form===null||form.change>=-0.25)&&
   (consistency===null||consistency>=45)&&(adaptation===null||adaptation>=45);
 const label=ready?'Pronto para promoção':evaluate?'Avaliar com o elenco principal':'Continuar desenvolvimento';
 return {label,reasons:[
   form?`Evolução em ${form.days} dias: ${form.change.toLocaleString('pt-BR',{signDisplay:'always',maximumFractionDigits:2})} OVR.`:'Ainda não há um registro de evolução de 30 a 90 dias.',
   analysis?(roleFit?'A função atual está entre as mais adequadas pelos atributos conhecidos.':'Os atributos conhecidos indicam melhor adequação a outra função.'):'Atributos incompletos para avaliar a função.',
   `Consistência técnica ${consistency??'indisponível'} · Adaptação técnica ${adaptation??'indisponível'}.`,
   peerRating===null?'O elenco principal tem uma vaga nesta função.':`Elenco principal: ${cover.length} atleta(s) na função · melhor referência técnica ${peerRating.toLocaleString('pt-BR',{maximumFractionDigits:1})}.`,
 ]};
}
