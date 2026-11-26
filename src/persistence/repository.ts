import type {Career} from '../game-core/career';
import type {Negotiation,NegotiationState,Offer} from '../game-core/negotiation';
import type {CalendarResult} from '../game-core/calendar';
import type {Contract,Player} from '../game-core/recruitment';
import type {Identity} from '../game-core/identity';
import type {SaleOption} from '../game-core/market';
import type {PlayerTraining,TrainingFocus} from '../game-core/training';
import type {StoredMatch} from '../game-core/match-store';
import type {MatchResult} from '../game-core/matches';
import type {CompetitionConfig,Season} from '../game-core/competitions';
import type {CashCategory,FacilityKind} from '../game-core/finance';
import type {NewsFilter,NewsPage} from '../game-core/news';
import {trackSave} from '../game-core/save-status';
import type {FavoriteLineup} from '../game-core/lineup-favorites';
import type {PlayerMilestone} from '../game-core/player-milestones';
import type {ContractAlert,RenewalRequest,SquadRole} from '../game-core/contract-expectations';
import type {Loan} from '../game-core/loans';
import type {MobaRegion} from '../game-core/moba-eligibility';
import type {RankedObservation} from '../game-core/talent-development';
import type {SoloSeason,WeeklyClimber,WeeklyRankings} from '../game-core/solo-queue';
import type {AcademySnapshot,Tryout} from '../game-core/academy-evaluation';
import type {Activity,TrainingEvent,TrainingSlot,WeekModel} from '../game-core/training-week';
import type {Mode} from '../game-core/attributes';
let worker:Worker;
let storageFailure:Error|undefined;
let sequence=0;
const pending=new Map<number,{resolve:(value:any)=>void;reject:(reason:Error)=>void}>();
export async function initialize(){
 if(!navigator.locks)throw Error('Este navegador não oferece bloqueio seguro de saves. Use um navegador atualizado.');
 await new Promise<void>((resolve,reject)=>{
 navigator.locks.request('uem-database',{ifAvailable:true},async lock=>{
 if(!lock){reject(Error('O jogo já está aberto em outra aba. Feche essa aba e recarregue aqui.'));return;}
 storageFailure=undefined;
 worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);}};
 worker.onerror=()=>{storageFailure=Error('Falha no armazenamento. Recarregue a página para continuar.');for(const p of pending.values())p.reject(storageFailure);pending.clear();};
 resolve();await new Promise(()=>{});
 }).catch(reject);
 });
}
const saveActions=new Set(['delete','create','import','identity','rename','starter','prepare-match','play-match','cancel-match',
 'start-season','competition-config','play-competition','sponsor-accept','sponsor-reject','facility-upgrade','assign-academy',
 'set-training','submit-offer','confirm-offer','cancel-offer','renew-contract','decline-renewal','depart-player','advance',
 'lineup-favorite-create','lineup-favorite-rename','lineup-favorite-delete','lineup-favorite-apply','create-loan','start-tryout','dismiss-tryout','youth-coach',
 'training-model-save','training-model-rename','training-model-delete','training-week-apply','training-event-plan','training-event-complete','training-event-cancel']);
function request<T>(action:string,input?:unknown):Promise<T>{
 const send=()=>new Promise<T>((resolve,reject)=>{
 if(storageFailure){reject(storageFailure);return;}
 if(!worker){reject(Error('O armazenamento ainda não está pronto.'));return;}
 const id=++sequence;pending.set(id,{resolve,reject});
 try{worker.postMessage({id,action,input});}catch(error){pending.delete(id);reject(error);}
 });
 return saveActions.has(action)?trackSave(send):send();
}
export const listCareers=()=>request<Career[]>('list');
export const listCareerNews=(careerId:string,filter:NewsFilter={})=>request<NewsPage>('news',{careerId,filter});
export const removeCareer=(id:string)=>request<Career[]>('delete',id);
export const createCareer=(input:unknown)=>request<Career>('create',input);
export const exportCareers=()=>request<Uint8Array>('export');
export const importCareers=(bytes:ArrayBuffer,kind:'web'|'godot')=>request<Career[]>('import',{bytes,kind});
export const exportGodotSource=(careerId:string)=>request<Uint8Array>('godot-source',careerId);
export const saveIdentity=(careerId:string,identity:Identity)=>request<Career>('identity',{careerId,identity});
export const renameSave=(careerId:string,name:string)=>request<Career[]>('rename',{careerId,name});
export const listContracts=(id:string)=>request<Contract[]>('contracts',id);
export const listLoans=(id:string)=>request<Loan[]>('loans',id);
export const listLoanClubs=(id:string)=>request<{id:string;name:string}[]>('loan-clubs',id);
export const createLoan=(careerId:string,playerId:number,teamId:string,days:number)=>request<Career>('create-loan',{careerId,playerId,teamId,days});
export const listImportRegion=(id:string)=>request<MobaRegion|null>('import-region',id);
type RankedWatch={ids:number[];history:RankedObservation[]};
export const listRankedWatch=(id:string)=>request<RankedWatch>('ranked-watch',id);
export const getSoloQueue=(id:string)=>request<{seasons:SoloSeason[];comparison:{from:number;to:number;climbers:WeeklyClimber[]}|null}>('solo-queue',id);
export const getSoloFinal=(careerId:string,startDay:number)=>request<WeeklyRankings>('solo-final',{careerId,startDay});
export type AcademyEvaluation={snapshots:AcademySnapshot[];tryouts:Tryout[];competitive:{day:number;mode:string;won:boolean;appearances:[number,number][]}[];coach:boolean;coachAvailable:boolean};
export const getAcademyEvaluation=(id:string)=>request<AcademyEvaluation>('academy-evaluation',id);
export const specializeYouthCoach=(careerId:string,enabled:boolean)=>request<boolean>('youth-coach',{careerId,enabled});
export const startTryout=(careerId:string,playerId:number,days:number)=>request<boolean>('start-tryout',{careerId,playerId,days});
export const dismissTryout=(careerId:string,playerId:number,startDay:number)=>request<boolean>('dismiss-tryout',{careerId,playerId,startDay});
export type TrainingWeek={events:TrainingEvent[];models:WeekModel[];opponents:{id:string;name:string}[];facilities:Record<string,number>;
 schedule:{day:number;mode:Mode;name:string;done:boolean;fixture:string;kind:'official'|'friendly'}[]};
export type TrainingAgendaItem={day:number;mode:Mode;kind:Activity};
export const getTrainingWeek=(id:string)=>request<TrainingWeek>('training-week',id);
export const getTrainingAgenda=(id:string)=>request<TrainingAgendaItem[]>('training-agenda',id);
export const planTrainingEvent=(careerId:string,start:number,slot:TrainingSlot)=>request<boolean>('training-event-plan',{careerId,start,slot});
export const updateTrainingEvent=(careerId:string,day:number,action:'complete'|'cancel')=>request<Career>('training-event-'+action,{careerId,day});
export const saveTrainingModel=(careerId:string,name:string,slots:TrainingSlot[])=>request<boolean>('training-model-save',{careerId,name,slots});
export const updateTrainingModel=(careerId:string,id:string,action:'rename'|'delete',name?:string)=>request<boolean>('training-model-'+action,{careerId,id,name});
export const applyTrainingModel=(careerId:string,modelId:string,start:number)=>request<boolean>('training-week-apply',{careerId,modelId,start});
export const listRankedPlayerHistory=(careerId:string,playerId:number)=>request<RankedObservation[]>('ranked-player-history',{careerId,playerId});
export const setRankedWatch=(careerId:string,playerId:number,tracked:boolean)=>trackSave(()=>request<RankedWatch>('set-ranked-watch',{careerId,playerId,tracked}));
export const setStarter=(careerId:string,playerId:number)=>request<boolean>('starter',{careerId,playerId});
export const listFavoriteLineups=(careerId:string)=>request<FavoriteLineup[]>('lineup-favorites',careerId);
export const createFavoriteLineup=(careerId:string,name:string)=>request<boolean>('lineup-favorite-create',{careerId,name});
export const updateFavoriteLineup=(careerId:string,id:string,action:'rename'|'delete'|'apply',name?:string)=>
 request<Career>(`lineup-favorite-${action}`,{careerId,id,name});
export const listTraining=(careerId:string)=>request<PlayerTraining[]>('training',careerId);
export const listMatches=(careerId:string)=>request<StoredMatch[]>('matches',careerId);
export const prepareFriendly=(careerId:string,opponentId:string)=>request<StoredMatch>('prepare-match',{careerId,opponentId});
export const playMatch=(careerId:string,id:string)=>request<{career:Career;result:MatchResult}>('play-match',{careerId,id});
export const cancelMatch=(careerId:string,id:string)=>request<boolean>('cancel-match',{careerId,id});
export type CompetitionAward={season:number;competition_id:string;team_id:string;organization:string;day:number;name:string;mode:string;prestige:string;prize:number;reputation:number};
export type CompetitionState={seasons:Season[];config:CompetitionConfig;awards:CompetitionAward[]};
export const listCompetitions=(careerId:string)=>request<CompetitionState>('competition-state',careerId);
export const startCompetitionSeason=(careerId:string)=>request<Season>('start-season',careerId);
export const saveCompetitionConfig=(careerId:string,config:CompetitionConfig)=>request<boolean>('competition-config',{careerId,config});
export const playCompetitiveFixture=(careerId:string,id:string)=>request<{career:Career;season:Season}>('play-competition',{careerId,id});
export type Sponsor={id:string;company:string;payment:number;duration:number;min_reputation:number;offered_day:number;expires_day:number;state:'pending'|'accepted'|'rejected'|'expired';accepted_day:number};
export type FinanceState={balance:number;reputation:number;periodStart:number;periodEnd:number;income:number;expenses:number;result:number;payroll:number;outstanding:number;openingBalance:number;ledgerTotal:number;
 seasons:{number:number;year:number;startDay:number}[];sponsors:Sponsor[];facilities:{kind:FacilityKind;level:number;upgraded_day:number}[];
 transactions:{event_key:string;day:number;category:CashCategory;amount:number;description:string}[]};
export const listFinances=(careerId:string,season=0)=>request<FinanceState>('finance-state',{careerId,season});
export const acceptSponsorship=(careerId:string,id:string)=>request<Career>('sponsor-accept',{careerId,id});
export const rejectSponsorship=(careerId:string,id:string)=>request<boolean>('sponsor-reject',{careerId,id});
export const improveFacility=(careerId:string,kind:FacilityKind,expectedLevel:number)=>request<Career>('facility-upgrade',{careerId,kind,expectedLevel});
export const moveToAcademy=(careerId:string,playerId:number,academy:boolean)=>request<Career>('assign-academy',{careerId,playerId,academy});
export const chooseTraining=(careerId:string,playerId:number,focus:TrainingFocus)=>request<Career>('set-training',{careerId,playerId,focus});
export const listImportedPlayers=(id:string)=>request<Player[]>('imported-players',id);
export const listWorldPlayers=(id:string)=>request<Player[]|null>('world-players',id);
export const listNegotiations=(careerId:string)=>request<Negotiation[]>('negotiations',careerId);
export const sendOffer=(careerId:string,playerId:number,offer:Offer,replyTo?:string)=>request<NegotiationState>('submit-offer',{careerId,playerId,offer,replyTo});
export const finishOffer=(careerId:string,id:string)=>request<Career>('confirm-offer',{careerId,id});
export const cancelOffer=(careerId:string,id:string)=>request<boolean>('cancel-offer',{careerId,id});
export const listSaleOptions=(careerId:string,playerId:number)=>request<SaleOption[]>('sale-options',{careerId,playerId});
export const renewPlayerContract=(careerId:string,playerId:number,salary:number,days:number,squadRole?:SquadRole)=>request<Career>('renew-contract',{careerId,playerId,salary,days,squadRole});
export const listContractAlerts=(careerId:string)=>request<ContractAlert[]>('contract-alerts',careerId);
export const listRenewalRequests=(careerId:string)=>request<RenewalRequest[]>('renewal-requests',careerId);
export const declineRenewal=(careerId:string,requestRow:RenewalRequest)=>request<boolean>('decline-renewal',{
 careerId,playerId:requestRow.player_id,startDay:requestRow.start_day,day:requestRow.day,
});
export const leaveRoster=(careerId:string,playerId:number,team?:string,offerDay?:number)=>request<Career>('depart-player',{careerId,playerId,team,offerDay});
export type MarketMove={player_id:number;day:number;kind:string;amount:number;description:string};
export const listMarketMoves=(careerId:string)=>request<MarketMove[]>('market-moves',careerId);
export type PayrollEntry={player_id:number;due_day:number;amount:number;paid:number};
export type TimelineEntry={day:number;player_id:number;kind:'hired'|'expired'|'starter'|'sold'|'released'|'renewed'|'match'};
export const listTimeline=(careerId:string)=>request<TimelineEntry[]>('timeline',careerId);
export const listPlayerMilestones=(careerId:string,playerId:number)=>request<PlayerMilestone[]>('player-milestones',{careerId,playerId});
export const listPayroll=(careerId:string)=>request<PayrollEntry[]>('calendar',careerId);
export const advanceDays=(careerId:string,expectedDay:number,days:number)=>
 request<{report:CalendarResult;career:Career}>('advance',{careerId,expectedDay,days});

export const listIncomingApproaches=(careerId:string)=>request<import('../game-core/market-interest').Approach[]>('incoming-approaches',careerId);
export const listIncomingApproachHistory=(careerId:string)=>request<import('../game-core/market-interest').Approach[]>('incoming-approach-history',careerId);
export const declineApproach=(careerId:string,playerId:number,team:string,offerDay?:number)=>trackSave(()=>request<boolean>('decline-approach',{careerId,playerId,team,offerDay}));

export const loadMarketOverview=(careerId:string)=>request<{targets:number[];usage:Array<[number,import('../game-core/market-overview').MarketUsage]>}>('market-overview',careerId);
export const setMarketTarget=(careerId:string,playerId:number,tracked:boolean)=>trackSave(()=>request<number[]>('market-target',{careerId,playerId,tracked}));
