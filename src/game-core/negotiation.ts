import {hire,terms,type Player} from './recruitment.ts';
import {transferValue} from './market.ts';

type Bind=(string|number)[];
type Run=(sql:string,bind:Bind)=>void;
type Read=(sql:string,bind:Bind)=>Record<string,unknown>|undefined;
type Candidate=Pick<Player,'id'|'overall'|'mode'|'role'|'status'|'organization'|'personality'>&{team?:string|null};
export type Offer={bonus:number;salary:number;days:number;transferFee?:number};
export type NegotiationState='accepted'|'counter'|'rejected'|'expired'|'cancelled'|'signed';
export type Negotiation={id:string;player_id:number;opened_day:number;expires_day:number;state:NegotiationState;
  bonus:number;salary:number;days:number;counter_bonus:number;counter_salary:number;reason:string;transfer_fee?:number};

export const negotiationSchema=`
CREATE TABLE IF NOT EXISTS web_negotiations (
 id TEXT PRIMARY KEY, career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE, player_id INTEGER NOT NULL,
 opened_day INTEGER NOT NULL, expires_day INTEGER NOT NULL CHECK(expires_day>=opened_day),
 state TEXT NOT NULL CHECK(state IN ('accepted','counter','rejected','expired','cancelled','signed')),
 bonus INTEGER NOT NULL CHECK(bonus>0), salary INTEGER NOT NULL CHECK(salary>0), days INTEGER NOT NULL,
 counter_bonus INTEGER NOT NULL CHECK(counter_bonus>=0), counter_salary INTEGER NOT NULL CHECK(counter_salary>=0), reason TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS web_one_open_offer ON web_negotiations(career_id,player_id)
 WHERE state IN ('accepted','counter');
CREATE TABLE IF NOT EXISTS web_transfer_quotes (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
 negotiation_id TEXT PRIMARY KEY REFERENCES web_negotiations(id) ON DELETE CASCADE,
 organization TEXT NOT NULL, team TEXT NOT NULL, fee INTEGER NOT NULL CHECK(fee>=0)
);
`;

function validateOffer(offer:Offer){
  if(!offer||![180,365,730].includes(offer.days)||![offer.bonus,offer.salary].every(value=>Number.isSafeInteger(value)&&value>=100&&value<=1000000000)){
    throw Error('Confira as luvas, o salário e a duração do contrato.');
  }
}

export function respondToOffer(player:Pick<Player,'overall'|'personality'>,offer:Offer){
  validateOffer(offer);
  const base=terms(player.overall);
  const salaryFactor=player.personality==='ambitious'?1.1:player.personality==='methodical'&&offer.days===180?1.05:1;
  const minSalary=Math.round(base.salary*salaryFactor/100)*100;
  const minBonus=base.bonus;
  if(offer.salary>=minSalary&&offer.bonus>=minBonus)return {state:'accepted' as const,reason:'O atleta aceitou os termos.',counterBonus:0,counterSalary:0};
  if(offer.salary<minSalary*0.75||offer.bonus<minBonus*0.65)return {state:'rejected' as const,reason:'A proposta ficou abaixo das condições mínimas do atleta.',counterBonus:0,counterSalary:0};
  return {state:'counter' as const,reason:'O atleta pediu melhores condições financeiras.',
    counterBonus:Math.max(offer.bonus,minBonus),counterSalary:Math.max(offer.salary,minSalary)};
}

export function submitOffer(run:Run,read:Read,careerId:string,id:string,player:Candidate,offer:Offer,context?:{reputation:number}){
  if(player.status)throw Error('Atleta indisponível para negociação.');
  const offeredFee=offer.transferFee??0;
  if(!Number.isSafeInteger(offeredFee)||offeredFee<0||offeredFee>1000000000)throw Error('Confira o valor da transferência.');
  const requiredFee=player.organization?transferValue(player):0;
  let answer=respondToOffer(player,offer);
  if(player.organization){
    const minSalary=Math.round(terms(player.overall).salary*(1+Math.max(0,60-(context?.reputation??40))/200)/100)*100;
    if(offeredFee<requiredFee*.65)answer={state:'rejected',reason:'O clube recusou o valor da transferência.',counterBonus:0,counterSalary:0};
    else if(answer.state!=='rejected'&&(offeredFee<requiredFee||offer.salary<minSalary))answer={
      state:'counter',reason:'Clube e atleta pediram os valores indicados na contraproposta.',
      counterBonus:Math.max(answer.counterBonus,offer.bonus),counterSalary:Math.max(answer.counterSalary,offer.salary,minSalary)};
  }
  const fee=player.organization?Math.max(offeredFee,requiredFee):0;
  run('BEGIN IMMEDIATE',[]);
  try {
    const career=read('SELECT day,balance,mode FROM careers WHERE id=?',[careerId]);
    if(!career||career.mode!==player.mode)throw Error('Modalidade incompatível.');
    const day=Number(career.day);
    if(read('SELECT 1 FROM web_current_contracts WHERE career_id=? AND player_id=? AND end_day>=?',[careerId,player.id,day]))throw Error('Este atleta já tem contrato.');
    if(Number(career.balance)<offer.bonus+offer.salary+offeredFee)throw Error('Saldo insuficiente para a transferência, as luvas e o primeiro salário.');
    run("UPDATE web_negotiations SET state='expired' WHERE career_id=? AND expires_day<? AND state IN ('accepted','counter')",[careerId,day]);
    if(read("SELECT 1 FROM web_negotiations WHERE career_id=? AND player_id=? AND state IN ('accepted','counter')",[careerId,player.id]))throw Error('Já existe negociação aberta com este atleta.');
    run('INSERT INTO web_negotiations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      [id,careerId,player.id,day,day+7,answer.state,offer.bonus,offer.salary,offer.days,answer.counterBonus,answer.counterSalary,answer.reason]);
    run('INSERT INTO web_transfer_quotes VALUES(?,?,?,?,?)',[careerId,id,player.organization??'',player.team??'',fee]);
    run('COMMIT',[]);
    return answer.state;
  }catch(error){
    run('ROLLBACK',[]);
    throw error;
  }
}

export function confirmOffer(run:Run,read:Read,careerId:string,id:string,player:Candidate,legacyStarter:boolean,onSigned?:(day:number)=>void){
  const row=read('SELECT * FROM web_negotiations WHERE career_id=? AND id=? AND player_id=?',[careerId,id,player.id]);
  const day=Number(read('SELECT day FROM careers WHERE id=?',[careerId])?.day);
  if(!row)throw Error('Proposta não encontrada.');
  if(row.state==='expired'||day>Number(row.expires_day))throw Error('A proposta expirou.');
  if(row.state!=='accepted'&&row.state!=='counter')throw Error('A proposta não pode ser fechada.');
  const quote=read('SELECT * FROM web_transfer_quotes WHERE career_id=? AND negotiation_id=?',[careerId,id]);
  if((player.organization??'')!==String(quote?.organization??'')||(player.team??'')!==String(quote?.team??''))throw Error('O clube vendedor mudou. Envie uma nova proposta.');
  const fee=Number(quote?.fee??0);
  const counter=row.state==='counter';
  const offer={bonus:Number(counter?row.counter_bonus:row.bonus),salary:Number(counter?row.counter_salary:row.salary),days:Number(row.days)};
  validateOffer(offer);
  hire(run,read,careerId,{...player,organization:null},legacyStarter,signedDay=>{
    const current=read('SELECT state,expires_day FROM web_negotiations WHERE career_id=? AND id=?',[careerId,id]);
    if(!current||current.state!==row.state||signedDay>Number(current.expires_day))throw Error('A proposta não está mais disponível.');
    run("UPDATE web_negotiations SET state='signed' WHERE career_id=? AND id=?",[careerId,id]);
    run('INSERT INTO web_market_moves VALUES(?,?,?,?,?,?)',[careerId,player.id,signedDay,fee?'bought':'hired',-fee,'Contrato assinado'+(fee?' com transferência.':'.')]);
    onSigned?.(signedDay);
  },{...offer,bonus:offer.bonus+fee});
}
