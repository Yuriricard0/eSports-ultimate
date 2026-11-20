import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import {schema,careerInput,deleteCareer,validateSaveName,type Career} from '../game-core/career';
import {contractSchema,selectStarter,type Contract,type Player} from '../game-core/recruitment';
import {advanceCareerDay,calendarVersion,migrateCalendar} from '../game-core/calendar';
import {defaultIdentity,phaseOneSchema,validateIdentity} from '../game-core/identity';
import {assertBackupFile,readGodotCareer,readGodotRoster,restoreWebBackup} from '../game-core/backup';
import type {Mode} from '../game-core/attributes';
import {startingEntry} from '../game-core/entry';
import type {WorldCatalog} from '../game-core/world';
import {addRankedProspects,addWorldTraits,generateWorld,generationVersion} from '../game-core/generation';
import {publicTraits} from '../game-core/traits';
import {developPlayer,playerCondition} from '../game-core/development';
import {applyAdaptation,renewWorld,seasonBoundaries} from '../game-core/renewal';
import {applyPerkEvent} from '../game-core/perk-events';
import {confirmOffer,negotiationSchema,submitOffer} from '../game-core/negotiation';
import {departPlayer,maintainRosters,renewContract,saleOptions} from '../game-core/market';
import {assignAcademy,setTrainingFocus} from '../game-core/academy';
import type {PlayerTraining,TrainingPlan} from '../game-core/training';
import {matchSchema,prepareMatch,completeMatch} from '../game-core/match-store';
import {careerLineup,rivalLineup,matchStrength,applyMatchConditions,type MatchSide} from '../game-core/matches';
import {defaultCompetitionConfig,generateSeason,hashSeed,nextUserFixture,playCompetitionFixture,validateCompetitionConfig,type Participant,type Season} from '../game-core/competitions';
import {competitionSchema,latestSeason,nextSeasonStart,storeNewSeason,persistSeason} from '../game-core/competition-store';
import {initializeFinance,refreshSponsorOffers,acceptSponsor,rejectSponsor,paySponsors,upgradeFacility,facilityEfficiency,type FacilityLevels} from '../game-core/finance';
import {syncAiAccounts,payAiSalaries,aiCanBuy,aiPurchase,aiHire,aiReceiveTransfer} from '../game-core/ai-finance';
import {newsSchema,synchronizeNews,listNews,processMoodEvent,recordDevelopmentNews} from '../game-core/news';
import {migrateZeroSigningBonus} from '../game-core/contract-migration';

const webVersion=10;
const careerQuery=`SELECT careers.*, w.config, COALESCE(s.name,'') AS saveName,
 e.league_id AS entryLeague,e.kind AS entryKind,e.displaced_team_id AS displacedTeam,
 EXISTS(SELECT 1 FROM web_godot_source g WHERE g.career_id=careers.id) AS hasGodotSource,
 MIN(100,40+COALESCE((SELECT SUM(reputation) FROM web_competition_awards a WHERE a.career_id=careers.id AND a.organization='career'),0)) AS reputation
 FROM careers LEFT JOIN web_identity w ON w.career_id=careers.id
 LEFT JOIN web_save_names s ON s.career_id=careers.id LEFT JOIN web_career_entry e ON e.career_id=careers.id`;
function hydrate(row:Record<string,unknown>|undefined){
 if(!row)return undefined;
 const {config,entryLeague,entryKind,displacedTeam,...data}=row;
 const career=data as Career;
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
 db.exec(contractSchema+phaseOneSchema+negotiationSchema+matchSchema+competitionSchema+newsSchema);
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
 const contractsFor=(careerId:string)=>all(`SELECT c.player_id,salary,bonus,start_day,end_day,starter,COALESCE(t.academy,0) academy
   FROM web_current_contracts c LEFT JOIN web_player_training t ON t.career_id=c.career_id AND t.player_id=c.player_id WHERE c.career_id=?
   UNION ALL SELECT p.player_id,0,0,0,0,p.starter,COALESCE(t.academy,0) FROM web_imported_players p
   LEFT JOIN web_player_training t ON t.career_id=p.career_id AND t.player_id=p.player_id
   WHERE p.career_id=? AND p.member=1 AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)
   ORDER BY starter DESC`,[careerId,careerId]) as unknown as Contract[];
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
 const writeMarketPlayers=(careerId:string,players:Player[])=>{
   const existing=savedPlayers(careerId);
   if(typeof existing!=='string')throw Error('Carregue o mundo da carreira antes de negociar.');
   run('UPDATE web_career_world SET players=? WHERE career_id=?',[JSON.stringify(players.filter(p=>p.id>=0)),careerId]);
   for(const player of players.filter(p=>p.id<0))run('UPDATE web_imported_players SET data=? WHERE career_id=? AND player_id=?',[JSON.stringify(player),careerId,player.id]);
 };
 const matchContext=async(careerId:string,opponentId:string)=>{
   const current=get(careerId);
   if(!current)throw Error('Carreira não encontrada.');
   const catalog=await loadWorld(),players=await marketPlayers(careerId);
   const team=catalog.teams.find(team=>team.id===opponentId);
   const org=catalog.organizations.find(org=>org.id===team?.organization);
   if(!team||!org||catalog.leagues.find(league=>league.id===team.league)?.discipline!==current.mode)throw Error('Equipe adversária ou modalidade incompatível.');
   const sides:[MatchSide,MatchSide]=[
     {id:'career:'+current.id,name:current.name,code:current.code,logo:'',identity:current.identity??{...defaultIdentity,primary:current.color,symbol:current.symbol},lineup:careerLineup(players,contractsFor(careerId))},
     {id:team.id,name:team.name,code:org.code,logo:org.logo,lineup:rivalLineup(players,team.id,current.mode as Mode,current.day)},
   ];
   const owned=ownedIds(careerId);
   if(sides[1].lineup.some(slot=>owned.has(slot.player.id)))throw Error('O adversário possui vínculo conflitante com o seu elenco.');
   sides.forEach(side=>matchStrength(side,current.mode as Mode,current.day));
   return {sides,players};
 };
 const competitionSide=(participant:Participant,players:Player[],mode:Mode,day:number,careerId:string,protectedIds=ownedIds(careerId)):MatchSide=>{
   const lineup=participant.id==='career'?careerLineup(players,contractsFor(careerId)):rivalLineup(players,participant.id,mode,day);
   if(participant.id!=='career'&&lineup.some(slot=>protectedIds.has(slot.player.id)))throw Error('Vínculo conflitante no elenco rival.');
   if(participant.id!=='career')return {...participant,lineup};
   const current=get(careerId)!;
   return {...participant,identity:current.identity??{...defaultIdentity,primary:current.color,symbol:current.symbol},lineup};
 };
 const processAI=(season:Season|undefined,day:number,source:Player[],careerId:string,protectedIds:Set<number>,seed:number)=>{
   let players=source;if(!season)return players;
   while(true){
     const edition=season.editions.find(e=>e.fixtures.some(g=>!g.result&&g.day<=day&&g.home!=='career'&&g.away!=='career'));
     const game=edition?.fixtures.find(g=>!g.result&&g.day<=day&&g.home!=='career'&&g.away!=='career');
     if(!edition||!game)break;
     const teams=[game.home,game.away].map(id=>competitionSide(edition.participants.find(p=>p.id===id)!,players,edition.mode,day,careerId,protectedIds)) as [MatchSide,MatchSide];
     const result=playCompetitionFixture(season,game.id,day,teams,seed);
     for(const map of result.maps)players=applyMatchConditions(players,map);
   }
   persistSeason(run,read,careerId,season,day);return players;
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
 const world=addRankedProspects(generateWorld(await loadPlayers(),seed),seed);
 db.transaction(()=>{
   db.exec({sql:'INSERT INTO careers(id,name,code,country,mode,difficulty,balance,color,symbol,created) VALUES(?,?,?,?,?,?,?,?,?,?)',bind:[careerId,c.name,c.code,c.country,c.mode,c.difficulty,c.balance,c.color,c.symbol,new Date().toISOString()]});
   db.exec({sql:'INSERT INTO web_identity VALUES(?,?)',bind:[careerId,JSON.stringify(identity)]});
   writeEntry(careerId,entry);
   db.exec({sql:'INSERT INTO web_career_world VALUES(?,?,?,?)',bind:[careerId,seed,generationVersion,JSON.stringify(world)]});
   initializeFinance(run,read,all,careerId);
 });
 result=get(careerId);
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
   const ptr=wasm.allocFromTypedArray(bytes);
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
         db.exec({sql:'INSERT INTO web_imported_players VALUES(?,?,?,?,?)',bind:[careerId,player.id,JSON.stringify(player),Number(member),Number(starter)]});
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
 result=db.selectObjects('SELECT data FROM web_imported_players WHERE career_id=?',[input]).map(row=>JSON.parse(String(row.data)));
 }else if(action==='world-players'){
 const stored=db.selectObject('SELECT seed,version,players FROM web_career_world WHERE career_id=?',[input]);
 if(!stored&&!get(input))throw Error('Carreira não encontrada.');
 const seed=stored?Number(stored.seed):Array.from(String(input)).reduce((acc,char)=>(Math.imul(acc,31)+char.charCodeAt(0))>>>0,0);
 const source=stored?JSON.parse(String(stored.players)) as Player[]:await loadPlayers();
 const day=Number(db.selectValue('SELECT day FROM careers WHERE id=?',[input]));
 const players=stored?.version===generationVersion?source:addRankedProspects(addWorldTraits(source,seed),seed,day);
 if(stored?.version!==generationVersion){
   db.exec({sql:'INSERT INTO web_career_world VALUES(?,?,?,?) ON CONFLICT(career_id) DO UPDATE SET version=excluded.version,players=excluded.players',
     bind:[input,seed,generationVersion,JSON.stringify(players)]});
 }
 const discovered=new Set(db.selectObjects('SELECT DISTINCT player_id FROM web_contracts WHERE career_id=?',[input]).map(row=>Number(row.player_id)));
 result=players.map(({ceiling:_,temperament:__,...player})=>({...player,condition:{...playerCondition(player,day),day},
   perks:publicTraits(player.perks??[],discovered.has(player.id))}));
 }else if(action==='contracts'){
 result=contractsFor(input);
 }else if(action==='starter'){
 selectStarter((sql,bind)=>{db.exec({sql,bind});},(sql,bind)=>db.selectObject(sql,bind),input.careerId,input.playerId);
 result=true;
 }else if(action==='training'){
 const owned=ownedIds(input);
 result=all('SELECT player_id,academy,focus,changed_day FROM web_player_training WHERE career_id=? ORDER BY player_id',[input]).filter(row=>owned.has(Number(row.player_id)));
 }else if(action==='assign-academy'||action==='set-training'){
 const player=(await marketPlayers(input.careerId)).find(p=>p.id===input.playerId);
 if(!player)throw Error('Atleta não encontrado.');
 if(action==='assign-academy')assignAcademy(run,read,input.careerId,player,input.academy);
 else setTrainingFocus(run,read,input.careerId,player,input.focus);
 result=get(input.careerId);
 }else if(action==='news'){
 const current=get(input.careerId);if(!current)throw Error('Carreira não encontrada.');
 const catalog=await loadWorld(),stored=savedPlayers(current.id);
 const world=typeof stored==='string'?JSON.parse(stored) as Player[]:await loadPlayers();
 const imported=all('SELECT data FROM web_imported_players WHERE career_id=?',[current.id]).map(row=>JSON.parse(String(row.data)) as Player);
 db.transaction(()=>synchronizeNews(run,read,all,current,[...world,...imported],catalog));
 result=listNews(read,all,current.id,input.filter??{});
 }else if(action==='finance-state'){
 const current=get(input.careerId);if(!current)throw Error('Carreira não encontrada.');
 initializeFinance(run,read,all,current.id);refreshSponsorOffers(run,read,current.id,current.day,current.reputation??40);
 const seasons=all('SELECT data FROM web_competition_seasons WHERE career_id=? ORDER BY number',[current.id]).map(row=>JSON.parse(String(row.data)) as Season);
 const selected=seasons.find(s=>s.number===input.season)||[...seasons].reverse().find(s=>s.startDay<=current.day);
 const periodStart=selected?.startDay??1,next=selected?seasons.find(s=>s.number>selected.number):undefined;
 const periodEnd=Math.min(current.day,next?next.startDay-1:current.day);
 const totals=read(`SELECT COALESCE(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END),0) income,
   COALESCE(SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END),0) expenses FROM web_cash_events WHERE career_id=? AND day BETWEEN ? AND ?`,[current.id,periodStart,periodEnd])!;
 result={balance:current.balance,reputation:current.reputation??40,periodStart,periodEnd,seasons:seasons.map(s=>({number:s.number,year:s.year,startDay:s.startDay})),
   income:Number(totals.income),expenses:Number(totals.expenses),result:Number(totals.income)-Number(totals.expenses),
   payroll:Number(read('SELECT COALESCE(SUM(salary),0) total FROM web_current_contracts WHERE career_id=?',[current.id])?.total??0),
   outstanding:Number(read('SELECT COALESCE(SUM(amount-paid),0) total FROM web_payroll WHERE career_id=?',[current.id])?.total??0),
   openingBalance:Number(read('SELECT opening_balance FROM web_finance_state WHERE career_id=?',[current.id])?.opening_balance),
   ledgerTotal:Number(read('SELECT COALESCE(SUM(amount),0) total FROM web_cash_events WHERE career_id=?',[current.id])?.total??0),
   sponsors:all('SELECT * FROM web_sponsors WHERE career_id=? ORDER BY offered_day DESC,id',[current.id]),
   facilities:all('SELECT kind,level,upgraded_day FROM web_facilities WHERE career_id=?',[current.id]),
   transactions:all('SELECT event_key,day,category,amount,description FROM web_cash_events WHERE career_id=? AND day BETWEEN ? AND ? ORDER BY day DESC,rowid DESC LIMIT 200',[current.id,periodStart,periodEnd])};
 }else if(action==='sponsor-accept'){
 acceptSponsor(run,read,input.careerId,input.id,get(input.careerId)?.reputation??40);result=get(input.careerId);
 }else if(action==='sponsor-reject'){
 rejectSponsor(run,read,input.careerId,input.id);result=true;
 }else if(action==='facility-upgrade'){
 upgradeFacility(run,read,input.careerId,input.kind,input.expectedLevel);result=get(input.careerId);
 }else if(action==='competition-state'){
 result={seasons:all('SELECT data FROM web_competition_seasons WHERE career_id=? ORDER BY number DESC',[input]).map(row=>JSON.parse(String(row.data))),
   config:JSON.parse(String(read('SELECT data FROM web_competition_config WHERE career_id=?',[input])?.data??JSON.stringify(defaultCompetitionConfig))),
   awards:all('SELECT * FROM web_competition_awards WHERE career_id=? ORDER BY season DESC,day DESC,competition_id',[input])};
 }else if(action==='competition-config'){
 const config=validateCompetitionConfig(input.config);
 run('INSERT INTO web_competition_config VALUES(?,?) ON CONFLICT(career_id) DO UPDATE SET data=excluded.data',[input.careerId,JSON.stringify(config)]);result=true;
 }else if(action==='start-season'){
 const current=get(input)!;if(!current)throw Error('Carreira não encontrada.');
 const old=latestSeason(read,input),players=await marketPlayers(input),catalog=await loadWorld();
 const config=JSON.parse(String(read('SELECT data FROM web_competition_config WHERE career_id=?',[input])?.data??JSON.stringify(defaultCompetitionConfig)));
 const bonuses=Object.fromEntries(all('SELECT organization,SUM(reputation) gain FROM web_competition_awards WHERE career_id=? GROUP BY organization',[input]).map(row=>[String(row.organization),Number(row.gain)]));
 const season=generateSeason(current,catalog,players,contractsFor(input),(old?.number??0)+1,nextSeasonStart(old,current.day),config,bonuses);
 storeNewSeason(run,read,input,season);result=season;
 }else if(action==='play-competition'){
 const season=latestSeason(read,input.careerId),current=get(input.careerId)!;
 const edition=season?.editions.find(e=>e.fixtures.some(g=>g.id===input.id)),game=edition?.fixtures.find(g=>g.id===input.id);
 if(!season||!edition||!game||!current)throw Error('Confronto não encontrado.');
 if(game.result)throw Error('Este confronto já foi concluído.');
 if(game.home!=='career'&&game.away!=='career')throw Error('Os confrontos da IA são automáticos.');
 const catalog=await loadWorld();let players=await marketPlayers(input.careerId);
 const seed=Number(db.selectValue('SELECT seed FROM web_career_world WHERE career_id=?',[input.careerId]));
 db.transaction(()=>{
   players=maintainRosters(players,catalog,ownedIds(input.careerId),current.day,aiHiring(input.careerId,current.day));
   const teams=[game.home,game.away].map(id=>competitionSide(edition.participants.find(p=>p.id===id)!,players,edition.mode,current.day,input.careerId)) as [MatchSide,MatchSide];
   const series=playCompetitionFixture(season,input.id,current.day,teams,seed);
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
 await matchContext(input.careerId,input.opponentId);
 const matchId=crypto.randomUUID();
 prepareMatch(run,read,input.careerId,matchId,input.opponentId,crypto.getRandomValues(new Uint32Array(1))[0]);
 result={...read('SELECT id,opponent_team_id,mode,day FROM web_matches WHERE id=?',[matchId]),result:null};
 }else if(action==='cancel-match'){
 run("DELETE FROM web_matches WHERE career_id=? AND id=? AND result=''",[input.careerId,input.id]);result=true;
 }else if(action==='play-match'){
 const match=read('SELECT opponent_team_id,result FROM web_matches WHERE career_id=? AND id=?',[input.careerId,input.id]);
 if(!match)throw Error('Partida não encontrada.');
 if(match.result)throw Error('Esta partida já foi concluída.');
 const {sides,players}=await matchContext(input.careerId,String(match.opponent_team_id));
 const completed=completeMatch(run,read,input.careerId,input.id,sides,result=>writeMarketPlayers(input.careerId,applyMatchConditions(players,result)));
 result={career:get(input.careerId),result:completed};
 }else if(action==='timeline'){
 result=db.selectObjects(`
   SELECT start_day AS day,player_id,'hired' AS kind FROM web_contracts WHERE career_id=?
   UNION ALL SELECT end_day+1,player_id,'expired' FROM web_contracts c
     WHERE career_id=? AND end_day<(SELECT day FROM careers WHERE id=?)
       AND NOT EXISTS(SELECT 1 FROM web_contract_closures x WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day)
   UNION ALL SELECT day,player_id,'starter' FROM web_lineup_history WHERE career_id=?
   UNION ALL SELECT day,player_id,kind FROM web_market_moves WHERE career_id=? AND kind IN ('sold','released','renewed')
   UNION ALL SELECT day,0,'match' FROM web_matches WHERE career_id=? AND result<>''
   ORDER BY day DESC,player_id,kind LIMIT 200`,[input,input,input,input,input,input]);
 }else if(action==='advance'){
 if(![1,7,30].includes(input.days))throw Error('Escolha 1, 7 ou 30 dias.');
 const advancingCareer=get(input.careerId)!;
 const marketCatalog=await loadWorld(),competition=latestSeason(read,input.careerId);
 const next=nextUserFixture(competition);
 if(next&&next.day<=input.expectedDay)throw Error('Dispute o confronto pendente em Competições antes de avançar.');
 const days=Math.min(input.days,next?next.day-input.expectedDay:input.days);
 let players=await marketPlayers(input.careerId);
 const seed=Number(db.selectValue('SELECT seed FROM web_career_world WHERE career_id=?',[input.careerId]));
 const report=advanceCareerDay(run,read,all,input.careerId,input.expectedDay,days,(from,to)=>{
   run("UPDATE web_negotiations SET state='expired' WHERE career_id=? AND expires_day<? AND state IN ('accepted','counter')",[input.careerId,to]);
   const contracts=all(`SELECT player_id,start_day,MIN(end_day,COALESCE((SELECT day-1 FROM web_contract_closures x
     WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day),end_day)) end_day
     FROM web_contracts c WHERE career_id=? AND start_day<=? AND end_day>=?`,[input.careerId,to,from])
     .map(row=>({player_id:Number(row.player_id),start_day:Number(row.start_day),end_day:Number(row.end_day)})).filter(c=>c.end_day>=from);
   const training=new Map(all('SELECT player_id,focus,academy,changed_day FROM web_player_training WHERE career_id=?',[input.careerId])
     .map(row=>[Number(row.player_id),row as unknown as PlayerTraining]));
   const facilityLevels=Object.fromEntries(all('SELECT kind,level FROM web_facilities WHERE career_id=?',[input.careerId]).map(row=>[String(row.kind),Number(row.level)])) as Partial<FacilityLevels>;
   const legacy=new Set(all(`SELECT player_id FROM web_imported_players p WHERE career_id=? AND member=1
     AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)`,[input.careerId]).map(row=>Number(row.player_id)));
   const plansFor=(id:number):TrainingPlan[]=>{
     const config=training.get(id),focus=config?.focus??'balanced';
     const efficiency=facilityEfficiency(facilityLevels,!!config?.academy);
     return legacy.has(id)?[{focus,fromDay:config?.changed_day??1,toDay:to,efficiency}]:contracts.filter(c=>c.player_id===id)
       .map(c=>({focus,fromDay:Math.max(config?.changed_day??1,c.start_day),toDay:c.end_day,efficiency}));
   };
   const trainingPlans=new Map([...new Set([...legacy,...contracts.map(c=>c.player_id)])].map(id=>[id,plansFor(id)]));
   const noTraining:TrainingPlan[]=[];
   const annual=seasonBoundaries(from,to);
   for(let day=from+1;day<=to;day++){
     const beforeDevelopment=players;
     const adaptation=new Map(contracts.filter(c=>c.start_day<=day&&c.end_day>=day&&[30,60].includes(day-c.start_day)).map(c=>[c.player_id,c]));
     players=players.map(player=>{
       let updated=developPlayer(player,day-1,day,trainingPlans.get(player.id)??noTraining);
       const contract=adaptation.get(player.id);
       if(contract)updated=applyAdaptation(updated,contract,day,seed);return updated;
     });
     if(day%30===0){syncAiAccounts(run,read,all,input.careerId,players,marketCatalog.organizations.map(org=>org.id),day);payAiSalaries(run,all,input.careerId,day);}
     if(annual.includes(day))players=renewWorld(players,seed,day,contracts,aiHiring(input.careerId,day));
     const protectedIds=new Set([...legacy,...contracts.filter(c=>c.start_day<=day&&c.end_day>=day).map(c=>c.player_id)]);
     recordDevelopmentNews(run,read,{...advancingCareer,day},beforeDevelopment,players,day,protectedIds);
     players=processMoodEvent(run,read,input.careerId,players,protectedIds,day,seed);
     if(competition?.editions.some(e=>e.fixtures.some(g=>!g.result&&g.day<=day&&g.home!=='career'&&g.away!=='career'))){
       players=maintainRosters(players,marketCatalog,protectedIds,day,aiHiring(input.careerId,day));
       players=processAI(competition,day,players,input.careerId,protectedIds,seed);
     }
   }
   const owned=ownedIds(input.careerId);
   players=maintainRosters(players,marketCatalog,owned,to,aiHiring(input.careerId,to));
   writeMarketPlayers(input.careerId,players);
   for(const row of all('SELECT player_id FROM web_player_training WHERE career_id=?',[input.careerId])){
     if(!owned.has(Number(row.player_id)))run('DELETE FROM web_player_training WHERE career_id=? AND player_id=?',[input.careerId,Number(row.player_id)]);
   }
 },(from,to)=>paySponsors(run,read,all,input.careerId,from,to));
 report.balance=Number(get(input.careerId)?.balance);
 result={report,career:get(input.careerId)};
 }else if(action==='negotiations'){
 result=db.selectObjects(`SELECT n.*,COALESCE(q.fee,0) transfer_fee FROM web_negotiations n LEFT JOIN web_transfer_quotes q ON q.negotiation_id=n.id
   WHERE n.career_id=? ORDER BY opened_day DESC,n.rowid DESC`,[input]);
 }else if(action==='sale-options'){
 const players=await marketPlayers(input.careerId);
 const player=players.find(p=>p.id===input.playerId);
 if(!player||!ownedIds(input.careerId).has(player.id))throw Error('O atleta não faz parte deste elenco.');
 result=saleOptions(player,await loadWorld(),players,(organization,fee)=>aiCanBuy(read,input.careerId,organization,player,fee));
 }else if(action==='market-moves'){
 result=all('SELECT player_id,day,kind,amount,description FROM web_market_moves WHERE career_id=? ORDER BY day DESC,rowid DESC LIMIT 100',[input]);
 }else if(action==='renew-contract'){
 renewContract(run,read,all,input.careerId,input.playerId,input.salary,input.days);
 result=get(input.careerId);
 }else if(action==='depart-player'){
 const players=await marketPlayers(input.careerId),catalog=await loadWorld();
 const player=players.find(p=>p.id===input.playerId);
 if(!player)throw Error('Atleta não encontrado.');
 const buyer=input.team?saleOptions(player,catalog,players).find(option=>option.team===input.team):undefined;
 if(input.team&&!buyer)throw Error('A proposta de compra não está mais disponível.');
 departPlayer(run,read,all,input.careerId,player,buyer,day=>{
   if(buyer)aiPurchase(run,read,input.careerId,buyer.organization,player,buyer.fee,day);
   run('DELETE FROM web_player_training WHERE career_id=? AND player_id=?',[input.careerId,player.id]);
   const updated=players.map(p=>p.id===player.id?{...p,organization:buyer?.organization??null,team:buyer?.team??null,
     history:[{day,description:buyer?'Vendido para '+buyer.name+'.':'Dispensado pela organização.'},...(p.history??[])]}:p);
   writeMarketPlayers(input.careerId,updated);
 });
 result=get(input.careerId);
 }else if(action==='cancel-offer'){
 db.exec({sql:"UPDATE web_negotiations SET state='cancelled' WHERE career_id=? AND id=? AND state IN ('accepted','counter')",bind:[input.careerId,input.id]});
 result=true;
 }else if(action==='submit-offer'||action==='confirm-offer'){
 const playerId=action==='confirm-offer'?db.selectValue('SELECT player_id FROM web_negotiations WHERE career_id=? AND id=?',[input.careerId,input.id]):input.playerId;
 const world=await marketPlayers(input.careerId);
 const catalog=await loadWorld();
 const player=world.find(candidate=>candidate.id===playerId);
 if(!player)throw Error('Jogador não encontrado.');
 const legacy=db.selectObjects(`SELECT p.player_id,p.data,p.starter FROM web_imported_players p
   WHERE p.career_id=? AND p.member=1 AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)`,[input.careerId]);
 if(legacy.some(row=>row.player_id===player.id))throw Error('O atleta já faz parte do elenco importado.');
 const legacyStarter=legacy.some(row=>row.starter===1&&JSON.parse(String(row.data)).role===player.role);
 const onSigned=(day:number)=>{
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
   result=submitOffer(run,read,input.careerId,crypto.randomUUID(),player,input.offer,{reputation});
 }else{
   confirmOffer(run,read,input.careerId,input.id,player,legacyStarter,onSigned);
   result=get(input.careerId);
 }
 }else if(action==='export')result=await pool.exportFile('/careers.sqlite');
 else throw Error('Operação desconhecida.');
 self.postMessage({id,result});
 }catch(e){self.postMessage({id,error:e instanceof Error?e.message:String(e)});}
};
