import {careerCreationVersion} from '../version.ts';
import type {Career} from './career.ts';
import type {Contract,Player} from './recruitment.ts';
import type {WorldCatalog} from './world.ts';
import type {Mode} from './attributes.ts';
import {countryRegions} from './countries.ts';
import {careerLineup,rivalLineup,matchStrength,simulateMatch,applyMatchConditions,type MatchSide,type MatchTeam,type MatchResult} from './matches.ts';
import {defaultIdentity} from './identity.ts';
import {eligibleMobaLineup,leagueMobaRegion,mobaImports,mobaRegion,regionalPolicies,type MobaRegion} from './moba-eligibility.ts';

export type Prestige='Regional'|'Internacional'|'Major';
export type CompetitionSetting={name:string;prize:number;reputationGain:number;finalBestOf:3|5};
export type CompetitionConfig=Record<string,CompetitionSetting>;
export type Participant=MatchTeam&{organization:string;strength:number;reputation:number};
export type SeriesResult={winner:string;score:[number,number];maps:MatchResult[];completedDay:number;administrative?:'ineligible-lineup'};
export type Fixture={id:string;competitionId:string;season:number;day:number;home:string;away:string;phase:'regular'|'quarterfinal'|'semifinal'|'final';round:number;bestOf:1|3|5;status:'scheduled'|'completed';result:SeriesResult|null};
export type Competition={id:string;key:string;name:string;region:string;mode:Mode;season:number;prestige:Prestige;prize:number;reputationGain:number;finalBestOf:3|5;
 format:'league'|'knockout';participants:Participant[];fixtures:Fixture[];champion:string|null;finalOrder:string[];startDay:number;endDay:number;importRegion?:MobaRegion};
export type Season={number:number;year:number;startDay:number;endDay:number;editions:Competition[];notices:string[];fpsRanking?:ReturnType<typeof competitiveFpsRanking>};
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
 return mobaRegion(country);
}
export function hashSeed(value:string){let seed=2166136261;for(const char of value)seed=Math.imul(seed^char.charCodeAt(0),16777619);return seed>>>0;}

export function generateSeason(career:Career,catalog:WorldCatalog,players:Player[],contracts:Contract[],number:number,startDay:number,settings=defaultCompetitionConfig,bonuses:Record<string,number>={},previous?:Season,enforceImports=false):Season{
 const config=validateCompetitionConfig(settings),mode=career.mode as Mode;
 const progression=career.createdVersion===careerCreationVersion&&!!career.entry;
 const entryId=career.entry?.leagueId;
 const elite=regionalLeague(career.country);
 const promoted=previous?.editions.some(e=>e.key===entryId&&e.champion==='career'||e.key===elite&&e.participants.some(p=>p.id==='career'));
 const ownSide:MatchSide={id:'career',name:career.name,code:career.code,logo:'',identity:career.identity??{...defaultIdentity,primary:career.color,symbol:career.symbol},lineup:careerLineup(players,contracts)};
 if(enforceImports&&mode==='MOBA'){
   const region=leagueMobaRegion(progression&&!promoted&&entryId?entryId:elite);
   if(mobaImports(ownSide.lineup,region)>regionalPolicies[region].limit)throw Error('A escalação MOBA supera o limite regional de dois importados. Ajuste os titulares antes da inscrição.');
 }
 const own:Participant={...ownSide,organization:'career',strength:matchStrength(ownSide,mode,career.day),reputation:Math.min(100,40+(bonuses.career??0))};
 // Only snapshots of team identity belong to participants, not duplicate player objects.
 delete (own as Partial<MatchSide>).lineup;
 const organizations=new Map(catalog.organizations.map(org=>[org.id,org]));
 const leagues=new Map(catalog.leagues.map(league=>[league.id,league]));
 const pools=catalog.teams.filter(team=>(!team.academy||(progression&&team.league===entryId))&&leagues.get(team.league)?.discipline===mode).flatMap(team=>{
   const org=organizations.get(team.organization);if(!org)return [];
   const lineup=enforceImports&&mode==='MOBA'
     ?eligibleMobaLineup(players.filter(player=>player.team===team.id).map(player=>({player,role:player.role,startDay:career.day})),leagueMobaRegion(team.league))
     :rivalLineup(players,team.id,mode,career.day);
   try{return [{id:team.id,name:team.name,code:org.code,logo:org.logo,organization:org.id,
     strength:matchStrength({id:team.id,name:team.name,code:org.code,logo:org.logo,lineup},mode,career.day),reputation:Math.min(100,org.reputation+(bonuses[org.id]??0))}];}catch{return [];}
 }).sort((a,b)=>(b.strength*.8+b.reputation*.2)-(a.strength*.8+a.reputation*.2)||a.id.localeCompare(b.id));
 const editions:Competition[]=[],notices:string[]=[];
 const fpsRanking=progression&&mode==='FPS'?competitiveFpsRanking(previous):undefined;
 const create=(key:string,participants:Participant[],prestige:Prestige,region:string,offset:number,format:'league'|'knockout')=>{
   const setting=config[key]??{name:leagues.get(key)!.name,prize:5000000,reputationGain:2,finalBestOf:5 as const},id='s'+number+':'+key;
   const competition:Competition={id,key,region,mode,season:number,prestige,...setting,format,participants,fixtures:[],champion:null,finalOrder:[],startDay:startDay+offset,endDay:startDay+offset};
   if(enforceImports&&mode==='MOBA')competition.importRegion=leagueMobaRegion(key);
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
     const include=elite===key&&(!progression||promoted);
     const count=candidates.length+(include?1:0)>=8?8:candidates.length+(include?1:0)>=6?6:0;
     if(!count){notices.push(config[key].name+': menos de seis equipes válidas.');continue;}
     candidates=candidates.slice(0,count-(include?1:0));if(include)candidates.push(own);
     create(key,candidates,'Regional',region,7,'league');
   }
   if(progression&&!editions.some(edition=>edition.participants.some(p=>p.id==='career'))){
     const entry=leagues.get(entryId??'');
     const seen=new Set<string>();
     const rivals=pools.filter(participant=>{
       const team=catalog.teams.find(t=>t.id===participant.id);
       if(team?.league!==entryId||participant.id===career.entry?.displacedTeamId||seen.has(participant.organization))return false;
       seen.add(participant.organization);
       return true;
     });
     if(entry?.discipline!=='MOBA'||entry.tier!==2||rivals.length<3)
       throw Error('Divisão inicial indisponível: faltam equipes elegíveis.');
     const size=Math.min(8,rivals.length+1);
     create(entry.id,[...rivals.slice(0,size-(size%2)-1),own],'Regional',countryRegions[career.country]??career.country,77,'league');
   }
 }else{
   const unique=pools.filter((p,index)=>pools.findIndex(other=>other.organization===p.organization)===index);
   const points=fpsRanking??[];
   const rank=new Map(points.map((row,index)=>[row.organization,index]));
   const catalogRank=new Map(catalog.teams.map(team=>[team.id,team.global_rank||Infinity]));
   const byRanking=(a:Participant,b:Participant)=>(rank.get(a.organization)??Infinity)-(rank.get(b.organization)??Infinity)||
     (catalogRank.get(a.id)??Infinity)-(catalogRank.get(b.id)??Infinity)||a.id.localeCompare(b.id);
   for(const [index,key] of ['cs_regional','cs_cologne','cs_league','cs_major'].entries()){
     if(progression){
       const local=unique.filter(p=>catalog.teams.find(t=>t.id===p.id)?.league===entryId);
       if(index===0&&local.length<7)throw Error('Circuito inicial indisponível: faltam equipes elegíveis na região.');
       const participants=index===0?[...local.sort((a,b)=>byRanking(b,a)).slice(0,7),own]:
         [...unique,...(rank.has('career')?[own]:[])].sort(byRanking).slice(0,8);
       if(participants.length<8){notices.push(config[key].name+': menos de oito equipes válidas.');continue;}
       create(key,participants,index===0?'Regional':index===3?'Major':'Internacional',index===0?(countryRegions[career.country]??career.country):'Global',7+index*56,'knockout');
       continue;
     }
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
 return {number,year:new Date(Date.UTC(2027,2,14+startDay)).getUTCFullYear(),startDay,endDay:Math.max(startDay,...editions.map(e=>e.endDay)),editions,notices,...(fpsRanking?{fpsRanking}:{})};
}

export function competitiveFpsRanking(previous?:Season){
 const points=new Map<string,number>();
 for(const edition of previous?.editions??[]){
   if(edition.mode!=='FPS'||edition.key==='cs_major'||!edition.champion)continue;
   edition.finalOrder.forEach((id,index)=>{
     const org=edition.participants.find(p=>p.id===id)?.organization;
     if(org)points.set(org,Math.max(points.get(org)??0,edition.participants.length-index));
   });
 }
 return [...points].map(([organization,points])=>({organization,points}))
   .sort((a,b)=>b.points-a.points||a.organization.localeCompare(b.organization));
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
   const updated=new Map(applyMatchConditions(current.flatMap(team=>team.lineup.map(s=>s.player)),result,false).map(player=>[player.id,player]));
   current=current.map(team=>({...team,lineup:team.lineup.map(slot=>({...slot,player:updated.get(slot.player.id)!}))})) as [MatchSide,MatchSide];
 }
 return {winner:teams[score[0]>score[1]?0:1].id,score,maps,completedDay:day};
}

export function isScheduledFixture(fixture:Fixture){
 return !fixture.result&&(fixture.status==='scheduled'||fixture.status===undefined);
}

export function pendingUserFixtures(season:Season|undefined){
 return (season?.editions??[]).flatMap(edition=>edition.fixtures
   .filter(fixture=>isScheduledFixture(fixture)&&(fixture.home==='career'||fixture.away==='career'))
   .map(fixture=>({edition,fixture})))
   .sort((a,b)=>a.fixture.day-b.fixture.day||a.fixture.id.localeCompare(b.fixture.id));
}

export function nextUserFixture(season:Season|undefined){
 return pendingUserFixtures(season)[0]?.fixture;
}

export function planCompetitionAdvance(season:Season|undefined,day:number,requested:number){
 const next=nextUserFixture(season);
 const days=next?Math.max(0,Math.min(requested,next.day-day)):requested;
 return {days,stoppedAt:next&&days<requested?next:undefined};
}

export function playCompetitionFixture(season:Season,fixtureId:string,day:number,teams:[MatchSide,MatchSide],seed:number){
 const edition=season.editions.find(e=>e.fixtures.some(g=>g.id===fixtureId)),game=edition?.fixtures.find(g=>g.id===fixtureId);
 if(!edition||!game)throw Error('Confronto não encontrado.');
 if(game.result||game.status==='completed')throw Error('Este confronto já foi concluído.');
 if(!isScheduledFixture(game))throw Error('Este confronto não está disponível.');
 if(day<game.day)throw Error('Avance até a data do confronto.');
 if(teams[0].id!==game.home||teams[1].id!==game.away)throw Error('Participantes incompatíveis com o confronto.');
 if(edition.mode==='MOBA'&&edition.importRegion&&teams.some(team=>mobaImports(team.lineup,edition.importRegion!)>regionalPolicies[edition.importRegion!].limit))
   throw Error('A escalação MOBA supera o limite regional de dois importados.');
 const unavailable=teams.map(team=>team.lineup.length!==5);
 let result:SeriesResult;
 if(edition.importRegion&&unavailable.some(Boolean)&&!teams.some((team,index)=>team.id==='career'&&unavailable[index])){
   const winner=unavailable[0]&&unavailable[1]
     ?teams.findIndex(team=>team.id===edition.participants.find(participant=>teams.some(side=>side.id===participant.id))?.id)
     :unavailable[0]?1:0;
   const score:[number,number]=[0,0];
   score[winner]=Math.floor(game.bestOf/2)+1;
   result={winner:teams[winner].id,score,maps:[],completedDay:day,administrative:'ineligible-lineup'};
 }else result=simulateSeries(teams,edition.mode,day,game.bestOf,hashSeed(seed+':'+game.id));
 game.result=result;game.status='completed';progressBracket(edition);return result;
}
