import {contractSupportSchema} from './recruitment.ts';
import {recordCash} from './finance.ts';
type Values=(string|number)[];
type Row=Record<string,unknown>;
type Run=(sql:string,values:Values)=>void;
type Read=(sql:string,values:Values)=>Row|undefined;
type All=(sql:string,values:Values)=>Row[];

export const calendarVersion=2;
export const salaryPeriod=30;

export function formatCareerDay(day:number){
  return new Date(Date.UTC(2027,2,14+day)).toLocaleDateString('pt-BR',{timeZone:'UTC'});
}

export function migrateCalendar(exec:(sql:string)=>void,version:number){
  if(version===calendarVersion)return;
  if(version!==1)throw Error('Versão de carreira incompatível.');
  exec('BEGIN IMMEDIATE');
  try {
    exec(`
      DROP VIEW IF EXISTS web_current_contracts;
      ALTER TABLE web_finances RENAME TO old_web_finances;
      ALTER TABLE web_contracts RENAME TO old_web_contracts;
      CREATE TABLE web_contracts (
        career_id TEXT NOT NULL REFERENCES careers(id),
        player_id INTEGER NOT NULL, role TEXT NOT NULL,
        starter INTEGER NOT NULL CHECK(starter IN (0,1)),
        salary INTEGER NOT NULL CHECK(salary>0), bonus INTEGER NOT NULL CHECK(bonus>=0),
        start_day INTEGER NOT NULL, end_day INTEGER NOT NULL CHECK(end_day>=start_day),
        PRIMARY KEY(career_id,player_id,start_day)
      );
      CREATE TABLE web_finances (
        career_id TEXT NOT NULL, player_id INTEGER NOT NULL, day INTEGER NOT NULL, amount INTEGER NOT NULL,
        PRIMARY KEY(career_id,player_id,day),
        FOREIGN KEY(career_id,player_id,day) REFERENCES web_contracts(career_id,player_id,start_day)
      );
      INSERT INTO web_contracts SELECT * FROM old_web_contracts;
      INSERT INTO web_finances SELECT * FROM old_web_finances;
      DROP TABLE old_web_finances;
      DROP TABLE old_web_contracts;
      CREATE UNIQUE INDEX web_starter_role ON web_contracts(career_id,role) WHERE starter=1;
      PRAGMA user_version=2;
    `);
    exec(contractSupportSchema);
    exec('COMMIT');
  }catch(error){
    exec('ROLLBACK');
    throw error;
  }
}

export type CalendarResult={day:number;balance:number;paid:number;outstanding:number;expired:number;advancedDays?:number;requestedDays?:number;blockedFixtureId?:string};

export function salaryDue(all:All,careerId:string,contract:Row,from:number,to:number){
  const rates=all('SELECT day,salary FROM web_salary_rates WHERE career_id=? AND player_id=? AND start_day=? ORDER BY day',
    [careerId,Number(contract.player_id),Number(contract.start_day)]);
  let total=0;
  for(let day=from;day<=to;day++){
    const rate=rates.filter(rate=>Number(rate.day)<=day).at(-1);
    total+=Number(rate?.salary??contract.salary)/salaryPeriod;
  }
  return Math.round(total);
}

export function advanceCareerDay(run:Run,read:Read,all:All,careerId:string,expectedDay:number,days:number,simulate?:(from:number,to:number)=>void,beforePayroll?:(from:number,to:number)=>void):CalendarResult {
  if(!Number.isInteger(days)||days<1||days>30)throw Error('O avanço deve ter entre 1 e 30 dias.');
  run('BEGIN IMMEDIATE',[]);
  try{
    const career=read('SELECT day,balance FROM careers WHERE id=?',[careerId]);
    if(!career)throw Error('Carreira não encontrada.');
    if(career.day!==expectedDay)throw Error('O calendário já foi atualizado. Confira a nova data.');
    const day=expectedDay+days;
    beforePayroll?.(expectedDay,day);
    let balance=Number(read('SELECT balance FROM careers WHERE id=?',[careerId])?.balance);
    let paid=0;
    const contracts=all(`SELECT c.* FROM web_contracts c WHERE career_id=? AND end_day>=? AND start_day<=?
      AND NOT EXISTS(SELECT 1 FROM web_contract_closures x WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day)`,[careerId,expectedDay,day]);
    for(const contract of contracts){
      const start=Number(contract.start_day);
      const end=Number(contract.end_day);
      for(let periodStart=start;periodStart<=end;periodStart+=salaryPeriod){
        const due=Math.min(periodStart+salaryPeriod-1,end);
        if(due<=expectedDay||due>day)continue;
        const recorded=all('SELECT amount FROM web_payroll WHERE career_id=? AND player_id=? AND start_day=? AND due_day BETWEEN ? AND ?',
          [careerId,Number(contract.player_id),start,periodStart,due]).reduce((sum,row)=>sum+Number(row.amount),0);
        const amount=Math.max(0,salaryDue(all,careerId,contract,periodStart,due)-recorded);
        if(amount===0)continue;
        run('INSERT INTO web_payroll(career_id,player_id,start_day,due_day,amount) VALUES(?,?,?,?,?)',
          [careerId,Number(contract.player_id),start,due,amount]);
      }
    }
    const unpaid=all('SELECT * FROM web_payroll WHERE career_id=? AND paid<amount ORDER BY due_day,player_id,start_day',[careerId]);
    let outstanding=0;
    for(const entry of unpaid){
      const due=Number(entry.amount)-Number(entry.paid);
      const payment=Math.min(balance,due);
      if(payment>0){
        run('UPDATE web_payroll SET paid=paid+? WHERE career_id=? AND player_id=? AND start_day=? AND due_day=?',
          [payment,careerId,Number(entry.player_id),Number(entry.start_day),Number(entry.due_day)]);
        recordCash(run,careerId,'salary:'+entry.player_id+':'+entry.start_day+':'+entry.due_day+':'+(Number(entry.paid)+payment),day,'salary',-payment,'Pagamento de salário do atleta '+entry.player_id+'; vencimento dia '+entry.due_day+'.');
      }
      balance-=payment;
      paid+=payment;
      outstanding+=due-payment;
    }
    const expired=contracts.filter(contract=>Number(contract.end_day)<day);
    run('UPDATE web_contracts SET starter=0 WHERE career_id=? AND starter=1 AND end_day<?',[careerId,day]);
    for(const role of new Set(expired.filter(contract=>contract.starter===1).map(contract=>String(contract.role)))){
      run(`UPDATE web_contracts SET starter=1 WHERE (career_id,player_id,start_day) IN (
        SELECT career_id,player_id,start_day FROM web_contracts c
        WHERE career_id=? AND role=? AND end_day>=? AND start_day<=?
          AND NOT EXISTS(SELECT 1 FROM web_contract_closures x WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day)
          AND NOT EXISTS(SELECT 1 FROM web_player_training t WHERE t.career_id=c.career_id AND t.player_id=c.player_id AND t.academy=1)
        ORDER BY start_day,player_id LIMIT 1
      )`,[careerId,role,day,day]);
    }
    run('UPDATE careers SET day=?,balance=? WHERE id=?',[day,balance,careerId]);
    simulate?.(expectedDay,day);
    run('COMMIT',[]);
    return {day,balance,paid,outstanding,expired:expired.length};
  }catch(error){
    run('ROLLBACK',[]);
    throw error;
  }
}
