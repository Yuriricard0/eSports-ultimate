import type {Career} from './career.ts';
import type {Contract,Player} from './recruitment.ts';
import type {WorldCatalog} from './world.ts';
import type {Mode} from './attributes.ts';
import {countryRegions} from './countries.ts';
import {careerLineup,rivalLineup,matchStrength,simulateMatch,applyMatchConditions,type MatchSide,type MatchTeam,type MatchResult} from './matches.ts';
import {defaultIdentity} from './identity.ts';

export type Prestige='Regional'|'Internacional'|'Major';
export type CompetitionSetting={name:string;prize:number;reputationGain:number;finalBestOf:3|5};
export type CompetitionConfig=Record<string,CompetitionSetting>;
export type Participant=MatchTeam&{organization:string;strength:number;reputation:number};
export type SeriesResult={winner:string;score:[number,number];maps:MatchResult[];completedDay:number};
export type Fixture={id:string;competitionId:string;season:number;day:number;home:string;away:string;phase:'regular'|'quarterfinal'|'semifinal'|'final';round:number;bestOf:1|3|5;status:'scheduled'|'completed';result:SeriesResult|null};
export type Competition={id:string;key:string;name:string;region:string;mode:Mode;season:number;prestige:Prestige;prize:number;reputationGain:number;finalBestOf:3|5;
 format:'league'|'knockout';participants:Participant[];fixtures:Fixture[];champion:string|null;finalOrder:string[];startDay:number;endDay:number};
export type Season={number:number;year:number;startDay:number;endDay:number;editions:Competition[];notices:string[]};
export type Standing={team:string;played:number;wins:number;losses:number;difference:number};
const mobaRegions:Record<string,string>={cblol:'Brasil',lcs:'América do Norte',lec:'Europa',lck:'Coreia do Sul',lpl:'China',lcp:'Ásia-Pacífico'};
export const defaultCompetitionConfig:CompetitionConfig=Object.fromEntries([
 ...Object.entries(mobaRegions).map(([key,region])=>[key,{name:'Liga '+region,prize:25000000,reputationGain:5,finalBestOf:5}]),
 ['cs_regional',{name:'Circuito Regional CS2',prize:15000000,reputationGain:3,finalBestOf:3}],
 ['cs_cologne',{name:'Masters de Colônia',prize:40000000,reputationGain:6,finalBestOf:5}],
 ['cs_league',{name:'Liga Internacional CS2',prize:40000000,reputationGain:6,finalBestOf:3}],
 ['cs_major',{name:'Major de Counter-Strike',prize:80000000,reputationGain:10,finalBestOf:5}],
]) as CompetitionConfig;

export function validateCompetitionConfig(input:unknown):CompetitionConfig{
 if(!input||typeof input!=='object')throw Error('Configuração de competição inválida.');
 const result:CompetitionConfig={};
 for(const key of Object.keys(defaultCompetitionConfig)){
   const row=(input as CompetitionConfig)[key];
   if(!row||typeof row.name!=='string'||!row.name.trim()||row.name.trim().length>80||!Number.isSafeInteger(row.prize)||row.prize<0||row.prize>100000000||
     !Number.isInteger(row.reputationGain)||row.reputationGain<0||row.reputationGain>15||![3,5].includes(row.finalBestOf)||(key in mobaRegions&&row.finalBestOf!==5))throw Error('Confira nome, premiação, reputação e formato da final.');
   result[key]={name:row.name.trim(),prize:row.prize,reputationGain:row.reputationGain,finalBestOf:row.finalBestOf};
 }
 return result;
}
export function regionalLeague(country:string){
 if(country==='KR')return 'lck';if(country==='CN')return 'lpl';
 const region=countryRegions[country];
 if(country==='BR'||region==='América do Sul')return 'cblol';
 if(region==='América do Norte')return 'lcs';
 return region==='Ásia'||region==='Oceania'?'lcp':'lec';
}
export function hashSeed(value:string){let seed=2166136261;for(const char of value)seed=Math.imul(seed^char.charCodeAt(0),16777619);return seed>>>0;}

export function generateSeason(career:Career,catalog:WorldCatalog,players:Player[],contracts:Contract[],number:number,startDay:number,settings=defaultCompetitionConfig,bonuses:Record<string,number>={}):Season{
 const config=validateCompetitionConfig(settings),mode=career.mode as Mode;
 const ownSide:MatchSide={id:'career',name:career.name,code:career.code,logo:'',identity:career.identity??{...defaultIdentity,primary:career.color,symbol:career.symbol},lineup:careerLineup(players,contracts)};
 const own:Participant={...ownSide,organization:'career',strength:matchStrength(ownSide,mode,career.day),reputation:Math.min(100,40+(bonuses.career??0))};
 // Only snapshots of team identity belong to participants, not duplicate player objects.
 delete (own as Partial<MatchSide>).lineup;
 const organizations=new Map(catalog.organizations.map(org=>[org.id,org]));
 const leagues=new Map(catalog.leagues.map(league=>[league.id,league]));
 const pools=catalog.teams.filter(team=>!team.academy&&leagues.get(team.league)?.discipline===mode).flatMap(team=>{
   const org=organizations.get(team.organization);if(!org)return [];
   const lineup=rivalLineup(players,team.id,mode,career.day);
   try{return [{id:team.id,name:team.name,code:org.code,logo:org.logo,organization:org.id,
     strength:matchStrength({id:team.id,name:team.name,code:org.code,logo:org.logo,lineup},mode,career.day),reputation:Math.min(100,org.reputation+(bonuses[org.id]??0))}];}catch{return [];}
 }).sort((a,b)=>(b.strength*.8+b.reputation*.2)-(a.strength*.8+a.reputation*.2)||a.id.localeCompare(b.id));
 const editions:Competition[]=[],notices:string[]=[];
 const create=(key:string,participants:Participant[],prestige:Prestige,region:string,offset:number,format:'league'|'knockout')=>{
   const setting=config[key],id='s'+number+':'+key;
   const competition:Competition={id,key,region,mode,season:number,prestige,...setting,format,participants,fixtures:[],champion:null,finalOrder:[],startDay:startDay+offset,endDay:startDay+offset};
   const add=(home:string,away:string,round:number,phase:Fixture['phase'],day:number,bestOf:1|3|5)=>competition.fixtures.push({id:id+':'+phase+':'+competition.fixtures.length,competitionId:id,season:number,home,away,round,phase,day,bestOf,status:'scheduled',result:null});
   if(format==='league'){
     let circle=participants.map(p=>p.id);
     for(let round=0;round<circle.length-1;round++){
       for(let index=0;index<circle.length/2;index++){
         const [a,b]=[circle[index],circle[circle.length-1-index]];add(round%2?a:b,round%2?b:a,round+1,'regular',startDay+offset+round*7,1);
       }
       circle=[circle[0],circle.at(-1)!,...circle.slice(1,-1)];
     }
     competition.endDay=startDay+offset+(participants.length-2)*7+14;
   }else{
     for(let i=0;i<4;i++)add(participants[i].id,participants[7-i].id,1,'quarterfinal',startDay+offset,3);
     competition.endDay=startDay+offset+14;
   }
   editions.push(competition);
 };
 if(mode==='MOBA'){
   for(const [key,region] of Object.entries(mobaRegions)){
     const seen=new Set<string>();
     let candidates=pools.filter(p=>catalog.teams.find(t=>t.id===p.id)?.league===key).filter(p=>{if(seen.has(p.organization))return false;seen.add(p.organization);return true;});
     const include=regionalLeague(career.country)===key;
     const count=candidates.length+(include?1:0)>=8?8:candidates.length+(include?1:0)>=6?6:0;
     if(!count){notices.push(config[key].name+': menos de seis equipes válidas.');continue;}
     candidates=candidates.slice(0,count-(include?1:0));if(include)candidates.push(own);
     create(key,candidates,'Regional',region,7,'league');
   }
 }else{
   const unique=pools.filter((p,index)=>pools.findIndex(other=>other.organization===p.organization)===index);
   for(const [index,key] of ['cs_regional','cs_cologne','cs_league','cs_major'].entries()){
     let candidates=unique;
     if(index===0){const region=countryRegions[career.country];const local=unique.filter(p=>countryRegions[organizations.get(p.organization)!.country]===region);if(local.length>=7)candidates=local;}
     if(candidates.length<7){notices.push(config[key].name+': menos de oito equipes válidas.');continue;}
     const selected:Participant[]=[];
     if(index>0){for(const region of [...new Set(candidates.map(p=>countryRegions[organizations.get(p.organization)!.country]))]){
       const pick=candidates.find(p=>countryRegions[organizations.get(p.organization)!.country]===region);if(pick&&selected.length<7)selected.push(pick);
     }}
     for(const p of candidates){if(selected.length===7)break;if(!selected.some(other=>other.id===p.id))selected.push(p);}
     create(key,[...selected,own],index===0?'Regional':index===3?'Major':'Internacional',index===0?(countryRegions[career.country]??career.country):'Global',7+index*56,'knockout');
   }
 }
 return {number,year:new Date(Date.UTC(2027,2,14+startDay)).getUTCFullYear(),startDay,endDay:Math.max(startDay,...editions.map(e=>e.endDay)),editions,notices};
}

export function standings(edition:Competition):Standing[]{
 const rows=edition.participants.map(p=>({team:p.id,played:0,wins:0,losses:0,difference:0}));
 for(const game of edition.fixtures.filter(g=>g.phase==='regular'&&g.result)){
   const home=rows.find(r=>r.team===game.home)!,away=rows.find(r=>r.team===game.away)!;
   home.played++;away.played++;const diff=game.result!.score[0]-game.result!.score[1];home.difference+=diff;away.difference-=diff;
   const winner=game.result!.winner===home.team?home:away,loser=winner===home?away:home;winner.wins++;loser.losses++;
 }
 const tiePoints=(row:Standing)=>edition.fixtures.filter(g=>g.phase==='regular'&&g.result?.winner===row.team&&
   rows.some(other=>other.team===(g.home===row.team?g.away:g.home)&&other.wins===row.wins&&other.difference===row.difference)).length;
 return rows.sort((a,b)=>b.wins-a.wins||b.difference-a.difference||tiePoints(b)-tiePoints(a)||a.team.localeCompare(b.team));
}

export function progressBracket(edition:Competition){
 if(edition.champion)return;
 const games=edition.fixtures,final=games.find(g=>g.phase==='final');
 if(final?.result){
   edition.champion=final.result.winner;
   const loser=final.home===edition.champion?final.away:final.home;
   const other=edition.format==='league'?standings(edition).map(r=>r.team):
     [...games].reverse().flatMap(g=>g.result?[g.home===g.result.winner?g.away:g.home]:[]);
   edition.finalOrder=[edition.champion,loser,...other.filter((id,index)=>id!==edition.champion&&id!==loser&&other.indexOf(id)===index)];return;
 }
 const phases=edition.format==='league'?['regular','semifinal','final'] as const:['quarterfinal','semifinal','final'] as const;
 for(let index=0;index<2;index++){
   const previous=games.filter(g=>g.phase===phases[index]);
   if(!previous.length||previous.some(g=>!g.result)||games.some(g=>g.phase===phases[index+1]))continue;
   const ids=phases[index]==='regular'?standings(edition).slice(0,4).map(r=>r.team):previous.map(g=>g.result!.winner);
   const next=phases[index+1],pairs=next==='final'?[[ids[0],ids[1]]]:phases[index]==='regular'?[[ids[0],ids[3]],[ids[1],ids[2]]]:[[ids[0],ids[1]],[ids[2],ids[3]]];
   const day=Math.max(...previous.map(g=>g.day))+7;
   pairs.forEach(([home,away],pair)=>games.push({id:edition.id+':'+next+':'+pair,competitionId:edition.id,season:edition.season,home,away,day,phase:next,round:index+2,bestOf:next==='final'?edition.finalBestOf:3,status:'scheduled',result:null}));
 }
}

export function simulateSeries(teams:[MatchSide,MatchSide],mode:Mode,day:number,bestOf:1|3|5,seed:number):SeriesResult{
 if(![1,3,5].includes(bestOf))throw Error('Formato de série inválido.');
 let current=teams;const score:[number,number]=[0,0],maps:MatchResult[]=[];
 while(Math.max(...score)<Math.ceil(bestOf/2)){
   const result=simulateMatch(mode,day,current,hashSeed(seed+':'+maps.length));maps.push(result);score[result.winner]++;
   const updated=new Map(applyMatchConditions(current.flatMap(team=>team.lineup.map(s=>s.player)),result).map(player=>[player.id,player]));
   current=current.map(team=>({...team,lineup:team.lineup.map(slot=>({...slot,player:updated.get(slot.player.id)!}))})) as [MatchSide,MatchSide];
 }
 return {winner:teams[score[0]>score[1]?0:1].id,score,maps,completedDay:day};
}

export function nextUserFixture(season:Season|undefined){
 return season?.editions.flatMap(e=>e.fixtures).filter(g=>!g.result&&(g.home==='career'||g.away==='career')).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id))[0];
}

export function playCompetitionFixture(season:Season,fixtureId:string,day:number,teams:[MatchSide,MatchSide],seed:number){
 const edition=season.editions.find(e=>e.fixtures.some(g=>g.id===fixtureId)),game=edition?.fixtures.find(g=>g.id===fixtureId);
 if(!edition||!game)throw Error('Confronto não encontrado.');
 if(game.result)throw Error('Este confronto já foi concluído.');
 if(day<game.day)throw Error('Avance até a data do confronto.');
 if(teams[0].id!==game.home||teams[1].id!==game.away)throw Error('Participantes incompatíveis com o confronto.');
 const result=simulateSeries(teams,edition.mode,day,game.bestOf,hashSeed(seed+':'+game.id));
 game.result=result;game.status='completed';progressBracket(edition);return result;
}
