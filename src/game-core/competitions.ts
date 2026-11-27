import {careerCreationVersion} from '../version.ts';
import type {Career} from './career.ts';
import type {Contract,Player} from './recruitment.ts';
import type {WorldCatalog} from './world.ts';
import type {Mode} from './attributes.ts';
import {countryRegions} from './countries.ts';
import {careerLineup,rivalLineup,matchStrength,simulateMatch,applyMatchConditions,type MatchSide,type MatchTeam,type MatchResult,type MatchOptions} from './matches.ts';
import {seriesMaps} from './match-tactics.ts';
import {defaultIdentity} from './identity.ts';
import {exchangeRegionalSlots,regionalPyramid,schedulePermanence,type Pyramid} from './competition-pyramid.ts';
import {eligibleMobaLineup,leagueMobaRegion,mobaImports,mobaRegion,regionalPolicies,type MobaRegion} from './moba-eligibility.ts';
import {buildCompetitionRankings,worldRegionalSlots} from './competition-rankings.ts';
import type {Championship} from './competition-history.ts';
import {addOpeningRound,createDoubleElimination,groupRound,progressDoubleElimination,swissPairs,type BestOf,type DoubleElimination,type DoubleRules,type OpeningStage} from './competition-formats.ts';

export type Prestige='Regional'|'Internacional'|'Major';
export type StageRules={opening:BestOf;upper:BestOf;lower:BestOf;grandFinal:'reset'|'single';groups:2|4;groupAdvance:1|2;swissRounds:3|4|5;swissAdvance:4|8;tieBreak:'head-to-head'|'opponent-wins';seeding:'ranked'|'draw';regionalSlots:'fixed'|'prestige'};
export type CompetitionSetting={name:string;prize:number;reputationGain:number;finalBestOf:3|5;stageRules?:StageRules};
export type CompetitionConfig=Record<string,CompetitionSetting>;
export type Participant=MatchTeam&{organization:string;strength:number;reputation:number};
export type SeriesResult={winner:string;score:[number,number];maps:MatchResult[];completedDay:number;administrative?:'ineligible-lineup'};
export type Fixture={id:string;competitionId:string;season:number;day:number;home:string;away:string;phase:'regular'|'quarterfinal'|'semifinal'|'final';round:number;bestOf:1|3|5;status:'scheduled'|'completed';result:SeriesResult|null;split?:number};
type LeagueFormat={capacity:number;regularSeries:readonly (1|3)[];splits:1|2};
type EntryWindow={opens:number;closes:number;eligible:boolean;requirement:string};
export type Competition={id:string;key:string;name:string;region:string;mode:Mode;season:number;prestige:Prestige;prize:number;reputationGain:number;finalBestOf:3|5;
 format:'league'|'knockout';participants:Participant[];fixtures:Fixture[];champion:string|null;finalOrder:string[];startDay:number;endDay:number;importRegion?:MobaRegion;leagueFormat?:LeagueFormat;entryWindow?:EntryWindow;qualifierSource?:string;qualifierTarget?:string;
 openingStage?:OpeningStage;doubleElimination?:DoubleElimination;bracketStartDay?:number;internationalSources?:string[];internationalSlots?:Record<string,number>;qualification?:string;stageRules?:StageRules;registration?:{closes:number;players:number[]};championship?:Championship};
export type Season={number:number;year:number;startDay:number;endDay:number;editions:Competition[];notices:string[];fpsRanking?:ReturnType<typeof competitiveFpsRanking>;pyramid?:Pyramid;rosterRegistration?:true};
export type Standing={team:string;played:number;wins:number;losses:number;difference:number};
const mobaRegions:Record<string,string>={cblol:'Brasil',lcs:'América do Norte',lec:'Europa',lck:'Coreia do Sul',lpl:'China',lcp:'Ásia-Pacífico'};
const standardLeague:LeagueFormat={capacity:8,regularSeries:[1],splits:1};
const regionalFormats:Partial<Record<string,LeagueFormat>>={
 lec:{capacity:8,regularSeries:[1],splits:2},
 lck:{capacity:8,regularSeries:[3],splits:1},
 lpl:{capacity:12,regularSeries:[1,3],splits:1},
};
const additionalEvents:CompetitionConfig={
 br_cup:{name:'Copa do Brasil',prize:9000000,reputationGain:3,finalBestOf:5},
 na_challenger:{name:'Classificatória Norte-Americana',prize:5000000,reputationGain:2,finalBestOf:3},
 na_cup:{name:'Copa Norte-Americana',prize:9000000,reputationGain:3,finalBestOf:5},
 cs_closed:{name:'Classificatória fechada CS2',prize:12000000,reputationGain:2,finalBestOf:3},
 moba_world:{name:'Mundial de MOBA',prize:100000000,reputationGain:12,finalBestOf:5},
 cs_interregional:{name:'Copa Inter-regional CS2',prize:55000000,reputationGain:7,finalBestOf:5},
};
const doubleRules:DoubleRules={upper:3,lower:3,final:5,grandFinal:'reset'};
const stageDefaults:StageRules={opening:3,upper:3,lower:3,grandFinal:'reset',groups:2,groupAdvance:2,swissRounds:3,swissAdvance:8,tieBreak:'head-to-head',seeding:'ranked',regionalSlots:'fixed'};
export const defaultCompetitionConfig:CompetitionConfig=Object.fromEntries([
 ...Object.entries(mobaRegions).map(([key,region])=>[key,{name:'Liga '+region,prize:25000000,reputationGain:5,finalBestOf:5}]),
 ['cs_regional',{name:'Circuito Regional CS2',prize:15000000,reputationGain:3,finalBestOf:3}],
 ['cs_cologne',{name:'Masters de Colônia',prize:40000000,reputationGain:6,finalBestOf:5}],
 ['cs_league',{name:'Liga Internacional CS2',prize:40000000,reputationGain:6,finalBestOf:3}],
 ['cs_major',{name:'Major de Counter-Strike',prize:80000000,reputationGain:10,finalBestOf:5,stageRules:stageDefaults}],
 ['moba_world',{...additionalEvents.moba_world,stageRules:stageDefaults}],
 ['cs_interregional',{...additionalEvents.cs_interregional,stageRules:{...stageDefaults,opening:1,tieBreak:'opponent-wins'}}],
]) as CompetitionConfig;

export function validateCompetitionConfig(input:unknown):CompetitionConfig{
 if(!input||typeof input!=='object')throw Error('Configuração de competição inválida.');
 const result:CompetitionConfig={};
 for(const key of Object.keys(defaultCompetitionConfig)){
   const defaults=defaultCompetitionConfig[key];
   const row=(input as CompetitionConfig)[key]??(key==='moba_world'||key==='cs_interregional'?defaults:undefined);
   if(!row||typeof row.name!=='string'||!row.name.trim()||row.name.trim().length>80||!Number.isSafeInteger(row.prize)||row.prize<0||row.prize>100000000||
     !Number.isInteger(row.reputationGain)||row.reputationGain<0||row.reputationGain>15||![3,5].includes(row.finalBestOf)||(key in mobaRegions&&row.finalBestOf!==5))throw Error('Confira nome, premiação, reputação e formato da final.');
   result[key]={name:row.name.trim(),prize:row.prize,reputationGain:row.reputationGain,finalBestOf:row.finalBestOf};
   if(defaults.stageRules){
     const rules={...defaults.stageRules,...row.stageRules};
     if(![rules.opening,rules.upper,rules.lower].every(value=>[1,3,5].includes(value))||![2,4].includes(rules.groups)||![1,2].includes(rules.groupAdvance)||
       ![3,4,5].includes(rules.swissRounds)||![4,8].includes(rules.swissAdvance)||!['reset','single'].includes(rules.grandFinal)||
       !['head-to-head','opponent-wins'].includes(rules.tieBreak)||!['ranked','draw'].includes(rules.seeding)||!['fixed','prestige'].includes(rules.regionalSlots))throw Error('Confira as regras das etapas e da grande final.');
     result[key].stageRules=rules;
   }
 }
 return result;
}
export function regionalLeague(country:string){
 return mobaRegion(country);
}
export function hashSeed(value:string){let seed=2166136261;for(const char of value)seed=Math.imul(seed^char.charCodeAt(0),16777619);return seed>>>0;}

function seedKnockout(edition:Competition){
 edition.fixtures=Array.from({length:4},(_,index)=>({
   id:edition.id+':quarterfinal:'+index,competitionId:edition.id,season:edition.season,home:edition.participants[index].id,
   away:edition.participants[7-index].id,round:1,phase:'quarterfinal',day:edition.startDay,bestOf:3,status:'scheduled',result:null,
 }));
}

export function optionalEventDays(edition:Competition){
 return [edition.startDay,edition.startDay+7,edition.endDay];
}

export function optionalEventConflicts(season:Pick<Season,'editions'>,event:Competition,organization='career'){
 const days=optionalEventDays(event);
 return season.editions.filter(other=>other.id!==event.id&&other.mode===event.mode&&other.participants.some(p=>p.organization===organization)&&
   (other.fixtures.some(game=>days.includes(game.day)&&other.participants.some(p=>p.organization===organization&&(p.id===game.home||p.id===game.away)))||
   (!other.champion&&days.some(day=>day>=(other.fixtures.at(-1)?.day??other.startDay)&&day<=other.endDay))));
}

export function enrollOptionalEvent(season:Season,id:string,day:number,own:Participant){
 const event=season.editions.find(e=>e.id===id),window=event?.entryWindow;
 if(!event||!window)throw Error('Torneio opcional não encontrado.');
 if(event.participants.some(p=>p.organization===own.organization))return;
 if(!window.eligible)throw Error(window.requirement);
 if(day<window.opens||day>window.closes||event.fixtures.some(game=>game.result))throw Error('A inscrição está fora do prazo.');
 if(optionalEventConflicts(season,event).length)throw Error('Há conflito com outro compromisso competitivo.');
 event.participants=[...event.participants.slice(0,-1),own];
 seedKnockout(event);
}

export function generateSeason(career:Career,catalog:WorldCatalog,players:Player[],contracts:Contract[],number:number,startDay:number,settings=defaultCompetitionConfig,bonuses:Record<string,number>={},previous?:Season,enforceImports=false,history:Season[]=previous?[previous]:[]):Season{
 const config=validateCompetitionConfig(settings),mode=career.mode as Mode;
 const progression=career.createdVersion===careerCreationVersion&&!!career.entry;
 const entryId=career.entry?.leagueId;
 const elite=regionalLeague(career.country);
 const promoted=previous?.editions.some(e=>e.key===entryId&&e.champion==='career'||e.key===elite&&e.participants.some(p=>p.id==='career'));
 const ownSide:MatchSide={id:'career',name:career.name,code:career.code,logo:'',identity:career.identity??{...defaultIdentity,primary:career.color,symbol:career.symbol},lineup:careerLineup(players,contracts)};
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
 const create=(key:string,participants:Participant[],prestige:Prestige,region:string,offset:number,format:'league'|'knockout',importRegion?:MobaRegion)=>{
   const setting=config[key]??additionalEvents[key]??{name:leagues.get(key)!.name,prize:5000000,reputationGain:2,finalBestOf:5 as const},id='s'+number+':'+key;
   const competition:Competition={id,key,region,mode,season:number,prestige,...setting,format,participants,fixtures:[],champion:null,finalOrder:[],startDay:startDay+offset,endDay:startDay+offset};
   if(enforceImports&&mode==='MOBA'&&region!=='Global')competition.importRegion=importRegion??leagueMobaRegion(key);
   if(format==='league'){
     const rules=(progression?regionalFormats[key]:undefined)??standardLeague;
     if(progression)competition.leagueFormat=rules;
     let circle=participants.map(p=>p.id);
     const rounds=circle.length-1;
     for(let round=0;round<rounds*rules.splits;round++){
       for(let index=0;index<circle.length/2;index++){
         const [a,b]=[circle[index],circle[circle.length-1-index]],split=Math.floor(round/rounds)+1;
         const reverse=(round%rounds+split)%2===1;
         competition.fixtures.push({id:id+':regular:'+competition.fixtures.length,competitionId:id,season:number,
           home:reverse?b:a,away:reverse?a:b,round:round+1,phase:'regular',day:startDay+offset+(round+split-1)*7,
           bestOf:rules.regularSeries[round%rules.regularSeries.length],status:'scheduled',result:null,...(rules.splits>1?{split}:{})});
       }
       circle=[circle[0],circle.at(-1)!,...circle.slice(1,-1)];
     }
     competition.endDay=competition.fixtures.at(-1)!.day+14;
   }else{
     if(participants.length===8)seedKnockout(competition);
     competition.endDay=startDay+offset+14;
   }
   editions.push(competition);
   return competition;
 };
 const optional=(key:string,candidates:Participant[],prestige:Prestige,region:string,offset:number,eligible:boolean,requirement:string,importRegion?:MobaRegion)=>{
   const event=create(key,[],prestige,region,offset,'knockout',importRegion);
   const seen=new Set<string>();
   event.participants=candidates.filter(team=>{
     if(team.id==='career'||seen.has(team.organization)||optionalEventConflicts({editions},event,team.organization).length)return false;
     seen.add(team.organization);return true;
   }).slice(0,8);
   if(event.participants.length<8){editions.pop();notices.push(event.name+': menos de oito equipes disponíveis no calendário.');return;}
   event.entryWindow={opens:event.startDay-21,closes:event.startDay-1,eligible,requirement};
   seedKnockout(event);
   return event;
 };
 const pyramid=mode==='MOBA'&&progression&&entryId?regionalPyramid(elite,entryId):undefined;
 if(mode==='MOBA'){
   const reserve=(key:string)=>{
     const seen=new Set<string>();
     return pools.filter(p=>{
       if(catalog.teams.find(t=>t.id===p.id)?.league!==key||p.id===career.entry?.displacedTeamId||seen.has(p.organization))return false;
       seen.add(p.organization);return true;
     });
   };
   if(pyramid){
     const upper=reserve(elite),lower=reserve(pyramid.access);
     const entrant=promoted?[...upper,own]:[...lower,own];
     const tiers=exchangeRegionalSlots(promoted?entrant:upper,promoted?lower:entrant,previous,pyramid);
     const sized=(teams:Participant[],minimum:number,capacity:number)=>{
       if(teams.length<minimum)return [];
       const count=Math.min(capacity,teams.length-teams.length%2);
       return teams.some(team=>team.id==='career')?[...teams.filter(team=>team.id!=='career').slice(0,count-1),own]:teams.slice(0,count);
     };
     const main=sized(tiers.elite,6,regionalFormats[elite]?.capacity??8),development=sized(tiers.access,4,8);
     if(!main.length||!development.length||![...main,...development].some(team=>team.id==='career'))
       throw Error('Progressão regional indisponível: faltam equipes elegíveis para preencher a elite e a divisão de acesso.');
     for(const [key,lineup,offset] of [[elite,main,7],[pyramid.access,development,elite==='lec'?119:elite==='lpl'?91:77]] as const){
       const region=leagueMobaRegion(key);
       if(enforceImports&&lineup.some(team=>team.id==='career')&&mobaImports(ownSide.lineup,region)>regionalPolicies[region].limit)
         throw Error('A escalação MOBA supera o limite regional de dois importados. Ajuste os titulares antes da inscrição.');
       create(key,lineup,'Regional',mobaRegions[elite],offset,'league');
     }
     if(elite==='cblol'||elite==='lcs'){
       const brazil=elite==='cblol';
       const event=optional(brazil?'br_cup':'na_challenger',[...(brazil?main:development),...lower,...upper],'Regional',mobaRegions[elite],175,
         brazil||development.some(p=>p.id==='career'),
         brazil?'Equipe inscrita na pirâmide brasileira com cinco titulares elegíveis.':'Equipe do circuito de desenvolvimento com cinco titulares elegíveis.',
         leagueMobaRegion(elite));
       if(!brazil&&event){
         const invited=[...main,...upper,...lower].filter((team,index,pool)=>team.id!=='career'&&pool.findIndex(other=>other.organization===team.organization)===index).slice(0,8);
         if(invited.length===8){
           create('na_cup',invited,'Regional',mobaRegions[elite],224,'knockout',leagueMobaRegion(elite));
           event.qualifierTarget='na_cup';
         }
       }
     }
   }
   for(const [key,region] of Object.entries(mobaRegions)){
     if(pyramid&&key===elite)continue;
     const seen=new Set<string>();
     let candidates=pools.filter(p=>catalog.teams.find(t=>t.id===p.id)?.league===key).filter(p=>{if(seen.has(p.organization))return false;seen.add(p.organization);return true;});
     const include=elite===key&&(!progression||promoted);
     const available=candidates.length+(include?1:0);
     const count=available>=6?Math.min(progression?(regionalFormats[key]?.capacity??8):8,available-available%2):0;
     if(!count){notices.push(config[key].name+': menos de seis equipes válidas.');continue;}
     if(include&&enforceImports&&mobaImports(ownSide.lineup,leagueMobaRegion(key))>regionalPolicies[leagueMobaRegion(key)].limit)
       throw Error('A escalação MOBA supera o limite regional de dois importados. Ajuste os titulares antes da inscrição.');
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
   const sources=editions.filter(e=>e.key in mobaRegions).map(e=>e.key);
   if(progression&&sources.length>=4){
     const world=create('moba_world',[],'Internacional','Global',238,'knockout');
     world.internationalSources=sources;
     if(world.stageRules?.regionalSlots==='prestige'){
       const {prestige}=buildCompetitionRankings(history,{...career,day:startDay-1},catalog);
       world.internationalSlots=worldRegionalSlots(sources,prestige);
     }
     world.qualification=(world.internationalSlots?'Vagas definidas pelo prestígio antes da temporada e preenchidas pela classificação final de cada liga.':'Campeã e vice de cada liga principal.')+' Classificam-se aos playoffs '+world.stageRules!.groupAdvance+' por grupo.';
     world.endDay=world.startDay+91;
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
       if(index===1){
         optional(key,[...unique].sort(byRanking),'Internacional','Global',63,rank.has('career')&&(rank.get('career')??Infinity)<8,
           'Estar entre as oito primeiras organizações no ranking de acesso e ter cinco titulares elegíveis.');
         continue;
       }
       const participants=index===0?[...local.sort((a,b)=>byRanking(b,a)).slice(0,7),own]:
         [...unique,...(rank.has('career')?[own]:[])].sort(byRanking).slice(0,8);
       if(participants.length<8){notices.push(config[key].name+': menos de oito equipes válidas.');continue;}
       const event=create(key,participants,index===0?'Regional':index===3?'Major':'Internacional',index===0?(countryRegions[career.country]??career.country):'Global',7+index*56,'knockout');
       if(key==='cs_major'){
         event.qualification='Oito vagas pelo ranking competitivo usado na abertura da temporada.';
         startDouble(event,event.participants.map(team=>team.id),event.startDay);
       }
       if(index===0&&local.length>=11){
         const openIds=new Set(participants.map(team=>team.organization));
         const invited=local.filter(team=>!openIds.has(team.organization)).sort(byRanking).slice(0,4);
         const closed=create('cs_closed',invited,'Regional',event.region,35,'knockout');
         closed.qualifierSource=event.key;
         closed.qualifierTarget='cs_league';
       }
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
   if(progression&&rank.size>=12){
     const ranked=[...unique,...(rank.has('career')?[own]:[])].filter(team=>rank.has(team.organization)).sort(byRanking);
     const circuitIds=new Map(catalog.teams.map(team=>[team.id,team.league]));
     const leaders=new Map<string,Participant>();
     for(const team of ranked){
       const circuit=team.id==='career'?entryId:circuitIds.get(team.id);
       if(circuit&&!leaders.has(circuit))leaders.set(circuit,team);
     }
     const slots=[...leaders.values()];
     const invited=leaders.size>=2?[...slots,...ranked.filter(team=>!slots.includes(team))].slice(0,12).sort(byRanking):[];
     if(invited.length===12){
       const cup=create('cs_interregional',invited,'Internacional','Global',259,'knockout');
       const rules=cup.stageRules!;
       cup.qualification='Doze convites pelo ranking, com uma vaga para a melhor equipe de cada circuito representado. '+rules.swissRounds+' rodadas suíças classificam '+rules.swissAdvance+' equipes aos playoffs.';
       cup.openingStage={system:'swiss',teams:seedOrder(cup,invited.map(team=>team.id)),bestOf:rules.opening,rounds:rules.swissRounds,advance:rules.swissAdvance};
       cup.endDay=cup.startDay+84;
       addOpeningRound(cup,swissPairs(cup.openingStage.teams,[]),1,cup.startDay,cup.openingStage.bestOf);
     }
   }
 }
 return {number,year:new Date(Date.UTC(2027,2,14+startDay)).getUTCFullYear(),startDay,endDay:Math.max(startDay,...editions.map(e=>e.endDay)),editions,notices,...(fpsRanking?{fpsRanking}:{}),...(pyramid?{pyramid}:{}),...(progression?{rosterRegistration:true as const}:{})};
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
 const results=edition.fixtures.filter(g=>g.phase==='regular'&&g.result);
 for(const game of results){
   const home=rows.find(r=>r.team===game.home)!,away=rows.find(r=>r.team===game.away)!;
   home.played++;away.played++;const diff=game.result!.score[0]-game.result!.score[1];home.difference+=diff;away.difference-=diff;
   const winner=game.result!.winner===home.team?home:away,loser=winner===home?away:home;winner.wins++;loser.losses++;
 }
 const tiePoints=(row:Standing)=>results.filter(g=>g.result?.winner===row.team&&
   rows.some(other=>other.team===(g.home===row.team?g.away:g.home)&&other.wins===row.wins&&other.difference===row.difference)).length;
 const opponentWins=(row:Standing)=>results.filter(game=>game.home===row.team||game.away===row.team).reduce((sum,game)=>
   sum+(rows.find(other=>other.team===(game.home===row.team?game.away:game.home))?.wins??0),0);
 const tieBreak=edition.stageRules?.tieBreak==='opponent-wins'?opponentWins:tiePoints;
 return rows.sort((a,b)=>b.wins-a.wins||b.difference-a.difference||tieBreak(b)-tieBreak(a)||a.team.localeCompare(b.team));
}

function seedOrder(edition:Competition,teams:string[]){
 return edition.stageRules?.seeding==='draw'?[...teams].sort((a,b)=>hashSeed(edition.id+':'+a)-hashSeed(edition.id+':'+b)||a.localeCompare(b)):teams;
}

function startDouble(edition:Competition,teams:string[],day:number){
 edition.bracketStartDay=day;
 const {upper,lower,grandFinal}=edition.stageRules??doubleRules;
 edition.doubleElimination=createDoubleElimination(seedOrder(edition,teams),{upper,lower,grandFinal,final:edition.finalBestOf});
 edition.fixtures=edition.fixtures.filter(game=>game.phase==='regular');
 edition.endDay=day+Math.max(...edition.doubleElimination.nodes.map(node=>node.week))*7;
 progressDoubleElimination(edition);
}

function progressOpeningStage(edition:Competition){
 const stage=edition.openingStage!;
 const games=edition.fixtures.filter(game=>game.phase==='regular'),table=standings(edition);
 if(!games.length||games.some(game=>!game.result))return;
 const round=Math.max(...games.map(game=>game.round));
 const day=Math.max(...games.map(game=>game.result!.completedDay))+7;
 if(stage.system==='swiss'&&round<stage.rounds){
   addOpeningRound(edition,swissPairs(table.map(row=>row.team),games),round+1,day,stage.bestOf);
   return;
 }
 const qualified=stage.system==='swiss'?table.slice(0,stage.advance).map(row=>row.team):
   Array.from({length:stage.advancePerGroup},(_,index)=>stage.groups.flatMap(group=>
     table.filter(row=>group.includes(row.team)).slice(index,index+1).map(row=>row.team))).flat();
 edition.finalOrder=table.map(row=>row.team).filter(team=>!qualified.includes(team));
 startDouble(edition,qualified,day);
}

function qualifyInternational(season:Season,day:number){
 for(const world of season.editions.filter(e=>e.internationalSources&&!e.participants.length)){
   const leagues=world.internationalSources!.map(key=>season.editions.find(e=>e.key===key)!);
   if(leagues.some(league=>!league.champion))continue;
   const used=new Set<string>();
   const rules=world.stageRules??stageDefaults;
   const groups:string[][]=Array.from({length:rules.groups},()=>[]);
   const regionalPairs:string[][]=[];
   for(const league of leagues){
     const qualifiers=league.finalOrder.map(id=>league.participants.find(team=>team.id===id)!).filter(Boolean);
     const pair:string[]=[];
     for(let place=0;place<(world.internationalSlots?.[league.key]??2);place++){
       const team=qualifiers.find(p=>!used.has(p.organization));
       if(!team)continue;
       used.add(team.organization);
       world.participants.push(team);
       pair.push(team.id);
     }
     regionalPairs.push(pair);
   }
   world.startDay=Math.max(world.startDay,day+31);
   const byChampion=new Map(regionalPairs.filter(pair=>pair.length).map(pair=>[pair[0],pair]));
   const extras:string[]=[];
   seedOrder(world,[...byChampion.keys()]).forEach((id,index)=>byChampion.get(id)!.forEach((team,place)=>{
     if(place>=2)extras.push(team);
     else groups[(index+place*(rules.groups/2))%rules.groups].push(team);
   }));
   for(const team of extras)groups.reduce((smallest,group)=>group.length<smallest.length?group:smallest).push(team);
   world.openingStage={system:'groups',groups,bestOf:rules.opening,advancePerGroup:rules.groupAdvance};
   const rounds=Math.max(...groups.map(group=>group.length+group.length%2-1));
   for(let round=1;round<=rounds;round++)addOpeningRound(world,groupRound(groups,round),round,world.startDay+(round-1)*7,rules.opening);
   world.endDay=world.startDay+91;
   season.endDay=Math.max(season.endDay,world.endDay);
 }
}

export function progressBracket(edition:Competition){
 if(edition.champion)return;
 if(edition.doubleElimination){progressDoubleElimination(edition);return;}
 if(edition.openingStage){progressOpeningStage(edition);return;}
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

export function simulateSeries(teams:[MatchSide,MatchSide],mode:Mode,day:number,bestOf:1|3|5,seed:number,options:MatchOptions={}):SeriesResult{
 if(![1,3,5].includes(bestOf))throw Error('Formato de série inválido.');
 let current=teams;const score:[number,number]=[0,0],maps:MatchResult[]=[];
 while(Math.max(...score)<Math.ceil(bestOf/2)){
   const mapId=mode==='FPS'?seriesMaps(seed)[maps.length]?.id:undefined;
   const result=simulateMatch(mode,day,current,hashSeed(seed+':'+maps.length),{...options,mapId});maps.push(result);score[result.winner]++;
   const updated=new Map(applyMatchConditions(current.flatMap(team=>team.lineup.map(s=>s.player)),result,false).map(player=>[player.id,player]));
   current=current.map(team=>({...team,lineup:team.lineup.map(slot=>({...slot,player:updated.get(slot.player.id)!}))})) as [MatchSide,MatchSide];
 }
 return {winner:teams[score[0]>score[1]?0:1].id,score,maps,completedDay:day};
}

export function isScheduledFixture(fixture:Fixture){
 return !fixture.result&&(fixture.status==='scheduled'||fixture.status===undefined);
}

export function fixtureStageName(edition:Competition,fixture:Fixture){
 const node=edition.doubleElimination?.nodes.find(row=>edition.id+':'+row.id===fixture.id);
 if(node)return node.lane==='upper'?'Chave superior · Rodada '+node.round:node.lane==='lower'?'Chave inferior · Rodada '+node.round:node.lane==='reset'?'Desempate da grande final':'Grande final';
 if(fixture.phase==='regular'&&edition.openingStage)return edition.openingStage.system==='groups'?'Fase de grupos':'Fase suíça · Rodada '+fixture.round;
 return {regular:'Rodada '+fixture.round,quarterfinal:'Quartas de final',semifinal:'Semifinal',final:'Final'}[fixture.phase];
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

export function playCompetitionFixture(season:Season,fixtureId:string,day:number,teams:[MatchSide,MatchSide],seed:number,options:MatchOptions={},forfeit=false){
 const edition=season.editions.find(e=>e.fixtures.some(g=>g.id===fixtureId)),game=edition?.fixtures.find(g=>g.id===fixtureId);
 if(!edition||!game)throw Error('Confronto não encontrado.');
 if(game.result||game.status==='completed')throw Error('Este confronto já foi concluído.');
 if(!isScheduledFixture(game))throw Error('Este confronto não está disponível.');
 if(day<game.day)throw Error('Avance até a data do confronto.');
 if(teams[0].id!==game.home||teams[1].id!==game.away)throw Error('Participantes incompatíveis com o confronto.');
 if(!forfeit&&edition.mode==='MOBA'&&edition.importRegion&&teams.some(team=>mobaImports(team.lineup,edition.importRegion!)>regionalPolicies[edition.importRegion!].limit))
   throw Error('A escalação MOBA supera o limite regional de dois importados.');
 const unavailable=teams.map(team=>team.lineup.length!==5);
 let result:SeriesResult;
 if(forfeit&&teams.some(team=>team.id==='career')){
   const winner=teams.findIndex(team=>team.id!=='career'),score:[number,number]=[0,0];
   score[winner]=Math.floor(game.bestOf/2)+1;
   result={winner:teams[winner].id,score,maps:[],completedDay:day,administrative:'ineligible-lineup'};
 }else if(edition.importRegion&&unavailable.some(Boolean)&&!teams.some((team,index)=>team.id==='career'&&unavailable[index])){
   const winner=unavailable[0]&&unavailable[1]
     ?teams.findIndex(team=>team.id===edition.participants.find(participant=>teams.some(side=>side.id===participant.id))?.id)
     :unavailable[0]?1:0;
   const score:[number,number]=[0,0];
   score[winner]=Math.floor(game.bestOf/2)+1;
   result={winner:teams[winner].id,score,maps:[],completedDay:day,administrative:'ineligible-lineup'};
 }else result=simulateSeries(teams,edition.mode,day,game.bestOf,hashSeed(seed+':'+game.id),options);
 game.result=result;game.status='completed';
 progressSeason(season,edition,day);
 return result;
}

export function progressSeason(season:Season,edition:Competition,day:number){
 progressBracket(edition);
 const closed=season.editions.find(e=>e.qualifierSource===edition.key&&!e.fixtures.length);
 const semifinals=closed&&edition.fixtures.filter(fixture=>fixture.phase==='semifinal');
 if(closed&&semifinals&&semifinals.length===2){
   const qualified=semifinals.flatMap(fixture=>[fixture.home,fixture.away]).map(id=>edition.participants.find(team=>team.id===id)!);
   closed.participants=[...qualified,...closed.participants];
   closed.startDay=Math.max(closed.startDay,semifinals[0].day+21);
   closed.endDay=closed.startDay+14;
   season.endDay=Math.max(season.endDay,closed.endDay);
   seedKnockout(closed);
 }
 if(edition.champion&&edition.qualifierTarget){
   const target=season.editions.find(e=>e.key===edition.qualifierTarget);
   const winner=edition.participants.find(team=>team.id===edition.champion)!;
   if(target&&!target.participants.some(team=>team.organization===winner.organization)&&target.fixtures.every(fixture=>!fixture.result)){
     const provisional=target.participants.filter(team=>team.id!=='career').at(-1);
     target.participants=target.participants.map(team=>team===provisional?winner:team);
     seedKnockout(target);
   }
 }
 if(edition.champion)qualifyInternational(season,day);
 season.endDay=Math.max(season.endDay,edition.endDay);
 schedulePermanence(season,day);
}
