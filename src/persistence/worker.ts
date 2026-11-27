import {marketTargetsSchema,marketUsage} from '../game-core/market-overview';
import {observeRanked,talentSchema} from '../game-core/talent-development';
import {academyEvaluationSchema,athleteSnapshot,tryoutAvailable,tryoutDurations} from '../game-core/academy-evaluation';
import {trainingWeekSchema,validateWeekSlots,type TrainingSlot} from '../game-core/training-week';
import {resetSoloPoints,soloQueueSchema,soloSeasonDays,soloStandings,weeklyClimbers,type WeeklyRankings} from '../game-core/solo-queue';
import {loanSchema,loanPeriods,activeLoans,loanPlayers,loanContracts,type Loan} from '../game-core/loans';
import {eligibleMobaLineup,leagueMobaRegion,mobaImports,regionalPolicies,registeredMobaLineup,type MobaRegion} from '../game-core/moba-eligibility';
import {approachSchema,competitiveEvidence,marketApproaches,marketInterest,marketLimits,type Approach} from '../game-core/market-interest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import {allocateSqliteBytes} from './sqlite-bytes';
import {schema,careerInput,deleteCareer,validateSaveName,saveVersionSchema,type Career} from '../game-core/career';
import {careerCreationVersion} from '../version';
import {contractSchema,selectStarter,terms,type Contract,type Player} from '../game-core/recruitment';
import {contractFixtures,contractParticipation,expectationDelta,expiryLevel,renewalGrounds,type SquadRole} from '../game-core/contract-expectations';
import {advanceCareerDay,calendarVersion,migrateCalendar,salaryDue} from '../game-core/calendar';
import {cashProjection,paymentPeriods,type ScheduledCash} from '../game-core/finance-projection';
import {countryRegions} from '../game-core/countries';
import {equipmentCatalog,equipmentCategories,setupTraining,sponsorCashOnlyValue,type EquipmentAssignment} from '../game-core/equipment';
import {defaultIdentity,phaseOneSchema,validateIdentity} from '../game-core/identity';
import {validateUniform,uniformVariants,type Uniforms} from '../game-core/uniform';
import {assertBackupFile,readGodotCareer,readGodotRoster,restoreWebBackup} from '../game-core/backup';
import type {Mode} from '../game-core/attributes';
import {startingEntry} from '../game-core/entry';
import type {WorldCatalog} from '../game-core/world';
import {addRankedProspects,addWorldTraits,generateWorld,generationVersion} from '../game-core/generation';
import {publicTraits} from '../game-core/traits';
import {publicPerkInfluences,withPersonalObjective} from '../game-core/player-identity';
import {developPlayer,playerCondition} from '../game-core/development';
import {observeOverall} from '../game-core/player-analysis';
import {applyFavorite,favoriteIds,favoriteLineupSchema,favoriteName,validateFavoritePlayers} from '../game-core/lineup-favorites';
import {competitionMilestones,participated,rosterEventNames,type PlayerMilestone} from '../game-core/player-milestones';
import {applyAdaptation,renewWorld,seasonBoundaries} from '../game-core/renewal';
import {applyPerkEvent} from '../game-core/perk-events';
import {confirmOffer,negotiationSchema,submitOffer} from '../game-core/negotiation';
import {departPlayer,maintainRosters,renewContract,saleOptions,sellerAskingPrice} from '../game-core/market';
import {assignAcademy,setTrainingFocus} from '../game-core/academy';
import type {PlayerTraining,TrainingPlan} from '../game-core/training';
import {matchSchema,prepareMatch,completeMatch} from '../game-core/match-store';
import {careerLineup,rivalLineup,matchStrength,applyMatchConditions,simulateMatch,type MatchResult,type MatchSide} from '../game-core/matches';
import {defaultCompetitionConfig,enrollOptionalEvent,generateSeason,hashSeed,isScheduledFixture,optionalEventDays,planCompetitionAdvance,playCompetitionFixture,validateCompetitionConfig,type Participant,type Season} from '../game-core/competitions';
import {competitionSchema,latestSeason,nextSeasonStart,storeNewSeason,persistSeason} from '../game-core/competition-store';
import {buildCompetitionRankings} from '../game-core/competition-rankings';
import {competitionLineup,lockCompetitionRosters} from '../game-core/competition-registration';
import {commercialRecognition,initializeFinance,refreshSponsorOffers,acceptSponsor,rejectSponsor,paySponsors,upgradeFacility,facilityEfficiency,recordCash,type FacilityLevels} from '../game-core/finance';
import {syncAiAccounts,payAiSalaries,aiCanBuy,aiPurchase,aiHire,aiReceiveTransfer} from '../game-core/ai-finance';
import {newsSchema,synchronizeNews,listNews,processMoodEvent,recordDevelopmentNews} from '../game-core/news';
import {migrateZeroSigningBonus} from '../game-core/contract-migration';

const webVersion=10;
function publicPlayer({ceiling:_,temperament:__,perkEvents:___,perkInfluences,...player}:Player,discovered:boolean){
 const perks=publicTraits(player.perks??[],discovered);
 return {...player,perks,perkInfluences:publicPerkInfluences(perkInfluences,perks),
   perkHistory:discovered?player.perkHistory:player.perkHistory?.filter(event=>perks.some(perk=>perk.id===event.id))};
}
const careerQuery=`SELECT careers.*, w.config, (SELECT config FROM web_uniforms u WHERE u.career_id=careers.id AND u.variant='home') AS uniformHome,
 (SELECT config FROM web_uniforms u WHERE u.career_id=careers.id AND u.variant='away') AS uniformAway, COALESCE(s.name,'') AS saveName, v.created_version AS createdVersion,
 e.league_id AS entryLeague,e.kind AS entryKind,e.displaced_team_id AS displacedTeam,
 EXISTS(SELECT 1 FROM web_godot_source g WHERE g.career_id=careers.id) AS hasGodotSource,
 MIN(100,40+COALESCE((SELECT SUM(reputation) FROM web_competition_awards a WHERE a.career_id=careers.id AND a.organization='career'),0)) AS reputation
 FROM careers LEFT JOIN web_identity w ON w.career_id=careers.id
 LEFT JOIN web_save_names s ON s.career_id=careers.id LEFT JOIN web_career_entry e ON e.career_id=careers.id
 LEFT JOIN web_save_versions v ON v.career_id=careers.id`;
function hydrate(row:Record<string,unknown>|undefined){
 if(!row)return undefined;
 const {config,entryLeague,entryKind,displacedTeam,uniformHome,uniformAway,...data}=row;
 const career=data as Career&{uniforms?:Uniforms};
 for(const [variant,value] of [['home',uniformHome],['away',uniformAway]] as const)if(typeof value==='string'){
   try{(career.uniforms??={})[variant]=validateUniform(JSON.parse(value));}catch{}
 }
 if(typeof entryLeague==='string'&&(entryKind==='career_slot'||entryKind==='open_circuit')){
   career.entry={leagueId:entryLeague,kind:entryKind,displacedTeamId:typeof displacedTeam==='string'?displacedTeam:null};
 }
 if(typeof config==='string'){
   try{career.identity=validateIdentity(JSON.parse(config));}
   catch{career.identity={...defaultIdentity,primary:career.color,symbol:career.symbol};}
 }
 return career;
}
let playerCatalog:Promise<Player[]> | undefined;
let worldCatalog:Promise<WorldCatalog>|undefined;
function loadWorld(){
 return worldCatalog??=fetch('/data/real_teams_2026.json').then(response=>{
   if(!response.ok)throw Error('Catálogo competitivo indisponível.');
   return response.json() as Promise<WorldCatalog>;
 }).catch(error=>{worldCatalog=undefined;throw error;});
}
function loadPlayers() {
 return playerCatalog ??= fetch('/data/players-v1.json').then(response=>{
  if(!response.ok)throw Error('Catálogo de jogadores indisponível.');
  return response.json() as Promise<Player[]>;
 }).catch(error=>{playerCatalog=undefined;throw error;});
}
const initialized=(async()=>{
 self.postMessage({diagnostic:'Carregando SQLite…'});
 const sqlite=await sqlite3InitModule();
 self.postMessage({diagnostic:'Abrindo armazenamento persistente…'});
 const pool=await sqlite.installOpfsSAHPoolVfs({directory:'/uem-web',initialCapacity:6});
 const db=new pool.OpfsSAHPoolDb('/careers.sqlite');
 db.exec('PRAGMA foreign_keys=ON');
 const version=Number(db.selectValue('PRAGMA user_version'));
 if(version>webVersion)throw Error('Save de uma versão mais recente.');
 if(version===0)db.exec(schema);
 if(version<calendarVersion){
   db.exec(contractSchema);
   migrateCalendar(sql=>{db.exec(sql);},1);
 }
 if(/CHECK\s*\(\s*bonus\s*>\s*0\s*\)/i.test(String(db.selectValue("SELECT sql FROM sqlite_schema WHERE name='web_contracts'")))){
   migrateZeroSigningBonus(sql=>{db.exec(sql);});
 }
 db.exec(contractSchema+phaseOneSchema+negotiationSchema+matchSchema+competitionSchema+newsSchema+saveVersionSchema+favoriteLineupSchema+approachSchema+marketTargetsSchema+loanSchema+talentSchema+soloQueueSchema+academyEvaluationSchema+trainingWeekSchema);
 db.transaction(()=>{
   for(const row of db.selectObjects('SELECT id FROM careers'))initializeFinance((sql,bind)=>{db.exec({sql,bind});},(sql,bind)=>db.selectObject(sql,bind),(sql,bind)=>db.selectObjects(sql,bind),String(row.id));
   db.exec('PRAGMA user_version=10;');
 });
 self.postMessage({diagnostic:'Banco conectado'});return {db,pool,sqlite};
})();
// Serialize entire requests, including catalog awaits, so each operation reads
// the world committed by the previous one before it mutates a roster.
let requests=Promise.resolve();
self.onmessage=(event)=>{requests=requests.then(()=>handleRequest(event));};
async function handleRequest(event:MessageEvent){
 const {id,action,input}=event.data;
 try{const {db,pool,sqlite}=await initialized;let result:unknown;
 const list=()=>db.selectObjects(careerQuery+' ORDER BY created DESC').map(hydrate);
 const get=(careerId:string)=>hydrate(db.selectObject(careerQuery+' WHERE careers.id=?',[careerId]));
 const savedPlayers=(careerId:string)=>db.selectValue('SELECT players FROM web_career_world WHERE career_id=?',[careerId]);
 const run=(sql:string,bind:(string|number)[])=>{db.exec({sql,bind});};
 const read=(sql:string,bind:(string|number)[])=>db.selectObject(sql,bind);
 const all=(sql:string,bind:(string|number)[])=>db.selectObjects(sql,bind);
 const ownedIds=(careerId:string)=>new Set([
   ...db.selectObjects('SELECT player_id FROM web_current_contracts WHERE career_id=?',[careerId]),
   ...db.selectObjects('SELECT player_id FROM web_imported_players p WHERE career_id=? AND member=1 AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)',[careerId]),
 ].map(row=>Number(row.player_id)));
 const contractsFor=(careerId:string)=>all(`SELECT c.player_id,c.salary,c.bonus,c.start_day,c.end_day,c.starter,COALESCE(t.academy,0) academy,e.squad_role
   FROM web_current_contracts c LEFT JOIN web_player_training t ON t.career_id=c.career_id AND t.player_id=c.player_id
   LEFT JOIN web_contract_expectations e ON e.career_id=c.career_id AND e.player_id=c.player_id AND e.start_day=c.start_day WHERE c.career_id=?
   UNION ALL SELECT p.player_id,0,0,0,0,p.starter,COALESCE(t.academy,0),NULL FROM web_imported_players p
   LEFT JOIN web_player_training t ON t.career_id=p.career_id AND t.player_id=p.player_id
   WHERE p.career_id=? AND p.member=1 AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)
   ORDER BY starter DESC`,[careerId,careerId]) as unknown as Contract[];
 const loansFor=(id:string)=>all('SELECT player_id,origin,destination,club,start_day,end_day,starter FROM web_loans WHERE career_id=? ORDER BY start_day DESC,player_id',[id]) as unknown as Loan[];
 const registrationIds=(id:string,day:number,loans:Loan[])=>{
   const active=activeLoans(loans,day);
   const outgoing=new Set(active.filter(loan=>loan.origin==='career').map(loan=>loan.player_id));
   const rows=all(`SELECT c.player_id FROM web_contracts c WHERE c.career_id=? AND c.start_day<=? AND c.end_day>=?
     AND NOT EXISTS(SELECT 1 FROM web_contract_closures x WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day AND x.day<=?)
     UNION SELECT p.player_id FROM web_imported_players p WHERE p.career_id=? AND p.member=1 AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)`,
     [id,day,day,day,id]);
   const academy=new Set(all('SELECT player_id FROM web_player_training WHERE career_id=? AND academy=1',[id]).map(row=>Number(row.player_id)));
   const players=rows.map(row=>Number(row.player_id)).filter(player=>!outgoing.has(player)&&!academy.has(player));
   return [...new Set([...players,...active.filter(loan=>loan.destination==='career').map(loan=>loan.player_id)])].sort((a,b)=>a-b);
 };
 const trainingRows=(id:string)=>all(`SELECT t.player_id,t.academy,COALESCE(o.focus,t.focus) focus,t.changed_day FROM web_player_training t
   LEFT JOIN web_training_focus_overrides o ON o.career_id=t.career_id AND o.player_id=t.player_id WHERE t.career_id=? ORDER BY t.player_id`,[id]);
 const watched=(id:string)=>all('SELECT player_id FROM web_ranked_watch WHERE career_id=? AND active=1 ORDER BY player_id',[id]).map(row=>Number(row.player_id));
 const rankedWatch=(id:string)=>({ids:watched(id),history:all('SELECT player_id,day,position,points FROM web_ranked_history WHERE career_id=? ORDER BY day,player_id',[id])});
 const recordAcademy=(id:string,day:number,players:Player[],academy:ReadonlySet<number>)=>{
   if(!academy.size)return;
   for(const player of players)if(academy.has(player.id))run('INSERT OR IGNORE INTO web_academy_snapshots VALUES(?,?,?,?)',
     [id,player.id,day,JSON.stringify(athleteSnapshot(player))]);
 };
 const recordRanked=(id:string,players:Player[],ids:ReadonlySet<number>,day:number)=>{
   for(const row of observeRanked(players,ids,day))run('INSERT OR IGNORE INTO web_ranked_history VALUES(?,?,?,?,?)',[id,row.player_id,day,row.position,row.points]);
 };
 const marketPlayers=async(careerId:string)=>{
   const stored=savedPlayers(careerId);
   const world=typeof stored==='string'?JSON.parse(stored) as Player[]:await loadPlayers();
   const imported=db.selectObjects('SELECT data FROM web_imported_players WHERE career_id=?',[careerId]).map(row=>JSON.parse(String(row.data)) as Player);
   const players=[...world,...imported];
   if(!read('SELECT 1 FROM web_ai_finances WHERE career_id=? LIMIT 1',[careerId])){
     const catalog=await loadWorld();db.transaction(()=>syncAiAccounts(run,read,all,careerId,players,catalog.organizations.map(org=>org.id),Number(get(careerId)?.day)));
   }
   return players;
 };
 const aiHiring=(careerId:string,day:number)=>(organization:string,player:Player)=>aiHire(run,read,careerId,organization,player,day);
 const writeMarketPlayers=(careerId:string,players:Player[],day=get(careerId)?.day??1)=>{
   const existing=savedPlayers(careerId);
   if(typeof existing!=='string')throw Error('Carregue o mundo da carreira antes de negociar.');
   players=players.map(player=>withPersonalObjective(player,day));
   run('UPDATE web_career_world SET players=? WHERE career_id=?',[JSON.stringify(players.filter(p=>p.id>=0)),careerId]);
   for(const player of players.filter(p=>p.id<0))run('UPDATE web_imported_players SET data=? WHERE career_id=? AND player_id=?',[JSON.stringify(player),careerId,player.id]);
 };
 const approaches=(careerId:string,day:number,playerId?:number)=>{
   const rows=all('SELECT data FROM web_ai_approaches WHERE career_id=? AND day>=?'+(playerId===undefined?'':' AND player_id=?')+' ORDER BY day DESC,buyer',
     playerId===undefined?[careerId,day-marketLimits.refused]:[careerId,day-marketLimits.refused,playerId]);
   return rows.map(row=>JSON.parse(String(row.data)) as Approach);
 };
 const setApproach=(careerId:string,offer:Approach,state:Approach['state'])=>{
   run('UPDATE web_ai_approaches SET data=? WHERE career_id=? AND day=? AND buyer=? AND player_id=?',
     [JSON.stringify({...offer,state}),careerId,offer.day,offer.organization,offer.playerId]);
 };
 const offersFor=(id:string,day:number,player:Player,catalog:WorldCatalog,players:Player[],requested=true)=>{
   const history=approaches(id,day,player.id);
   const open=history.filter(offer=>offer.seller==='career'&&offer.state==='open'&&offer.expires>=day);
   if(!requested||open.length)return open;
   if(read("SELECT 1 FROM web_negotiations WHERE career_id=? AND player_id=? AND expires_day>=? AND state IN ('accepted','counter')",[id,player.id,day]))return [];

   const evidence=competitiveEvidence(latestSeason(read,id),day).get(player.id);
   const quotes=saleOptions(player,catalog,players,(org,fee)=>aiCanBuy(read,id,org,player,fee));
   const buyers=new Set<string>();
   return quotes.filter(quote=>{
     const org=catalog.organizations.find(org=>org.id===quote.organization)!;
     const team=catalog.teams.find(team=>team.id===quote.team)!;
     const rival=players.filter(p=>p.id!==player.id&&p.team===team.id&&p.role===player.role&&p.status!=='retired');
     const incumbent=rival.length?Math.max(...rival.map(p=>p.overall))-3:undefined;
     if(buyers.has(org.id)||!marketInterest(player,{reputation:org.reputation,academy:team.academy},incumbent,day,evidence,true)||
       history.some(row=>row.organization===org.id&&row.state==='declined'&&day-row.day<marketLimits.refused))return false;
     buyers.add(org.id);return true;
   }).slice(0,marketLimits.athlete);
 };
 const matchContext=async(careerId:string,opponentId:string,selected?:number[],at?:number)=>{
   const current=get(careerId);
   if(!current)throw Error('Carreira não encontrada.');
   const catalog=await loadWorld(),players=await marketPlayers(careerId);
   const team=catalog.teams.find(team=>team.id===opponentId);
   const org=catalog.organizations.find(org=>org.id===team?.organization);
   if(!team||!org||catalog.leagues.find(league=>league.id===team.league)?.discipline!==current.mode)throw Error('Equipe adversária ou modalidade incompatível.');
   const day=at??current.day,loans=loansFor(careerId),sport=loanPlayers(players,loans,day);
   const contracts=loanContracts(sport,contractsFor(careerId).filter(row=>!row.loan&&(!row.end_day||row.end_day>=day)),loans,day);
   if(selected)validateFavoritePlayers(selected,current.mode as Mode,sport,contracts);
   const lineup=careerLineup(sport,selected?contracts.map(row=>({...row,starter:Number(selected.includes(row.player_id))})):contracts);
   const sides:[MatchSide,MatchSide]=[
     {id:'career:'+current.id,name:current.name,code:current.code,logo:'',identity:current.identity??{...defaultIdentity,primary:current.color,symbol:current.symbol},lineup},
     {id:team.id,name:team.name,code:org.code,logo:org.logo,lineup:rivalLineup(sport,team.id,current.mode as Mode,day)},
   ];
   const owned=ownedIds(careerId);
   const outgoing=new Set(activeLoans(loans,day).filter(loan=>loan.destination===team.id).map(loan=>loan.player_id));
   if(sides[1].lineup.some(slot=>owned.has(slot.player.id)&&!outgoing.has(slot.player.id)))throw Error('O adversário possui vínculo conflitante com o seu elenco.');
   sides.forEach(side=>matchStrength(side,current.mode as Mode,day));
   return {sides,players};
 };
 const trainingConflict=(id:string,mode:string,day:number)=>{
   const season=latestSeason(read,id);
   return season?.editions.some(edition=>{
     if(edition.mode!==mode)return false;
     const games=edition.fixtures.filter(game=>game.home==='career'||game.away==='career');
     return games.some(game=>game.result?.completedDay===day||isScheduledFixture(game)&&(game.day===day||day===get(id)?.day&&game.day<day))||
       !!edition.entryWindow&&!edition.champion&&games.length>0&&optionalEventDays(edition).includes(day)&&
       !games.some(game=>game.result&&game.result.winner!=='career');
   })||
     !!read('SELECT 1 FROM web_matches WHERE career_id=? AND mode=? AND day=?',[id,mode,day]);
 };
 const competitionSide=(participant:Participant,players:Player[],mode:Mode,day:number,careerId:string,protectedIds=ownedIds(careerId),region?:MobaRegion):MatchSide=>{
   const loans=loansFor(careerId),sport=loanPlayers(players,loans,day);
   const lineup=participant.id==='career'?careerLineup(sport.filter(player=>player.mode===mode),loanContracts(sport,contractsFor(careerId),loans,day)):
     region?registeredMobaLineup(sport,participant.id,day,region):
     rivalLineup(sport,participant.id,mode,day);
   const outgoing=new Set(activeLoans(loans,day).filter(loan=>loan.destination===participant.id).map(loan=>loan.player_id));
   if(participant.id!=='career'&&lineup.some(slot=>protectedIds.has(slot.player.id)&&!outgoing.has(slot.player.id)))throw Error('Vínculo conflitante no elenco rival.');
   if(participant.id!=='career')return {...participant,lineup};
   const current=get(careerId)!;
   const variant=participant.id==='career'&&current.uniforms?.home;
   return {...participant,identity:current.identity??{...defaultIdentity,primary:current.color,symbol:current.symbol},...(variant?{uniform:variant}:{}),lineup};
 };
 const processAI=(season:Season|undefined,day:number,source:Player[],careerId:string,protectedIds:Set<number>,seed:number)=>{
   let players=source;if(!season)return players;
   while(true){
     const edition=season.editions.find(e=>e.fixtures.some(g=>isScheduledFixture(g)&&g.day<=day&&g.home!=='career'&&g.away!=='career'));
     const game=edition?.fixtures.find(g=>isScheduledFixture(g)&&g.day<=day&&g.home!=='career'&&g.away!=='career');
     if(!edition||!game)break;
     const teams=[game.home,game.away].map(id=>competitionSide(edition.participants.find(p=>p.id===id)!,players,edition.mode,day,careerId,protectedIds,edition.importRegion)) as [MatchSide,MatchSide];
     const result=playCompetitionFixture(season,game.id,day,teams,seed);
     for(const map of result.maps)players=applyMatchConditions(players,map);
   }
   persistSeason(run,read,careerId,season,day,players);return players;
 };
 const writeEntry=(careerId:string,entry:ReturnType<typeof startingEntry>)=>db.exec({
   sql:'INSERT OR IGNORE INTO web_career_entry VALUES(?,?,?,?)',
   bind:[careerId,entry.leagueId,entry.kind,entry.displacedTeamId],
 });
 if(action==='list'){
   const pending=db.selectObjects('SELECT id,country,mode FROM careers WHERE id NOT IN(SELECT career_id FROM web_career_entry)');
   if(pending.length){
     const catalog=await loadWorld();
     db.transaction(()=>{for(const row of pending)writeEntry(String(row.id),startingEntry(catalog,String(row.country),String(row.mode)));});
   }
   result=list();
 }
 else if(action==='create'){
 const identity=validateIdentity(input.identity??{...defaultIdentity,primary:input.color,symbol:input.symbol});
 const c=careerInput({...input,color:identity.primary,symbol:identity.symbol});const careerId=crypto.randomUUID();
 const entry=startingEntry(await loadWorld(),c.country,c.mode);
 const seed=crypto.getRandomValues(new Uint32Array(1))[0];
 const world=addRankedProspects(generateWorld(await loadPlayers(),seed),seed).map(player=>withPersonalObjective(player,1));
 db.transaction(()=>{
   db.exec({sql:'INSERT INTO careers(id,name,code,country,mode,difficulty,balance,color,symbol,created) VALUES(?,?,?,?,?,?,?,?,?,?)',bind:[careerId,c.name,c.code,c.country,c.mode,c.difficulty,c.balance,c.color,c.symbol,new Date().toISOString()]});
   db.exec({sql:'INSERT INTO web_save_versions VALUES(?,?)',bind:[careerId,careerCreationVersion]});
   db.exec({sql:'INSERT INTO web_identity VALUES(?,?)',bind:[careerId,JSON.stringify(identity)]});
   writeEntry(careerId,entry);
   db.exec({sql:'INSERT INTO web_career_world VALUES(?,?,?,?)',bind:[careerId,seed,generationVersion,JSON.stringify(world)]});
   initializeFinance(run,read,all,careerId);
 });
 result=get(careerId);
 }else if(action==='uniform'){
 const current=get(input.careerId);
 if(!current||!uniformVariants.includes(input.variant))throw Error('Uniforme inválido.');
 const uniform=validateUniform(input.config);
 if(uniform.sponsor&&!read("SELECT 1 FROM web_sponsors WHERE career_id=? AND company=? AND state='accepted' AND accepted_day+duration-1>=?",[current.id,uniform.sponsor,current.day]))
   throw Error('Escolha um patrocinador ativo.');
 run('INSERT INTO web_uniforms VALUES(?,?,?) ON CONFLICT(career_id,variant) DO UPDATE SET config=excluded.config',[current.id,input.variant,JSON.stringify(uniform)]);
 result=get(current.id);
 }else if(action==='identity'){
 const identity=validateIdentity(input.identity);
 if(!get(input.careerId))throw Error('Carreira não encontrada.');
 db.transaction(()=>{
   db.exec({sql:'UPDATE careers SET color=?,symbol=? WHERE id=?',bind:[identity.primary,identity.symbol,input.careerId]});
   db.exec({sql:'INSERT INTO web_identity VALUES(?,?) ON CONFLICT(career_id) DO UPDATE SET config=excluded.config',bind:[input.careerId,JSON.stringify(identity)]});
 });
 result=get(input.careerId);
 }else if(action==='rename'){
 const name=validateSaveName(input.name);
 db.exec({sql:'INSERT INTO web_save_names VALUES(?,?) ON CONFLICT(career_id) DO UPDATE SET name=excluded.name',bind:[input.careerId,name]});
 result=list();
 }else if(action==='import'){
 const bytes=new Uint8Array(input.bytes as ArrayBuffer);
 assertBackupFile(bytes);
 const source=new sqlite.oo1.DB(':memory:');
 try{
   const {capi,wasm}=sqlite;
   const ptr=allocateSqliteBytes(wasm,bytes);
   const rc=capi.sqlite3_deserialize(source.pointer!,'main',ptr,bytes.byteLength,bytes.byteLength,
     capi.SQLITE_DESERIALIZE_FREEONCLOSE|capi.SQLITE_DESERIALIZE_READONLY);
   if(rc!==capi.SQLITE_OK)throw Error('Não foi possível abrir a cópia SQLite.');
   source.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
   const read=(sql:string,bind:Parameters<typeof source.selectObjects>[1])=>source.selectObjects(sql,bind);
   if(input.kind==='godot'){
     const c=readGodotCareer(read);
     const roster=readGodotRoster(read,c.mode as Mode,c.day);
     const careerId=crypto.randomUUID();
     db.transaction(()=>{
       db.exec({sql:'INSERT INTO careers VALUES(?,?,?,?,?,?,?,?,?,?,?)',
         bind:[careerId,c.name,c.code,c.country,c.mode,c.difficulty,c.balance,c.identity.primary,c.identity.symbol,new Date().toISOString(),c.day]});
       db.exec({sql:'INSERT INTO web_identity VALUES(?,?)',bind:[careerId,JSON.stringify(c.identity)]});
       db.exec({sql:'INSERT INTO web_godot_source VALUES(?,?)',bind:[careerId,bytes]});
       for(const {player,member,starter,contract} of roster){
         db.exec({sql:'INSERT INTO web_imported_players VALUES(?,?,?,?,?)',bind:[careerId,player.id,JSON.stringify(withPersonalObjective(player,c.day)),Number(member),Number(starter)]});
         if(contract)db.exec({sql:'INSERT INTO web_contracts VALUES(?,?,?,?,?,?,?,?)',
           bind:[careerId,player.id,player.role,Number(starter),Number(contract.salary_cents),Number(contract.signing_bonus_cents),Number(contract.start_day),Number(contract.end_day)]});
       }
     });
   }else{
     restoreWebBackup(read,(sql,bind)=>{db.exec({sql,bind});},()=>crypto.randomUUID());
   }
   db.transaction(()=>{for(const row of db.selectObjects('SELECT id FROM careers'))initializeFinance((sql,bind)=>{db.exec({sql,bind});},(sql,bind)=>db.selectObject(sql,bind),(sql,bind)=>db.selectObjects(sql,bind),String(row.id));});
   result=list();
 }finally{source.close();}
 }else if(action==='godot-source'){
 result=db.selectValue('SELECT file FROM web_godot_source WHERE career_id=?',[input]);
 }else if(action==='delete'){
 deleteCareer((sql,bind)=>{db.exec({sql,bind});},input);
 result=list();
 }else if(action==='imported-players'){
 const day=Number(db.selectValue('SELECT day FROM careers WHERE id=?',[input]));
 result=db.selectObjects('SELECT data,member FROM web_imported_players WHERE career_id=?',[input]).map(row=>{
   const player=JSON.parse(String(row.data)) as Player,updated=withPersonalObjective(player,day);
   if(updated!==player)run('UPDATE web_imported_players SET data=? WHERE career_id=? AND player_id=?',[JSON.stringify(updated),input,player.id]);
   return publicPlayer(updated,Boolean(row.member));
 });
 }else if(action==='world-players'){
 const stored=db.selectObject('SELECT seed,version,players FROM web_career_world WHERE career_id=?',[input]);
 if(!stored&&!get(input))throw Error('Carreira não encontrada.');
 const seed=stored?Number(stored.seed):Array.from(String(input)).reduce((acc,char)=>(Math.imul(acc,31)+char.charCodeAt(0))>>>0,0);
 const source=stored?JSON.parse(String(stored.players)) as Player[]:await loadPlayers();
 const day=Number(db.selectValue('SELECT day FROM careers WHERE id=?',[input]));
 let players=stored?.version===generationVersion?source:addRankedProspects(addWorldTraits(source,seed),seed,day);
 if(stored?.version!==generationVersion||players.some(player=>!player.personalObjective)){
   players=players.map(player=>withPersonalObjective(player,day));
   db.exec({sql:'INSERT INTO web_career_world VALUES(?,?,?,?) ON CONFLICT(career_id) DO UPDATE SET version=excluded.version,players=excluded.players',
     bind:[input,seed,generationVersion,JSON.stringify(players)]});
 }
 const discovered=new Set(db.selectObjects('SELECT DISTINCT player_id FROM web_contracts WHERE career_id=?',[input]).map(row=>Number(row.player_id)));
 const loaned=new Set(activeLoans(loansFor(input),day).map(loan=>loan.player_id));
 result=players.map(player=>({...publicPlayer(player,discovered.has(player.id)),onLoan:loaned.has(player.id),condition:{...playerCondition(player,day),day}}));
 }else if(action==='contracts'){
 const loans=loansFor(input),day=get(input)!.day;
 result=activeLoans(loans,day).length?loanContracts(await marketPlayers(input),contractsFor(input),loans,day):contractsFor(input);
 }else if(action==='loans'){
 result=loansFor(input);
 }else if(action==='loan-clubs'){
 const catalog=await loadWorld(),career=get(input)!;
 const leagues=new Set(catalog.leagues.filter(league=>league.discipline===career.mode).map(league=>league.id));
 result=catalog.teams.filter(team=>!team.academy&&team.id!==career.entry?.displacedTeamId&&leagues.has(team.league)).map(({id,name})=>({id,name}));
 }else if(action==='import-region'){
 result=latestSeason(read,input)?.editions.find(edition=>edition.importRegion&&edition.participants.some(team=>team.id==='career'))?.importRegion??null;
 }else if(action==='create-loan'){
 const {careerId,playerId,teamId,days}=input;
 if(!loanPeriods.includes(days))throw Error('Escolha 30, 60 ou 90 dias para o empréstimo.');
 const players=await marketPlayers(careerId),catalog=await loadWorld(),career=get(careerId)!;
 const player=players.find(row=>row.id===playerId),team=catalog.teams.find(row=>row.id===teamId&&!row.academy);
 const start=career.day,end=start+days-1,loans=loansFor(careerId),active=activeLoans(loans,start);
 if(!player||player.status||player.mode!==career.mode||!team||team.id===career.entry?.displacedTeamId||catalog.leagues.find(row=>row.id===team.league)?.discipline!==career.mode)
   throw Error('Atleta ou equipe incompatível.');
 if(active.some(row=>row.player_id===playerId))throw Error('Este atleta já está emprestado.');
 const contracts=contractsFor(careerId),owned=contracts.find(row=>row.player_id===playerId);
 const sport=loanPlayers(players,loans,start);
 if(owned){
   if(owned.starter||owned.academy||owned.end_day<end)throw Error('Empreste um reserva com contrato válido durante todo o período.');
   if(sport.filter(row=>row.team===teamId&&!row.status).length>=10)throw Error('O clube de destino já tem dez atletas.');
 }else{
   if(player.team!==teamId||!player.organization)throw Error('O clube indicado não possui este atleta.');
   const remaining=sport.filter(row=>row.team===teamId&&!row.status&&row.id!==playerId);
   if(!remaining.some(row=>row.role===player.role)||
      (player.mode==='MOBA'&&eligibleMobaLineup(remaining.map(row=>({player:row,role:row.role,startDay:start})),leagueMobaRegion(team.league)).length!==5))
     throw Error('O clube de origem precisa manter uma escalação elegível.');
   if(loanContracts(sport,contracts,loans,start).filter(row=>!row.academy).length>=10)throw Error('Seu elenco principal já tem dez atletas.');
 }
 const season=latestSeason(read,careerId);
 if(season&&start<=season.endDay&&end>season.endDay)throw Error('O empréstimo deve terminar dentro da temporada atual.');
 run('INSERT INTO web_loans VALUES(?,?,?,?,?,?,?,0)',[careerId,playerId,owned?'career':teamId,owned?teamId:'career',team.name,start,end]);
 result=get(careerId);
 }else if(action==='lineup-favorites'){
   result=all('SELECT id,name,players FROM web_lineup_favorites WHERE career_id=? ORDER BY name,id',[input]).map(row=>({id:row.id,name:row.name,playerIds:favoriteIds(JSON.parse(String(row.players)))}));
 }else if(action==='lineup-favorite-create'){
   const current=get(input.careerId);
   if(!current)throw Error('Carreira não encontrada.');
   const name=favoriteName(input.name),players=await marketPlayers(current.id);
   const ids=contractsFor(current.id).filter(c=>c.starter&&!c.academy).map(c=>c.player_id);
   validateFavoritePlayers(ids,current.mode as Mode,players,contractsFor(current.id));
   if(Number(read('SELECT COUNT(*) n FROM web_lineup_favorites WHERE career_id=?',[current.id])?.n)>=12)throw Error('Limite de 12 escalações favoritas.');
   run('INSERT INTO web_lineup_favorites VALUES(?,?,?,?)',[current.id,crypto.randomUUID(),name,JSON.stringify(ids)]);
   result=true;
 }else if(action==='lineup-favorite-rename'||action==='lineup-favorite-delete'||action==='lineup-favorite-apply'){
   const {careerId,id}=input;
   const players=action==='lineup-favorite-apply'?await marketPlayers(careerId):null;
   const favorite=read('SELECT players FROM web_lineup_favorites WHERE career_id=? AND id=?',[careerId,id]);
   if(!favorite)throw Error('Escalação favorita não encontrada.');
   if(action==='lineup-favorite-rename')run('UPDATE web_lineup_favorites SET name=? WHERE career_id=? AND id=?',[favoriteName(input.name),careerId,id]);
   if(action==='lineup-favorite-delete')run('DELETE FROM web_lineup_favorites WHERE career_id=? AND id=?',[careerId,id]);
   if(players){
     const current=get(careerId)!;
     const ids=JSON.parse(String(favorite.players));
     const loans=activeLoans(loansFor(careerId),current.day);
     if(loans.some(loan=>ids.includes(loan.player_id)||loan.destination==='career'&&loan.starter))
       throw Error('Ajuste a escalação manualmente enquanto houver atletas emprestados nestas posições.');
     const contracts=contractsFor(careerId);
     validateFavoritePlayers(ids,current.mode as Mode,players,contracts);
     const region=latestSeason(read,careerId)?.editions.find(edition=>edition.importRegion&&edition.participants.some(team=>team.id==='career'))?.importRegion;
     if(region&&players.filter(player=>ids.includes(player.id)&&mobaImports([{player,role:player.role,startDay:current.day}],region)).length>regionalPolicies[region].limit)
       throw Error('A escalação favorita supera o limite regional de importados.');
     applyFavorite(run,read,careerId,ids,()=>contractsFor(careerId));
   }
   result=get(careerId);
 }else if(action==='starter'){
 const id=input.careerId,day=get(id)!.day,loans=activeLoans(loansFor(id),day);
 const assignment=loans.find(row=>row.player_id===input.playerId);
 if(assignment?.origin==='career')throw Error('O atleta está emprestado.');
 const region=latestSeason(read,id)?.editions.find(edition=>edition.importRegion&&edition.participants.some(team=>team.id==='career'))?.importRegion;
 const players=loans.length||region?await marketPlayers(id):[],athlete=players.find(row=>row.id===input.playerId);
 if(region&&athlete){
   const current=careerLineup(players,loanContracts(players,contractsFor(id),loans,day));
   const projected=[...current.filter(slot=>slot.role!==athlete.role),{player:athlete,role:athlete.role,startDay:day}];
   const count=mobaImports(projected,region);
   if(count>regionalPolicies[region].limit&&count>=mobaImports(current,region))throw Error('A escalação MOBA ficaria acima do limite regional de importados.');
 }
 if(assignment){
   db.transaction(()=>{
     for(const other of loans.filter(row=>row.destination==='career'&&players.find(p=>p.id===row.player_id)?.role===athlete?.role))
       run('UPDATE web_loans SET starter=? WHERE career_id=? AND player_id=? AND start_day=?',[Number(other.player_id===input.playerId),id,other.player_id,other.start_day]);
   });
 }else{
   selectStarter(run,read,id,input.playerId);
   for(const other of loans.filter(row=>row.destination==='career'&&players.find(p=>p.id===row.player_id)?.role===athlete?.role))
     run('UPDATE web_loans SET starter=0 WHERE career_id=? AND player_id=? AND start_day=?',[id,other.player_id,other.start_day]);
 }
 result=true;
 }else if(action==='training'){
 const owned=ownedIds(input);
 result=trainingRows(input).filter(row=>owned.has(Number(row.player_id)));
 }else if(action==='training-agenda'){
 const career=get(input)!;
 result=all('SELECT mode,day,data FROM web_training_events WHERE career_id=? AND day>=? AND done=0 ORDER BY day',[input,career.day])
   .map(row=>({day:row.day,mode:row.mode,kind:JSON.parse(String(row.data)).kind}));
 }else if(action==='training-week'){
 const catalog=await loadWorld(),career=get(input)!;
 const names=new Map(catalog.teams.map(team=>[team.id,team.name]));
 const season=latestSeason(read,input);
 const official=(season?.editions??[]).flatMap(edition=>edition.fixtures.filter(game=>game.home==='career'||game.away==='career').map(game=>({
   day:game.result?.completedDay??game.day,mode:edition.mode,name:edition.name,done:!!game.result,fixture:game.id,kind:'official',
 })));
 const friendlies=all('SELECT day,mode,id,result FROM web_matches WHERE career_id=?',[input]).map(row=>({
   day:row.day,mode:row.mode,name:'Amistoso',done:!!row.result,fixture:row.id,kind:'friendly',
 }));
 result={
   events:all('SELECT mode,day,data,done,result FROM web_training_events WHERE career_id=? ORDER BY day',[input]).map(row=>{
     const data=JSON.parse(String(row.data));
     return {...data,mode:row.mode,day:row.day,done:!!row.done,result:row.result?JSON.parse(String(row.result)):null,opponentName:names.get(data.opponent)};
   }),
   schedule:[...official,...friendlies],
   models:all('SELECT id,name,data FROM web_training_weeks WHERE career_id=? ORDER BY name,id',[input]).map(row=>({id:row.id,name:row.name,slots:JSON.parse(String(row.data))})),
   opponents:catalog.teams.filter(team=>!team.academy&&team.id!==career.entry?.displacedTeamId&&catalog.leagues.some(league=>league.id===team.league&&league.discipline===career.mode))
     .map(team=>({id:team.id,name:team.name})),
   facilities:Object.fromEntries(all('SELECT kind,level FROM web_facilities WHERE career_id=?',[input]).map(row=>[row.kind,row.level])),
 };
 }else if(action==='training-model-save'||action==='training-model-rename'||action==='training-model-delete'){
 const {careerId,id}=input;
 if(action==='training-model-save')run('INSERT INTO web_training_weeks VALUES(?,?,?,?)',[careerId,crypto.randomUUID(),favoriteName(input.name),JSON.stringify(validateWeekSlots(input.slots))]);
 if(action==='training-model-rename')run('UPDATE web_training_weeks SET name=? WHERE career_id=? AND id=?',[favoriteName(input.name),careerId,id]);
 if(action==='training-model-delete')run('DELETE FROM web_training_weeks WHERE career_id=? AND id=?',[careerId,id]);
 result=true;
 }else if(action==='training-week-apply'||action==='training-event-plan'){
 const {careerId,start}=input;
 const model=action==='training-week-apply'?read('SELECT data FROM web_training_weeks WHERE career_id=? AND id=?',[careerId,input.modelId]):null;
 if(action==='training-week-apply'&&!model)throw Error('Modelo de semana não encontrado.');
 const slots=validateWeekSlots(model?JSON.parse(String(model.data)):[input.slot]);
 const career=get(careerId)!;
 if(!Number.isSafeInteger(start)||start<career.day||start>career.day+90)throw Error('Planeje entre hoje e os próximos 90 dias.');
 for(const slot of slots)if(slot.kind==='scrim'){
   if(!slot.opponent||slot.opponent===career.entry?.displacedTeamId)throw Error('Escolha uma organização adversária disponível.');
   await matchContext(careerId,slot.opponent,slot.players,start+slot.offset);
 }
 db.transaction(()=>{
   const current=get(careerId)!;
   for(const slot of slots){
     const day=start+slot.offset;
     if(day<current.day||trainingConflict(careerId,current.mode,day))throw Error('Há um compromisso de partida nesta data. Escolha outro dia.');
     const existing=read('SELECT done FROM web_training_events WHERE career_id=? AND mode=? AND day=?',[careerId,current.mode,day]);
     if(existing&&(model||existing.done))throw Error('Já existe uma atividade nessa data.');
     run(`INSERT INTO web_training_events(career_id,mode,day,data) VALUES(?,?,?,?)
       ON CONFLICT(career_id,mode,day) DO UPDATE SET data=excluded.data`,[careerId,current.mode,day,JSON.stringify(slot)]);
   }
 });
 result=true;
 }else if(action==='training-event-cancel'||action==='training-event-complete'){
 const {careerId,day}=input,career=get(careerId)!;
 const key=[careerId,career.mode,day];
 const row=read('SELECT data,done FROM web_training_events WHERE career_id=? AND mode=? AND day=?',key);
 if(!row||row.done||day<career.day)throw Error('A atividade já está encerrada.');
 if(action==='training-event-cancel'){
   run('DELETE FROM web_training_events WHERE career_id=? AND mode=? AND day=? AND done=0',key);result=career;
 }else{
   if(day!==career.day||trainingConflict(careerId,career.mode,day))throw Error('A atividade só pode ser realizada na data planejada e sem conflito.');
   const slot=JSON.parse(String(row.data)) as TrainingSlot;
   const context=slot.kind==='scrim'?await matchContext(careerId,slot.opponent!,slot.players,day):null;
   db.transaction(()=>{
     const current=read('SELECT data,done FROM web_training_events WHERE career_id=? AND mode=? AND day=?',key);
     if(!current||current.done||current.data!==row.data||get(careerId)!.day!==day||trainingConflict(careerId,career.mode,day))throw Error('A atividade não está mais disponível.');
     const match=context?simulateMatch(career.mode as Mode,day,context.sides,hashSeed(careerId+':scrim:'+day)):null;
     run("UPDATE web_training_events SET done=1,result=NULLIF(?,'') WHERE career_id=? AND mode=? AND day=?",[match?JSON.stringify(match):'',...key]);
     if(context&&match){
       const participated=new Set(context.sides[0].lineup.map(member=>member.player.id));
       writeMarketPlayers(careerId,context.players.map(player=>{
         if(!participated.has(player.id))return player;
         const condition=playerCondition(player,day);
         return {...player,condition:{...condition,day,fatigue:Math.min(100,condition.fatigue+4)}};
       }));
     }
   });
   result=get(careerId);
 }
 }else if(action==='assign-academy'||action==='set-training'){
 const player=(await marketPlayers(input.careerId)).find(p=>p.id===input.playerId);
 if(!player)throw Error('Atleta não encontrado.');
 if(action==='assign-academy'){
   assignAcademy(run,read,input.careerId,player,input.academy);
   if(input.academy)recordAcademy(input.careerId,get(input.careerId)!.day,[player],new Set([player.id]));
 }
 else setTrainingFocus(run,read,input.careerId,player,input.focus);
 result=get(input.careerId);
 }else if(action==='academy-evaluation'){
 const career=get(input)!;
 const snapshots=all('SELECT player_id,day,data FROM web_academy_snapshots WHERE career_id=? ORDER BY day,player_id',[input])
   .map(({player_id,day,data})=>({player_id,day,snapshot:JSON.parse(String(data))}));
 const tryouts=all('SELECT player_id,start_day,end_day,state,opening,final FROM web_tryouts WHERE career_id=? ORDER BY start_day DESC,player_id',[input])
   .map(row=>({...row,opening:JSON.parse(String(row.opening)),final:row.final==null?null:JSON.parse(String(row.final))}));
 const competitive=all('SELECT data FROM web_competition_seasons WHERE career_id=? ORDER BY number',[input])
   .flatMap(({data})=>contractFixtures(JSON.parse(String(data)),career.day))
   .map(row=>({day:row.day,mode:row.mode,won:row.won,appearances:[...row.appearances]}));
 result={snapshots,tryouts,competitive,coach:!!read('SELECT 1 FROM web_youth_coach WHERE career_id=?',[input]),
   coachAvailable:Number(read("SELECT level FROM web_facilities WHERE career_id=? AND kind='academy'",[input])?.level??0)>=1};
 }else if(action==='youth-coach'){
 if(typeof input.enabled!=='boolean')throw Error('Selecione a especialização.');
 if(input.enabled){
   if(Number(read("SELECT level FROM web_facilities WHERE career_id=? AND kind='academy'",[input.careerId])?.level??0)<1)
     throw Error('A especialização requer a instalação Academy no nível 1.');
   run('INSERT OR IGNORE INTO web_youth_coach VALUES(?)',[input.careerId]);
 }else run('DELETE FROM web_youth_coach WHERE career_id=?',[input.careerId]);
 result=true;
 }else if(action==='start-tryout'){
 const {careerId,playerId,days}=input;
 if(!tryoutDurations.includes(days))throw Error('Escolha 7, 14 ou 21 dias.');
 const player=(await marketPlayers(careerId)).find(row=>row.id===playerId),career=get(careerId)!;
 if(!player||!tryoutAvailable(player,career.mode)||ownedIds(careerId).has(playerId))throw Error('O candidato não está disponível para avaliação.');
 if(read("SELECT 1 FROM web_tryouts WHERE career_id=? AND player_id=? AND state IN ('active','completed')",[careerId,playerId]))
   throw Error('O candidato já tem uma avaliação aberta.');
 if(Number(read("SELECT COUNT(*) total FROM web_tryouts WHERE career_id=? AND state='active'",[careerId])?.total)>=3)
   throw Error('Finalize uma das três avaliações em andamento.');
 db.transaction(()=>{
   run("INSERT INTO web_tryouts VALUES(?,?,?,?,'active',?,NULL)",[careerId,playerId,career.day,career.day+days,JSON.stringify(athleteSnapshot(player))]);
   const stored=savedPlayers(careerId);
   if(player.status==='ranked'&&typeof stored==='string')recordRanked(careerId,JSON.parse(stored) as Player[],new Set([playerId]),career.day);
 });
 result=true;
 }else if(action==='dismiss-tryout'){
 const {careerId,playerId,startDay}=input;
 const player=(await marketPlayers(careerId)).find(row=>row.id===playerId);
 db.transaction(()=>{
   if(!read("SELECT 1 FROM web_tryouts WHERE career_id=? AND player_id=? AND start_day=? AND state IN ('active','completed')",[careerId,playerId,startDay]))
     throw Error('Essa avaliação já está encerrada.');
   run("UPDATE web_tryouts SET state='dismissed' WHERE career_id=? AND player_id=? AND start_day=?",[careerId,playerId,startDay]);
   if(player?.status==='ranked')run("UPDATE web_negotiations SET state='cancelled' WHERE career_id=? AND player_id=? AND state IN ('accepted','counter')",[careerId,playerId]);
 });
 result=true;
 }else if(action==='news'){
 const current=get(input.careerId);if(!current)throw Error('Carreira não encontrada.');
 const catalog=await loadWorld(),stored=savedPlayers(current.id);
 const world=typeof stored==='string'?JSON.parse(stored) as Player[]:await loadPlayers();
 const imported=all('SELECT data FROM web_imported_players WHERE career_id=?',[current.id]).map(row=>JSON.parse(String(row.data)) as Player);
 db.transaction(()=>synchronizeNews(run,read,all,current,[...world,...imported],catalog));
 result=listNews(read,all,current.id,input.filter??{},[...world,...imported]);
 }else if(action==='finance-state'){
 const current=get(input.careerId);if(!current)throw Error('Carreira não encontrada.');
 initializeFinance(run,read,all,current.id);
 const seasons=all('SELECT data FROM web_competition_seasons WHERE career_id=? ORDER BY number',[current.id]).map(row=>JSON.parse(String(row.data)) as Season);
 const exposure=seasons.reduce((sum,season)=>sum+season.editions.reduce((points,event)=>points+
   event.fixtures.filter(game=>game.result?.maps.length&&(game.home==='career'||game.away==='career')).length*(event.prestige==='Regional'?1:2),0),0);
 const partners=Number(read("SELECT COUNT(DISTINCT company) total FROM web_sponsors WHERE career_id=? AND state='accepted'",[current.id])?.total??0);
 const recognition=commercialRecognition(current.day,exposure,partners);
 refreshSponsorOffers(run,read,current.id,current.day,current.reputation??40,current.mode,countryRegions[current.country],recognition);
 const selected=seasons.find(s=>s.number===input.season)||[...seasons].reverse().find(s=>s.startDay<=current.day);
 const periodStart=selected?.startDay??1,next=selected?seasons.find(s=>s.number>selected.number):undefined;
 const periodEnd=Math.min(current.day,next?next.startDay-1:current.day);
 const totals=read(`SELECT COALESCE(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END),0) income,
   COALESCE(SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END),0) expenses FROM web_cash_events WHERE career_id=? AND day BETWEEN ? AND ?`,[current.id,periodStart,periodEnd])!;
 const sponsors=all('SELECT * FROM web_sponsors WHERE career_id=? ORDER BY offered_day DESC,id',[current.id]);
 const outstanding=Number(read('SELECT COALESCE(SUM(amount-paid),0) total FROM web_payroll WHERE career_id=?',[current.id])?.total??0);
 const equipmentPlayers=ownedIds(current.id);
 const horizon=current.day+360;
 const schedule:ScheduledCash[]=sponsors.filter(row=>row.state==='accepted'&&sponsorCashOnlyValue(String(row.id),Number(row.payment))>0).flatMap(row=>paymentPeriods(
   Number(row.accepted_day),Number(row.accepted_day)+Number(row.duration)-1,current.day,horizon
 ).map(period=>({day:period.day,income:Math.round(Number(row.payment)*(period.day-period.start+1)/30)})));
 const deals=all(`SELECT c.* FROM web_contracts c WHERE c.career_id=? AND c.end_day>? AND c.start_day<=?
   AND NOT EXISTS(SELECT 1 FROM web_contract_closures x WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day)`,[current.id,current.day,horizon]);
 for(const contract of deals)for(const period of paymentPeriods(Number(contract.start_day),Number(contract.end_day),current.day,horizon)){
   const expense=salaryDue(all,current.id,contract,period.start,period.day);
   const recorded=Number(read('SELECT COALESCE(SUM(amount),0) total FROM web_payroll WHERE career_id=? AND player_id=? AND start_day=? AND due_day BETWEEN ? AND ?',
     [current.id,Number(contract.player_id),Number(contract.start_day),period.start,period.day])?.total??0);
   schedule.push({day:period.day,expense:Math.max(0,expense-recorded)});
 }
 result={balance:current.balance,reputation:current.reputation??40,recognition,periodStart,periodEnd,seasons:seasons.map(s=>({number:s.number,year:s.year,startDay:s.startDay})),
   income:Number(totals.income),expenses:Number(totals.expenses),result:Number(totals.income)-Number(totals.expenses),
   payroll:Number(read('SELECT COALESCE(SUM(salary),0) total FROM web_current_contracts WHERE career_id=?',[current.id])?.total??0),
   outstanding,projection:cashProjection(current.day,current.balance,outstanding,schedule),
   openingBalance:Number(read('SELECT opening_balance FROM web_finance_state WHERE career_id=?',[current.id])?.opening_balance),
   ledgerTotal:Number(read('SELECT COALESCE(SUM(amount),0) total FROM web_cash_events WHERE career_id=?',[current.id])?.total??0),
   sponsors,equipment:all('SELECT sku,quantity FROM web_equipment_stock WHERE career_id=? ORDER BY sku',[current.id]),
   equipmentPlayers:[...equipmentPlayers],setups:all('SELECT player_id,category,sku,unit FROM web_equipment_setup WHERE career_id=?',[current.id]).filter(row=>equipmentPlayers.has(Number(row.player_id))),
   facilities:all('SELECT kind,level,upgraded_day FROM web_facilities WHERE career_id=?',[current.id]),
   facilityInvestment:Number(read("SELECT COALESCE(-SUM(amount),0) total FROM web_cash_events WHERE career_id=? AND category='facility'",[current.id])?.total??0),
   transactions:all('SELECT event_key,day,category,amount,description FROM web_cash_events WHERE career_id=? AND day BETWEEN ? AND ? ORDER BY day DESC,rowid DESC LIMIT 200',[current.id,periodStart,periodEnd])};
 }else if(action==='sponsor-accept'){
 acceptSponsor(run,read,input.careerId,input.id,get(input.careerId)?.reputation??40);result=get(input.careerId);
 }else if(action==='sponsor-reject'){
 rejectSponsor(run,read,input.careerId,input.id);result=true;
 }else if(action==='equipment-assign'){
 const current=get(input.careerId);
 if(!current||!Object.hasOwn(equipmentCategories,input.category)||!Number.isSafeInteger(input.playerId)||typeof input.sku!=='string')
   throw Error('Atribuição de equipamento inválida.');
 const athlete=(await marketPlayers(current.id)).find(player=>player.id===input.playerId);
 if(!athlete||athlete.status||!ownedIds(current.id).has(athlete.id))throw Error('Atleta indisponível no elenco.');
 db.transaction(()=>{
   const owned=ownedIds(current.id);
   if(!owned.has(athlete.id))throw Error('Atleta indisponível no elenco.');
   const assignments=all('SELECT player_id,category,sku,unit FROM web_equipment_setup WHERE career_id=?',[current.id]);
   for(const row of assignments)if(!owned.has(Number(row.player_id)))
     run('DELETE FROM web_equipment_setup WHERE career_id=? AND player_id=? AND category=?',[current.id,Number(row.player_id),String(row.category)]);
   const key=[current.id,athlete.id,input.category] as [string,number,string];
   if(!input.sku){
     run('DELETE FROM web_equipment_setup WHERE career_id=? AND player_id=? AND category=?',key);
     return;
   }
   const item=equipmentCatalog.find(row=>row.id===input.sku&&row.mode===athlete.mode&&row.slots.includes(input.category));
   if(!item)throw Error('Este produto é incompatível com o atleta ou a categoria.');
   const stock=Number(read('SELECT quantity FROM web_equipment_stock WHERE career_id=? AND sku=?',[current.id,item.id])?.quantity??0);
   const reserved=new Set(assignments.filter(row=>row.sku===item.id&&row.category===input.category&&Number(row.player_id)!==athlete.id&&owned.has(Number(row.player_id))).map(row=>Number(row.unit)));
   const unit=Array.from({length:stock},(_,index)=>index+1).find(number=>!reserved.has(number));
   if(!unit)throw Error('Nenhuma unidade livre neste inventário.');
   run('INSERT INTO web_equipment_setup VALUES(?,?,?,?,?) ON CONFLICT(career_id,player_id,category) DO UPDATE SET sku=excluded.sku,unit=excluded.unit',[...key,item.id,unit]);
 });
 result=get(current.id);
 }else if(action==='equipment-buy'){
 const current=get(input.careerId),item=equipmentCatalog.find(row=>row.id===input.sku);
 if(!current||!item||!item.price||item.mode!==current.mode||!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>10||
   typeof input.orderId!=='string'||!/^[-a-f0-9]{36}$/.test(input.orderId))throw Error('Compra de equipamento inválida.');
 const cost=item.price*input.quantity,key='equipment:'+input.orderId;
 db.transaction(()=>{
   if(read('SELECT 1 FROM web_cash_events WHERE career_id=? AND event_key=?',[current.id,key]))return;
   if(get(current.id)!.balance<cost)throw Error('Caixa insuficiente para a compra.');
   const stock=Number(read('SELECT quantity FROM web_equipment_stock WHERE career_id=? AND sku=?',[current.id,item.id])?.quantity??0);
   if(stock+input.quantity>10)throw Error('O inventário aceita até dez unidades por kit.');
   run('INSERT INTO web_equipment_stock VALUES(?,?,?) ON CONFLICT(career_id,sku) DO UPDATE SET quantity=quantity+excluded.quantity',[current.id,item.id,input.quantity]);
   run('UPDATE careers SET balance=balance-? WHERE id=?',[cost,current.id]);
   recordCash(run,current.id,key,current.day,'equipment',-cost,input.quantity+' × '+item.name+' '+item.label);
 });
 result=get(current.id);
 }else if(action==='facility-upgrade'){
 upgradeFacility(run,read,input.careerId,input.kind,input.expectedLevel);result=get(input.careerId);
 }else if(action==='competition-state'){
 const seasons=all('SELECT data FROM web_competition_seasons WHERE career_id=? ORDER BY number DESC',[input]).map(row=>JSON.parse(String(row.data)) as Season);
 const current=get(input);
 result={seasons,...(current?{rankings:buildCompetitionRankings(seasons,current,await loadWorld())}:{}),
   config:validateCompetitionConfig(JSON.parse(String(read('SELECT data FROM web_competition_config WHERE career_id=?',[input])?.data??JSON.stringify(defaultCompetitionConfig)))),
   awards:all('SELECT * FROM web_competition_awards WHERE career_id=? ORDER BY season DESC,day DESC,competition_id',[input])};
 }else if(action==='competition-config'){
 const config=validateCompetitionConfig(input.config);
 run('INSERT INTO web_competition_config VALUES(?,?) ON CONFLICT(career_id) DO UPDATE SET data=excluded.data',[input.careerId,JSON.stringify(config)]);result=true;
 }else if(action==='start-season'){
 const current=get(input)!;if(!current)throw Error('Carreira não encontrada.');
 const old=latestSeason(read,input),players=await marketPlayers(input),catalog=await loadWorld();
 const config=JSON.parse(String(read('SELECT data FROM web_competition_config WHERE career_id=?',[input])?.data??JSON.stringify(defaultCompetitionConfig)));
 const bonuses=Object.fromEntries(all('SELECT organization,SUM(reputation) gain FROM web_competition_awards WHERE career_id=? GROUP BY organization',[input]).map(row=>[String(row.organization),Number(row.gain)]));
 const start=nextSeasonStart(old,current.day),loans=loansFor(input),sport=loanPlayers(players,loans,start);
 const history=current.mode==='MOBA'&&config.moba_world?.stageRules?.regionalSlots==='prestige'
   ?all('SELECT data FROM web_competition_seasons WHERE career_id=? ORDER BY number DESC',[input]).map(row=>JSON.parse(String(row.data)) as Season)
   :undefined;
 const season=generateSeason(current,catalog,sport,loanContracts(sport,contractsFor(input),loans,start),(old?.number??0)+1,start,config,bonuses,old,true,history);
 storeNewSeason(run,read,input,season);result=season;
 }else if(action==='enroll-competition'){
 const current=get(input.careerId),players=await marketPlayers(input.careerId);
 if(!current)throw Error('Carreira não encontrada.');
 db.transaction(()=>{
   const season=latestSeason(read,input.careerId),event=season?.editions.find(e=>e.id===input.id);
   const own=season?.editions.flatMap(e=>e.participants).find(p=>p.id==='career');
   if(!season||!event?.entryWindow||!own)throw Error('Torneio opcional não encontrado.');
   if(!event.participants.some(p=>p.id==='career')){
     const side=competitionSide(own,players,event.mode,current.day,current.id);
     matchStrength(side,event.mode,current.day);
     if(event.importRegion&&mobaImports(side.lineup,event.importRegion)>regionalPolicies[event.importRegion].limit)
       throw Error('A escalação supera o limite de importados do torneio.');
     if(optionalEventDays(event).some(day=>read('SELECT 1 FROM web_training_events WHERE career_id=? AND mode=? AND day=?',[current.id,event.mode,day])))
       throw Error('Há treinamento agendado em uma das datas do torneio.');
     enrollOptionalEvent(season,event.id,current.day,own);
     run('UPDATE web_competition_seasons SET data=? WHERE career_id=? AND number=?',[JSON.stringify(season),current.id,season.number]);
   }
   result=season;
 });
 }else if(action==='play-competition'){
 const season=latestSeason(read,input.careerId),current=get(input.careerId)!;
 const edition=season?.editions.find(e=>e.fixtures.some(g=>g.id===input.id)),game=edition?.fixtures.find(g=>g.id===input.id);
 if(!season||!edition||!game||!current)throw Error('Confronto não encontrado.');
 if(game.result||game.status==='completed')throw Error('Este confronto já foi concluído.');
 if(!isScheduledFixture(game))throw Error('Este confronto não está disponível.');
 if(game.home!=='career'&&game.away!=='career')throw Error('Os confrontos da IA são automáticos.');
 const catalog=await loadWorld();let players=await marketPlayers(input.careerId);
 const seed=Number(db.selectValue('SELECT seed FROM web_career_world WHERE career_id=?',[input.careerId]));
 db.transaction(()=>{
   players=maintainRosters(players,catalog,ownedIds(input.careerId),current.day,aiHiring(input.careerId,current.day));
   const loans=loansFor(current.id);
   lockCompetitionRosters(season,current.day,day=>registrationIds(current.id,day,loans));
   const teams=[game.home,game.away].map(id=>competitionSide(edition.participants.find(p=>p.id===id)!,players,edition.mode,current.day,input.careerId,undefined,edition.importRegion)) as [MatchSide,MatchSide];
   if(game.away==='career'&&current.uniforms?.away)teams[1].uniform=current.uniforms.away;
   if(edition.registration){
     const submitted=competitionLineup(edition,players,loanContracts(players,contractsFor(current.id),loans,current.day),current.day);
     if(!submitted.valid&&!input.forfeit)throw Error('A escalação contém atletas inelegíveis ou funções sem titular. Selecione reservas registrados no elenco.');
     if(input.forfeit&&submitted.valid)throw Error('A organização tem uma escalação elegível para a série.');
     const own=teams.find(team=>team.id==='career')!;
     own.lineup=submitted.lineup;
   }else if(input.forfeit)throw Error('Resultado administrativo indisponível para esta edição.');
   const series=playCompetitionFixture(season,input.id,current.day,teams,seed,{strategy:input.strategy},input.forfeit===true);
   for(const map of series.maps)players=applyMatchConditions(players,map);
   players=processAI(season,current.day,players,input.careerId,ownedIds(input.careerId),seed);
   writeMarketPlayers(input.careerId,players);
 });
 result={career:get(input.careerId),season};
 }else if(action==='calendar'){
 result=db.selectObjects('SELECT player_id, due_day, amount, paid FROM web_payroll WHERE career_id=? ORDER BY due_day DESC,player_id',[input]);
 }else if(action==='matches'){
 result=all('SELECT id,opponent_team_id,mode,day,result FROM web_matches WHERE career_id=? ORDER BY day DESC,rowid DESC LIMIT 100',[input])
   .map(row=>({...row,result:row.result?JSON.parse(String(row.result)):null}));
 }else if(action==='prepare-match'){
 const friendlyCareer=get(input.careerId)!;
 if(read('SELECT 1 FROM web_training_events WHERE career_id=? AND mode=? AND day=?',[input.careerId,friendlyCareer.mode,friendlyCareer.day]))
   throw Error('Já existe uma atividade de treinamento nesta data.');
 await matchContext(input.careerId,input.opponentId);
 const matchId=crypto.randomUUID();
 prepareMatch(run,read,input.careerId,matchId,input.opponentId,crypto.getRandomValues(new Uint32Array(1))[0]);
 result={...read('SELECT id,opponent_team_id,mode,day FROM web_matches WHERE id=?',[matchId]),result:null};
 }else if(action==='cancel-match'){
 run("DELETE FROM web_matches WHERE career_id=? AND id=? AND result=''",[input.careerId,input.id]);result=true;
 }else if(action==='play-match'){
 const friendlyCareer=get(input.careerId)!;
 if(read('SELECT 1 FROM web_training_events WHERE career_id=? AND mode=? AND day=?',[input.careerId,friendlyCareer.mode,friendlyCareer.day]))
   throw Error('Já existe uma atividade de treinamento nesta data.');
 const match=read('SELECT opponent_team_id,result FROM web_matches WHERE career_id=? AND id=?',[input.careerId,input.id]);
 if(!match)throw Error('Partida não encontrada.');
 if(match.result)throw Error('Esta partida já foi concluída.');
 const {sides,players}=await matchContext(input.careerId,String(match.opponent_team_id));
 const completed=completeMatch(run,read,input.careerId,input.id,sides,result=>writeMarketPlayers(input.careerId,applyMatchConditions(players,result)),{strategy:input.strategy,mapId:input.mapId});
 result={career:get(input.careerId),result:completed};
 }else if(action==='timeline'||action==='player-milestones'){
 const personal=action==='player-milestones';
 const careerId=personal?input.careerId:input;
 if(personal&&!Number.isSafeInteger(input.playerId))throw Error('Atleta inválido.');
 const rows=db.selectObjects(`SELECT * FROM (
   SELECT start_day AS day,player_id,'hired' AS kind FROM web_contracts WHERE career_id=?
   UNION ALL SELECT end_day+1,player_id,'expired' FROM web_contracts c
     WHERE career_id=? AND end_day<(SELECT day FROM careers WHERE id=?)
       AND NOT EXISTS(SELECT 1 FROM web_contract_closures x WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day)
   UNION ALL SELECT day,player_id,'starter' FROM web_lineup_history WHERE career_id=?
   UNION ALL SELECT day,player_id,kind FROM web_market_moves WHERE career_id=? AND kind IN ('sold','released','renewed')
   UNION ALL SELECT day,0,'match' FROM web_matches WHERE career_id=? AND result<>''
   ) ${personal?'WHERE player_id=?':''} ORDER BY day DESC,player_id,kind ${personal?'':'LIMIT 200'}`,
   personal?[careerId,careerId,careerId,careerId,careerId,careerId,input.playerId]:[careerId,careerId,careerId,careerId,careerId,careerId]);
 if(!personal)result=rows;
 else{
   const events:PlayerMilestone[]=rows.map(row=>({day:Number(row.day),kind:'Vínculo',text:rosterEventNames[row.kind as keyof typeof rosterEventNames]}));
   for(const row of all("SELECT id,result FROM web_matches WHERE career_id=? AND result<>'' AND EXISTS(SELECT 1 FROM json_each(result,'$.stats') WHERE json_extract(value,'$.playerId')=?)",[careerId,input.playerId])){
     const match=JSON.parse(String(row.result)) as MatchResult;
     if(participated(match,input.playerId))events.push({id:`friendly:${row.id}`,day:match.day,kind:'Partida',text:`Amistoso · ${match.teams[0].name} × ${match.teams[1].name}${match.mvp===input.playerId?' · MVP':''}`});
   }
   const seasons=all('SELECT data FROM web_competition_seasons WHERE career_id=?',[careerId]).map(row=>JSON.parse(String(row.data)) as Season);
   result=[...events,...competitionMilestones(seasons,input.playerId)];
 }
 }else if(action==='advance'){
 if(![1,7,30].includes(input.days))throw Error('Escolha 1, 7 ou 30 dias.');
 const advancingCareer=get(input.careerId)!;
 const marketCatalog=await loadWorld();
 let competition=latestSeason(read,input.careerId);
 const seasonLoans=loansFor(input.careerId);
 let solo=read('SELECT start_day,end_day FROM web_solo_seasons WHERE career_id=? ORDER BY start_day DESC LIMIT 1',[input.careerId]);
 const observedRanked=new Set(watched(input.careerId));
 const regionalTeams=new Map(marketCatalog.teams.filter(team=>marketCatalog.leagues.some(league=>league.id===team.league&&league.discipline==='MOBA')).map(team=>[team.id,leagueMobaRegion(team.league)]));
 const careerRegion=competition?.editions.find(edition=>edition.importRegion&&edition.participants.some(team=>team.id==='career'))?.importRegion;
 let {days,stoppedAt}=planCompetitionAdvance(competition,input.expectedDay,input.days);
 if(!days)throw Error('Nenhum dia avançado. Dispute o confronto pendente antes de avançar.');
 let players=await marketPlayers(input.careerId);
 const seed=Number(db.selectValue('SELECT seed FROM web_career_world WHERE career_id=?',[input.careerId]));
 class NewFixtureDeadline extends Error{
   readonly fixture:NonNullable<typeof stoppedAt>;
   constructor(fixture:NonNullable<typeof stoppedAt>){super('Novo compromisso oficial');this.fixture=fixture;}
 }
 const advanceTo=()=>advanceCareerDay(run,read,all,input.careerId,input.expectedDay,days,(from,to)=>{
   run("UPDATE web_negotiations SET state='expired' WHERE career_id=? AND expires_day<? AND state IN ('accepted','counter')",[input.careerId,to]);
   const contracts=all(`SELECT player_id,start_day,salary,MIN(end_day,COALESCE((SELECT day-1 FROM web_contract_closures x
     WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day),end_day)) end_day
     FROM web_contracts c WHERE career_id=? AND start_day<=? AND end_day>=?`,[input.careerId,to,from])
     .map(row=>({player_id:Number(row.player_id),start_day:Number(row.start_day),end_day:Number(row.end_day),salary:Number(row.salary)})).filter(c=>c.end_day>=from);
   const training=new Map(trainingRows(input.careerId)
     .map(row=>[Number(row.player_id),row as unknown as PlayerTraining]));
   const facilityLevels=Object.fromEntries(all('SELECT kind,level FROM web_facilities WHERE career_id=?',[input.careerId]).map(row=>[String(row.kind),Number(row.level)])) as Partial<FacilityLevels>;
   const coach=!!read('SELECT 1 FROM web_youth_coach WHERE career_id=?',[input.careerId]);
   const academy=new Set([...training].filter(([,row])=>row.academy).map(([id])=>id));
   const gear=all('SELECT player_id,category,sku,unit FROM web_equipment_setup WHERE career_id=?',[input.careerId]) as unknown as EquipmentAssignment[];
   const needsBaseline=new Set([...academy].filter(id=>!read('SELECT 1 FROM web_academy_snapshots WHERE career_id=? AND player_id=? LIMIT 1',[input.careerId,id])));
   recordAcademy(input.careerId,from,players,needsBaseline);
   const activeTryouts=all("SELECT player_id,start_day,end_day FROM web_tryouts WHERE career_id=? AND state='active'",[input.careerId]);
   const legacy=new Set(all(`SELECT player_id FROM web_imported_players p WHERE career_id=? AND member=1
     AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)`,[input.careerId]).map(row=>Number(row.player_id)));
   const plansFor=(id:number):TrainingPlan[]=>{
     const config=training.get(id),focus=config?.focus??'balanced';
     const efficiency=Math.min(1.12,facilityEfficiency(facilityLevels,!!config?.academy)+(coach&&config?.academy?0.02:0)+setupTraining(advancingCareer.mode as Mode,gear,id));
     return legacy.has(id)?[{focus,fromDay:config?.changed_day??1,toDay:to,efficiency}]:contracts.filter(c=>c.player_id===id)
       .map(c=>({focus,fromDay:Math.max(config?.changed_day??1,c.start_day),toDay:c.end_day,efficiency}));
   };
   const trainingPlans=new Map([...new Set([...legacy,...contracts.map(c=>c.player_id)])].map(id=>[id,plansFor(id)]));
   const noTraining:TrainingPlan[]=[];
   const annual=seasonBoundaries(from,to);
   for(let day=from+1;day<=to;day++){
     if(competition&&lockCompetitionRosters(competition,day,cutoff=>registrationIds(input.careerId,cutoff,seasonLoans)))
       persistSeason(run,read,input.careerId,competition,day);
     if(!solo||day>Number(solo.end_day)){
       if(solo){
         run("UPDATE web_solo_seasons SET final=? WHERE career_id=? AND start_day=? AND final=''",
           [JSON.stringify(soloStandings(players)),input.careerId,Number(solo.start_day)]);
         players=resetSoloPoints(players);
       }
       solo={start_day:day,end_day:day+soloSeasonDays-1};
       run('INSERT INTO web_solo_seasons(career_id,start_day,end_day) VALUES(?,?,?)',[input.careerId,day,Number(solo.end_day)]);
     }
     const beforeDevelopment=players;
     const monthly=(day-1)%30===0;
     const adaptation=new Map(contracts.filter(c=>c.start_day<=day&&c.end_day>=day&&[30,60].includes(day-c.start_day)).map(c=>[c.player_id,c]));
     players=players.map(player=>{
       let updated=developPlayer(player,day-1,day,trainingPlans.get(player.id)??noTraining);
       const contract=adaptation.get(player.id);
       if(contract)updated=applyAdaptation(updated,contract,day,seed);
       return monthly?observeOverall(updated,day):updated;
     });
     if(day%30===0){syncAiAccounts(run,read,all,input.careerId,players,marketCatalog.organizations.map(org=>org.id),day);payAiSalaries(run,all,input.careerId,day);}
     const currentLoans=activeLoans(seasonLoans,day);
     const loaned=new Set(currentLoans.map(row=>row.player_id));
     if(annual.includes(day))players=renewWorld(players,seed,day,[...contracts,...currentLoans],aiHiring(input.careerId,day));
     const protectedIds=new Set([...legacy,...contracts.filter(c=>c.start_day<=day&&c.end_day>=day).map(c=>c.player_id)]);
     recordDevelopmentNews(run,read,{...advancingCareer,day},beforeDevelopment,players,day,protectedIds);
     players=processMoodEvent(run,read,input.careerId,players,protectedIds,day,seed);
     if(competition?.editions.some(e=>e.fixtures.some(g=>isScheduledFixture(g)&&g.day<=day&&g.home!=='career'&&g.away!=='career'))){
       players=maintainRosters(players,marketCatalog,protectedIds,day,aiHiring(input.careerId,day));
       players=processAI(competition,day,players,input.careerId,protectedIds,seed);
       const deadline=planCompetitionAdvance(competition,from,to-from).stoppedAt;
       if(deadline)throw new NewFixtureDeadline(deadline);
     }
     if(day%28===0&&competition){
       const fixtures=contractFixtures(competition,day),indexed=new Map(players.map(player=>[player.id,player]));
       for(const contract of contracts){
         const athlete=indexed.get(contract.player_id);
         if(!athlete||day<contract.start_day||day>contract.end_day)continue;
         const key=[input.careerId,contract.player_id,contract.start_day];
         const expectation=read('SELECT squad_role,promised_day FROM web_contract_expectations WHERE career_id=? AND player_id=? AND start_day=?',key);
         const objective=withPersonalObjective(athlete,day).personalObjective;
         if(expectation){
           const participation=contractParticipation(fixtures,athlete.id,athlete.mode,Math.max(day-27,Number(expectation.promised_day)+1));
           const changed=expectationDelta(expectation.squad_role as SquadRole,participation,!!training.get(athlete.id)?.academy,objective);
           if(changed){
             const condition=playerCondition(athlete,day);
             indexed.set(athlete.id,{...athlete,condition:{...condition,day,morale:Math.max(0,Math.min(100,condition.morale+changed))}});
           }
         }
         const previous=read('SELECT day,state FROM web_renewal_requests WHERE career_id=? AND player_id=? AND start_day=? ORDER BY day DESC LIMIT 1',key);
         if(previous?.state==='pending')continue;
         const lastRenewal=read("SELECT MAX(day) day FROM web_market_moves WHERE career_id=? AND player_id=? AND day>=? AND kind='renewed'",key);
         const since=Math.max(contract.start_day,Number(lastRenewal?.day??0),Number(previous?.day??0));
         if(day-since<90)continue;
         const baseline=athlete.developmentHistory?.find(point=>point.day>=since&&point.day<=day-90);
         if(!baseline)continue;
         const participation=contractParticipation(fixtures,athlete.id,athlete.mode,Math.max(since+1,day-59));
         const gain=Math.round((athlete.overall-baseline.overall)*100)/100;
         const benchmark=terms(athlete.overall).salary;
         if(renewalGrounds({...participation,gain,elapsed:day-since,salary:contract.salary,benchmark})&&
            (!expectation||expectationDelta(expectation.squad_role as SquadRole,participation,!!training.get(athlete.id)?.academy,objective)>=0)&&
            (objective!=='stability'||contract.end_day-day<=180||gain>=4)){
           run("INSERT OR IGNORE INTO web_renewal_requests VALUES(?,?,?,?,?,?,?,?,'pending')",
             [...key,day,gain,participation.played,participation.available,benchmark]);
         }
       }
       players=Array.from(indexed.values());
     }
     if(day%marketLimits.interval===0&&!read('SELECT 1 FROM web_ai_market_days WHERE career_id=? AND day=?',[input.careerId,day])){
       const id=input.careerId;
       run('INSERT INTO web_ai_market_days VALUES(?,?)',[id,day]);
       const owners=new Map([...protectedIds].map(playerId=>[playerId,(contracts.find(c=>c.player_id===playerId&&c.end_day>=day)?.end_day??day+365)-day]));
       const blocked=new Set(all("SELECT player_id FROM web_negotiations WHERE career_id=? AND expires_day>=? AND state IN ('accepted','counter')",[id,day]).map(row=>Number(row.player_id)));
       for(const playerId of loaned)blocked.add(playerId);
       const bids=marketApproaches(players,marketCatalog,owners,competitiveEvidence(competition,day),approaches(id,day),seed,day,
         (org,player,fee)=>aiCanBuy(read,id,org,player,fee),marketLimits,blocked);
       const indexed=new Map(players.map(player=>[player.id,player]));
       const signed=new Map<number,Approach>();
       for(const bid of bids){
         const athlete=indexed.get(bid.playerId)!;
         const available=players.filter(player=>player.id!==athlete.id&&!signed.has(player.id)&&!loaned.has(player.id)&&player.team===athlete.team&&!player.status);
         const region=athlete.mode==='MOBA'&&athlete.team&&competition?.editions.some(edition=>edition.importRegion&&edition.participants.some(team=>team.id===athlete.team))?regionalTeams.get(athlete.team):undefined;
         const covered=available.some(player=>player.role===athlete.role)&&(!region||eligibleMobaLineup(available.map(player=>({player,role:player.role,startDay:day})),region).length===5);
         if(bid.seller!=='career'&&covered&&aiCanBuy(read,id,bid.organization,athlete,bid.fee)){
           aiPurchase(run,read,id,bid.organization,athlete,bid.fee,day);
           aiReceiveTransfer(run,id,bid.seller,athlete,bid.fee,'ai:'+bid.organization+':'+athlete.id+':'+day,day);
           bid.state='signed';signed.set(athlete.id,bid);
         }else if(bid.seller!=='career')bid.state='declined';
         run('INSERT INTO web_ai_approaches VALUES(?,?,?,?,?)',[id,day,bid.organization,bid.playerId,JSON.stringify(bid)]);
       }
       if(signed.size)players=players.map(player=>{
         const bid=signed.get(player.id);
         return bid?{...player,organization:bid.organization,team:bid.team,history:[{day,description:'Transferido para '+bid.name+'.'},...(player.history??[])]}:player;
       });
     }
     if(careerRegion&&competition&&day>=competition.startDay){
       const assigned=new Map(currentLoans.map(loan=>[loan.player_id,loan.destination]));
       players=players.map(player=>{
         if(player.mode!=='MOBA'||player.status||training.get(player.id)?.academy)return player;
         const team=assigned.get(player.id)??(protectedIds.has(player.id)?'career':player.team);
         const region=team==='career'?careerRegion:team?regionalTeams.get(team):undefined;
         if(!region||(player.mobaTenure?.[region]??0)>=regionalPolicies[region].days)return player;
         return {...player,mobaTenure:{...player.mobaTenure,[region]:(player.mobaTenure?.[region]??0)+1}};
       });
     }
     if(day%7===0)recordRanked(input.careerId,players,new Set([...observedRanked,
       ...activeTryouts.filter(row=>Number(row.end_day)>=day).map(row=>Number(row.player_id))]),day);
     if(monthly)recordAcademy(input.careerId,day,players,new Set([...academy].filter(id=>protectedIds.has(id))));
     for(const evaluation of activeTryouts.filter(row=>Number(row.end_day)===day)){
       recordRanked(input.careerId,players,new Set([Number(evaluation.player_id)]),day);
       const candidate=players.find(row=>row.id===evaluation.player_id);
       const available=!!candidate&&tryoutAvailable(candidate,advancingCareer.mode)&&!protectedIds.has(candidate.id);
       run("UPDATE web_tryouts SET state=?,final=CASE WHEN ?='' THEN NULL ELSE ? END WHERE career_id=? AND player_id=? AND start_day=? AND state='active'",
         [available?'completed':'unavailable',available?'yes':'',available?JSON.stringify(athleteSnapshot(candidate!)):'',input.careerId,Number(evaluation.player_id),Number(evaluation.start_day)]);
     }
     if((day-Number(solo.start_day))%7===0){
       run('INSERT OR IGNORE INTO web_solo_weeks VALUES(?,?,?)',[input.careerId,day,JSON.stringify(soloStandings(players))]);
       run('DELETE FROM web_solo_weeks WHERE career_id=? AND day<?',[input.careerId,day-14]);
     }
   }
   const owned=ownedIds(input.careerId);
   players=maintainRosters(players,marketCatalog,owned,to,aiHiring(input.careerId,to));
   writeMarketPlayers(input.careerId,players,to);
   for(const row of all('SELECT player_id FROM web_player_training WHERE career_id=?',[input.careerId])){
     if(!owned.has(Number(row.player_id))){
       const key=[input.careerId,Number(row.player_id)];
       run('DELETE FROM web_player_training WHERE career_id=? AND player_id=?',key);
       run('DELETE FROM web_training_focus_overrides WHERE career_id=? AND player_id=?',key);
     }
   }
 },(from,to)=>paySponsors(run,read,all,input.careerId,from,to));
 let report;
 while(true){
   try{report=advanceTo();break;}
   catch(error){
     if(!(error instanceof NewFixtureDeadline))throw error;
     // The calendar transaction rolled back. Replay only through the new
     // fixture so payroll, development and results share the same cutoff.
     stoppedAt=error.fixture;
     days=stoppedAt.day-input.expectedDay;
     competition=latestSeason(read,input.careerId);
     solo=read('SELECT start_day,end_day FROM web_solo_seasons WHERE career_id=? ORDER BY start_day DESC LIMIT 1',[input.careerId]);
     players=await marketPlayers(input.careerId);
   }
 }
 report.balance=Number(get(input.careerId)?.balance);
 result={report:{...report,advancedDays:days,requestedDays:input.days,blockedFixtureId:stoppedAt?.id},career:get(input.careerId)};
 }else if(action==='negotiations'){
 result=db.selectObjects(`SELECT n.*,COALESCE(q.fee,0) transfer_fee,t.squad_role,t.estimated_fee,t.asking_fee FROM web_negotiations n LEFT JOIN web_transfer_quotes q ON q.negotiation_id=n.id
   LEFT JOIN web_negotiation_terms t ON t.negotiation_id=n.id
   WHERE n.career_id=? ORDER BY opened_day DESC,n.rowid DESC`,[input]);
 }else if(action==='sale-options'){
 const players=await marketPlayers(input.careerId);
 const player=players.find(p=>p.id===input.playerId);
 if(!player||!ownedIds(input.careerId).has(player.id))throw Error('O atleta não faz parte deste elenco.');
 result=offersFor(input.careerId,get(input.careerId)!.day,player,await loadWorld(),players);
 }else if(action==='market-overview'){
 const current=get(input);if(!current)throw Error('Carreira não encontrada.');
 const players=await marketPlayers(input);
 const seasons=all('SELECT data FROM web_competition_seasons WHERE career_id=?',[input]).map(row=>JSON.parse(String(row.data)) as Season);
 result={targets:all('SELECT player_id FROM web_market_targets WHERE career_id=? ORDER BY player_id',[input]).map(row=>Number(row.player_id)),
   usage:marketUsage(seasons,current.day,players)};
 }else if(action==='ranked-watch'){
 result=rankedWatch(input);
 }else if(action==='solo-queue'){
 const seasons=all("SELECT start_day,end_day,final<>'' closed FROM web_solo_seasons WHERE career_id=? ORDER BY start_day DESC",[input]);
 const weeks=seasons.length?all('SELECT day,standings FROM web_solo_weeks WHERE career_id=? AND day>=? ORDER BY day DESC LIMIT 2',[input,Number(seasons[0].start_day)]):[];
 result={seasons:seasons.map(row=>({...row,closed:!!row.closed})),
   comparison:weeks.length===2?{from:Number(weeks[1].day),to:Number(weeks[0].day),
     climbers:weeklyClimbers(JSON.parse(String(weeks[1].standings)) as WeeklyRankings,JSON.parse(String(weeks[0].standings)) as WeeklyRankings)}:null};
 }else if(action==='solo-final'){
 const archive=read("SELECT final FROM web_solo_seasons WHERE career_id=? AND start_day=? AND final<>''",[input.careerId,input.startDay]);
 if(!archive)throw Error('A temporada ainda não possui classificação final.');
 result=JSON.parse(String(archive.final));
 }else if(action==='ranked-player-history'){
 result=all('SELECT player_id,day,position,points FROM web_ranked_history WHERE career_id=? AND player_id=? ORDER BY day',[input.careerId,input.playerId]);
 }else if(action==='set-ranked-watch'){
 const {careerId,playerId,tracked}=input;
 if(!Number.isSafeInteger(playerId)||typeof tracked!=='boolean'||!get(careerId))throw Error('Acompanhamento inválido.');
 const players=tracked?await marketPlayers(careerId):[];
 if(tracked&&!players.some(player=>player.id===playerId&&player.status==='ranked'))throw Error('Atleta indisponível na Solo Queue.');
 db.transaction(()=>{
   run('INSERT INTO web_ranked_watch VALUES(?,?,?) ON CONFLICT(career_id,player_id) DO UPDATE SET active=excluded.active',[careerId,playerId,Number(tracked)]);
   if(tracked)recordRanked(careerId,players,new Set([playerId]),get(careerId)!.day);
 });
 result=rankedWatch(careerId);
 }else if(action==='market-target'){
 const {careerId,playerId,tracked}=input;
 if(!get(careerId)||!Number.isSafeInteger(playerId)||typeof tracked!=='boolean')throw Error('Alvo inválido.');
 if(tracked){
   if(!(await marketPlayers(careerId)).some(player=>player.id===playerId))throw Error('Atleta indisponível.');
   run('INSERT OR IGNORE INTO web_market_targets VALUES(?,?)',[careerId,playerId]);
 }else run('DELETE FROM web_market_targets WHERE career_id=? AND player_id=?',[careerId,playerId]);
 result=all('SELECT player_id FROM web_market_targets WHERE career_id=? ORDER BY player_id',[careerId]).map(row=>Number(row.player_id));
 }else if(action==='incoming-approach-history'){
 const career=get(input);if(!career)throw Error('Carreira não encontrada.');
 const owned=ownedIds(input);
 result=all("SELECT data FROM web_ai_approaches WHERE career_id=? AND json_extract(data,'$.seller')='career' ORDER BY day DESC,buyer",[input])
   .map(row=>JSON.parse(String(row.data)) as Approach)
   .map(offer=>offer.state==='open'&&(offer.expires<career.day||!owned.has(offer.playerId))?{...offer,state:'expired'}:offer);
 }else if(action==='incoming-approaches'){
 const day=get(input)!.day,owned=ownedIds(input);
 result=approaches(input,day).filter(row=>row.seller==='career'&&row.state==='open'&&row.expires>=day&&owned.has(row.playerId));
 }else if(action==='decline-approach'){
 const day=get(input.careerId)!.day;
 const offer=approaches(input.careerId,day,input.playerId).find(row=>row.team===input.team&&row.seller==='career'&&row.state==='open'&&row.expires>=day&&
   (input.offerDay===undefined||input.offerDay===row.day));
 if(!offer)throw Error('Proposta indisponível.');
 setApproach(input.careerId,offer,'declined');result=true;
 }else if(action==='market-moves'){
 result=all('SELECT player_id,day,kind,amount,description FROM web_market_moves WHERE career_id=? ORDER BY day DESC,rowid DESC LIMIT 100',[input]);
 }else if(action==='contract-alerts'){
 const day=get(input)!.day;
 result=all(`SELECT c.player_id,c.start_day,c.end_day FROM web_contracts c
   WHERE c.career_id=? AND c.start_day<=? AND c.end_day BETWEEN ? AND ?
   AND NOT EXISTS(SELECT 1 FROM web_contract_closures x WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day)
   AND NOT EXISTS(SELECT 1 FROM web_contracts n WHERE n.career_id=c.career_id AND n.player_id=c.player_id AND n.start_day>c.start_day)
   ORDER BY c.end_day,c.player_id`,[input,day,day-30,day+180])
   .map(row=>({...row,level:expiryLevel(Number(row.end_day)-day)}));
 }else if(action==='renewal-requests'){
 result=all(`SELECT r.* FROM web_renewal_requests r JOIN web_current_contracts c
   ON c.career_id=r.career_id AND c.player_id=r.player_id AND c.start_day=r.start_day
   WHERE r.career_id=? AND r.state='pending' ORDER BY r.day DESC,r.player_id`,[input]);
 }else if(action==='decline-renewal'){
 const {careerId,playerId,startDay,day}=input;
 run("UPDATE web_renewal_requests SET state='declined' WHERE career_id=? AND player_id=? AND start_day=? AND day=? AND state='pending'",
   [careerId,playerId,startDay,day]);
 result=true;
 }else if(action==='renew-contract'){
 renewContract(run,read,all,input.careerId,input.playerId,input.salary,input.days,input.squadRole);
 result=get(input.careerId);
 }else if(action==='depart-player'){
 const players=await marketPlayers(input.careerId),catalog=await loadWorld();
 const player=players.find(p=>p.id===input.playerId);
 if(!player)throw Error('Atleta não encontrado.');
 const day=get(input.careerId)!.day;
 if(activeLoans(loansFor(input.careerId),day).some(row=>row.player_id===player.id))throw Error('Aguarde o fim do empréstimo.');
 const buyer=input.offerDay!==undefined
   ?approaches(input.careerId,day,player.id).find(offer=>offer.team===input.team&&offer.seller==='career'&&offer.state==='open'&&offer.day===input.offerDay&&offer.expires>=day)
   :input.team?offersFor(input.careerId,day,player,catalog,players).find(option=>option.team===input.team):undefined;
 if(input.team&&!buyer)throw Error('A proposta de compra não está mais disponível.');
 departPlayer(run,read,all,input.careerId,player,buyer,day=>{
   if(buyer){
     const current=players.filter(candidate=>candidate.team===buyer.team&&candidate.role===player.role&&!candidate.status);
     if(current.some(candidate=>candidate.overall>player.overall+3))throw Error('O clube comprador já reforçou esta função.');
     aiPurchase(run,read,input.careerId,buyer.organization,player,buyer.fee,day);
   }
   for(const offer of approaches(input.careerId,day,player.id))if(offer.state==='open')
     setApproach(input.careerId,offer,offer.team===buyer?.team?'signed':'expired');
   run('DELETE FROM web_player_training WHERE career_id=? AND player_id=?',[input.careerId,player.id]);
   run('DELETE FROM web_training_focus_overrides WHERE career_id=? AND player_id=?',[input.careerId,player.id]);
   const updated=players.map(p=>p.id===player.id?{...p,organization:buyer?.organization??null,team:buyer?.team??null,
     history:[{day,description:buyer?'Vendido para '+buyer.name+'.':'Dispensado pela organização.'},...(p.history??[])]}:p);
   writeMarketPlayers(input.careerId,updated);
 });
 result=get(input.careerId);
 }else if(action==='cancel-offer'){
 const day=get(input.careerId)?.day;
 if(day===undefined||!read("SELECT 1 FROM web_negotiations WHERE career_id=? AND id=? AND expires_day>=? AND state IN ('accepted','counter')",[input.careerId,input.id,day]))throw Error('A proposta não está mais disponível.');
 run("UPDATE web_negotiations SET state='cancelled' WHERE career_id=? AND id=?",[input.careerId,input.id]);
 result=true;
 }else if(action==='submit-offer'||action==='confirm-offer'){
 const playerId=action==='confirm-offer'?db.selectValue('SELECT player_id FROM web_negotiations WHERE career_id=? AND id=?',[input.careerId,input.id]):input.playerId;
 const world=await marketPlayers(input.careerId);
 const catalog=await loadWorld();
 const athlete=world.find(candidate=>candidate.id===playerId);
 if(activeLoans(loansFor(input.careerId),get(input.careerId)!.day).some(row=>row.player_id===playerId))throw Error('Aguarde o fim do empréstimo.');
 if(!athlete)throw Error('Jogador não encontrado.');
 const completedTryout=read("SELECT 1 FROM web_tryouts WHERE career_id=? AND player_id=? AND state='completed'",[input.careerId,athlete.id]);
 const player=athlete.status==='ranked'&&completedTryout&&tryoutAvailable(athlete,get(input.careerId)!.mode)?{...athlete,status:undefined}:athlete;
 const legacy=db.selectObjects(`SELECT p.player_id,p.data,p.starter FROM web_imported_players p
   WHERE p.career_id=? AND p.member=1 AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)`,[input.careerId]);
 if(legacy.some(row=>row.player_id===player.id))throw Error('O atleta já faz parte do elenco importado.');
 const legacyStarter=legacy.some(row=>row.starter===1&&JSON.parse(String(row.data)).role===player.role);
 const onSigned=(day:number)=>{
   run("UPDATE web_tryouts SET state='signed' WHERE career_id=? AND player_id=? AND state IN ('active','completed')",[input.careerId,player.id]);
   const seed=Number(db.selectValue('SELECT seed FROM web_career_world WHERE career_id=?',[input.careerId]));
   const updated=applyPerkEvent({...player,organization:null,team:null,
     history:[{day,description:'Assinou contrato com '+get(input.careerId)?.name+'.'},...(player.history??[])]},
     {id:'hire:'+day,kind:'new_team',day,metrics:{moves:1}},seed);
   if(player.organization){
     const fee=Number(read('SELECT fee FROM web_transfer_quotes WHERE career_id=? AND negotiation_id=?',[input.careerId,input.id])?.fee??0);
     aiReceiveTransfer(run,input.careerId,player.organization,player,fee,input.id,day);
   }
   writeMarketPlayers(input.careerId,maintainRosters(world.map(candidate=>candidate.id===player.id?updated:candidate),catalog,ownedIds(input.careerId),day,aiHiring(input.careerId,day)));
 };
 if(action==='submit-offer'){
   const displaced=catalog.teams.find(team=>team.id===get(input.careerId)?.entry?.displacedTeamId);
   const reputation=Math.max(get(input.careerId)?.reputation??40,catalog.organizations.find(org=>org.id===displaced?.organization)?.reputation??40);
   result=submitOffer(run,read,input.careerId,crypto.randomUUID(),player,input.offer,{reputation,replyTo:input.replyTo,askingFee:sellerAskingPrice(player,world)});
 }else{
   confirmOffer(run,read,input.careerId,input.id,player,legacyStarter,onSigned);
   result=get(input.careerId);
 }
 }else if(action==='export')result=await pool.exportFile('/careers.sqlite');
 else throw Error('Operação desconhecida.');
 self.postMessage({id,result});
 }catch(e){self.postMessage({id,error:e instanceof Error?e.message:String(e)});}
};
