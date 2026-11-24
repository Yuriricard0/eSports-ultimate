import type {PerkInstance,Personality,Temperament} from './traits.ts';
import type {Condition,DevelopmentPoint} from './development.ts';
import type {PersonalObjective,PerkInfluence} from './player-identity.ts';
import {trainingSchema} from './training.ts';
import {financeSchema,recordCash} from './finance.ts';

export type Player = {
  id: number;
  nickname: string;
  name: string;
  role: string;
  mode: string;
  organization: string | null;
  team: string | null;
  overall: number;
  country: string;
  birthDay: number;
  portraitIndex: number;
  estimateLow: number | null;
  estimateHigh: number | null;
  attributes: Record<string,number>;
  history?: {day:number;description:string}[];
  personality?:Personality;
  personalObjective?:PersonalObjective;
  perkInfluences?:PerkInfluence[];
  temperament?:Temperament;
  perks?:PerkInstance[];
  condition?:Condition&{day:number};
  developmentHistory?:DevelopmentPoint[];
  ceiling?:number;
  status?:'ranked'|'retired';
  rankedPerformance?:{points:number;winRate:number};
  retiredDay?:number;
  perkHistory?:{day:number;id:string;action:'acquired'|'removed'|'intensified'}[];
  perkEvents?:string[];
};
export type Contract = {player_id:number; salary:number; bonus:number; start_day:number; end_day:number; starter:number;academy?:number};
type Values = (string | number)[];
type Run = (sql:string, values:Values) => void;
type Read = (sql:string, values:Values) => Record<string,unknown> | undefined;

export const contractSupportSchema = `
CREATE TABLE IF NOT EXISTS web_contract_closures (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE, player_id INTEGER NOT NULL,
 start_day INTEGER NOT NULL, day INTEGER NOT NULL, reason TEXT NOT NULL,
 PRIMARY KEY(career_id,player_id,start_day)
);
CREATE TABLE IF NOT EXISTS web_salary_rates (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE, player_id INTEGER NOT NULL,
 start_day INTEGER NOT NULL, day INTEGER NOT NULL, salary INTEGER NOT NULL CHECK(salary>0),
 PRIMARY KEY(career_id,player_id,start_day,day)
);
CREATE TABLE IF NOT EXISTS web_market_moves (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE, player_id INTEGER NOT NULL,
 day INTEGER NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL, description TEXT NOT NULL
);
CREATE VIEW IF NOT EXISTS web_current_contracts AS
 SELECT c.* FROM web_contracts c JOIN careers g ON g.id=c.career_id
 WHERE c.start_day<=g.day AND c.end_day>=g.day AND NOT EXISTS (
  SELECT 1 FROM web_contract_closures x WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day
 );
`;

export const contractSchema = `
CREATE TABLE IF NOT EXISTS web_contracts (
  career_id TEXT NOT NULL REFERENCES careers(id),
  player_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  starter INTEGER NOT NULL CHECK(starter IN (0,1)),
  salary INTEGER NOT NULL CHECK(salary>0),
  bonus INTEGER NOT NULL CHECK(bonus>=0),
  start_day INTEGER NOT NULL,
  end_day INTEGER NOT NULL CHECK(end_day>=start_day),
  PRIMARY KEY(career_id,player_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS web_starter_role ON web_contracts(career_id,role) WHERE starter=1;
CREATE TABLE IF NOT EXISTS web_finances (
  career_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  day INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  PRIMARY KEY(career_id,player_id),
  FOREIGN KEY(career_id,player_id) REFERENCES web_contracts(career_id,player_id)
);
CREATE TABLE IF NOT EXISTS web_payroll (
  career_id TEXT NOT NULL REFERENCES careers(id),
  player_id INTEGER NOT NULL,
  start_day INTEGER NOT NULL,
  due_day INTEGER NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>0),
  paid INTEGER NOT NULL DEFAULT 0 CHECK(paid BETWEEN 0 AND amount),
  PRIMARY KEY(career_id,player_id,start_day,due_day)
);
`+contractSupportSchema+trainingSchema+financeSchema;

export function terms(overall:number) {
  const level = Math.max(0,overall-35);
  return {
    bonus: Math.round((5000+level*level*85)/100)*10000,
    salary: Math.round((1000+level*level*12)/100)*10000,
    days: 365,
  };
}

export function selectStarter(run:Run,read:Read,careerId:string,playerId:number){
  run('BEGIN IMMEDIATE',[]);
  try{
    updateStarter(run,read,careerId,playerId);
    run('COMMIT',[]);
  }catch(error){
    run('ROLLBACK',[]);
    throw error;
  }
}

export function updateStarter(run:Run,read:Read,careerId:string,playerId:number){
    const day=Number(read('SELECT day FROM careers WHERE id=?',[careerId])?.day);
    if(read('SELECT 1 FROM web_player_training WHERE career_id=? AND player_id=? AND academy=1',[careerId,playerId]))throw Error('Promova o atleta da Academy ao elenco principal antes de escalá-lo.');
    const candidate=read(`SELECT role FROM web_current_contracts WHERE career_id=? AND player_id=? AND start_day<=? AND end_day>=?`,
      [careerId,playerId,day,day]);
    const legacy=!candidate?read(`SELECT json_extract(data,'$.role') role FROM web_imported_players p WHERE career_id=? AND player_id=? AND member=1
      AND NOT EXISTS(SELECT 1 FROM web_contracts c WHERE c.career_id=p.career_id AND c.player_id=p.player_id)`,[careerId,playerId]):undefined;
    if(!candidate&&!legacy)throw Error('O atleta precisa de contrato ativo ou vínculo importado com o elenco para assumir a vaga.');
    const role=String((candidate??legacy)!.role);
    run('UPDATE web_contracts SET starter=0 WHERE career_id=? AND role=? AND starter=1',[careerId,role]);
    run(`UPDATE web_imported_players SET starter=0 WHERE career_id=? AND member=1 AND json_extract(data,'$.role')=?`,[careerId,role]);
    if(candidate)run('UPDATE web_contracts SET starter=1 WHERE (career_id,player_id,start_day) IN (SELECT career_id,player_id,start_day FROM web_current_contracts WHERE career_id=? AND player_id=?)', [careerId,playerId]);
    else run('UPDATE web_imported_players SET starter=1 WHERE career_id=? AND player_id=?',[careerId,playerId]);
    run('INSERT OR IGNORE INTO web_lineup_history VALUES(?,?,?)',[careerId,day,playerId]);
}

export function hire(run:Run, read:Read, careerId:string, player:Pick<Player,'id'|'mode'|'role'|'organization'|'overall'|'status'>,legacyStarter=false,onSigned?:(day:number)=>void,negotiated?:{bonus:number;salary:number;days:number}) {
  if (player.organization !== null||player.status) throw new Error('Jogador indisponível para contratação direta.');
  const offer = negotiated??terms(player.overall);
  run('BEGIN IMMEDIATE',[]);
  try {
    const career = read('SELECT mode, balance, day FROM careers WHERE id=?',[careerId]);
    if (!career || career.mode !== player.mode) throw new Error('Confira a modalidade da carreira.');
    const day = Number(career.day);
    if (read('SELECT 1 FROM web_current_contracts WHERE career_id=? AND player_id=? AND end_day>=?',[careerId,player.id,day])) {
      throw new Error('Este jogador já tem contrato.');
    }
    if (read('SELECT 1 FROM web_payroll WHERE career_id=? AND paid<amount LIMIT 1',[careerId])) {
      throw new Error('Regularize a folha salarial antes de contratar.');
    }
    if (Number(career.balance) < offer.bonus) throw new Error('Saldo insuficiente para as luvas.');
    if(negotiated){
      const committed=Number(read('SELECT COALESCE(SUM(salary),0) AS total FROM web_current_contracts WHERE career_id=? AND end_day>=?',[careerId,day])?.total??0);
      if(Number(career.balance)<offer.bonus+offer.salary+committed)throw Error('Saldo insuficiente para as luvas e a próxima folha salarial.');
    }
    const starter = legacyStarter||read('SELECT 1 FROM web_contracts WHERE career_id=? AND role=? AND starter=1',[careerId,player.role]) ? 0 : 1;
    if(read('SELECT 1 FROM web_contracts WHERE career_id=? AND player_id=? AND start_day=?',[careerId,player.id,day]))throw Error('Aguarde o próximo dia para recontratar este atleta.');
    run('INSERT INTO web_contracts VALUES(?,?,?,?,?,?,?,?)',
      [careerId,player.id,player.role,starter,offer.salary,offer.bonus,day,day+offer.days-1]);
    run('UPDATE careers SET balance=balance-? WHERE id=?',[offer.bonus,careerId]);
    run('INSERT INTO web_finances VALUES(?,?,?,?)',[careerId,player.id,day,-offer.bonus]);
    recordCash(run,careerId,'sign:'+player.id+':'+day,day,'signing',-offer.bonus,'Assinatura/transferência do atleta '+player.id+'.');
    onSigned?.(day);
    run('COMMIT',[]);
  } catch (error) {
    run('ROLLBACK',[]);
    throw error;
  }
}
