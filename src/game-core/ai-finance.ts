import {terms,type Player} from './recruitment.ts';
type Bind=(string|number)[];
type Row=Record<string,unknown>;
type Run=(sql:string,bind:Bind)=>void;
type Read=(sql:string,bind:Bind)=>Row|undefined;
type All=(sql:string,bind:Bind)=>Row[];

export function syncAiAccounts(run:Run,read:Read,all:All,careerId:string,players:Player[],organizations:string[],day:number){
 const payroll=new Map<string,number>();
 for(const player of players)if(player.organization&&!player.status)payroll.set(player.organization,(payroll.get(player.organization)??0)+terms(player.overall).salary);
 for(const organization of new Set([...organizations,...payroll.keys()])){
   const monthly=payroll.get(organization)??0;
   run('INSERT OR IGNORE INTO web_ai_finances(career_id,organization,balance,last_day,payroll) VALUES(?,?,?,?,?)',[careerId,organization,Math.max(10000000,monthly*6),day,monthly]);
   run('UPDATE web_ai_finances SET payroll=? WHERE career_id=? AND organization=?',[monthly,careerId,organization]);
 }
 for(const award of all("SELECT * FROM web_competition_awards WHERE career_id=? AND organization<>'career'",[careerId])){
   creditAiPrize(run,read,careerId,String(award.organization),'award:'+award.season+':'+award.competition_id,Number(award.day),Number(award.prize));
 }
}
export function creditAiPrize(run:Run,read:Read,careerId:string,organization:string,key:string,day:number,amount:number){
 if(!read('SELECT 1 FROM web_ai_finances WHERE career_id=? AND organization=?',[careerId,organization])||read('SELECT 1 FROM web_ai_cash_events WHERE career_id=? AND event_key=?',[careerId,key]))return;
 run('INSERT INTO web_ai_cash_events VALUES(?,?,?,?,?,?)',[careerId,key,organization,day,amount,'Premiação de campeonato.']);
 run('UPDATE web_ai_finances SET balance=balance+? WHERE career_id=? AND organization=?',[amount,careerId,organization]);
}
export function payAiSalaries(run:Run,all:All,careerId:string,to:number){
 for(const account of all('SELECT * FROM web_ai_finances WHERE career_id=? AND last_day<?',[careerId,to])){
   let balance=Number(account.balance),arrears=Number(account.arrears);
   for(let due=(Math.floor(Number(account.last_day)/30)+1)*30;due<=to;due+=30){
     const owed=Number(account.payroll)+arrears,payment=Math.min(balance,owed);balance-=payment;arrears=owed-payment;
     if(payment>0)run('INSERT INTO web_ai_cash_events VALUES(?,?,?,?,?,?)',[careerId,'salary:'+account.organization+':'+due,String(account.organization),due,-payment,'Pagamento de folha agregada.']);
   }
   run('UPDATE web_ai_finances SET balance=?,arrears=?,last_day=? WHERE career_id=? AND organization=?',[balance,arrears,to,careerId,String(account.organization)]);
 }
}
export function aiCanBuy(read:Read,careerId:string,organization:string,player:Pick<Player,'overall'>,fee:number){
 const account=read('SELECT balance,arrears,payroll FROM web_ai_finances WHERE career_id=? AND organization=?',[careerId,organization]);
 if(!account||Number(account.arrears)>0)return false;
 const payroll=Number(account.payroll),balance=Number(account.balance);
 const profile=aiFinanceProfile(organization,balance,payroll);
 const reserves={Conservadora:1.35,Equilibrada:1,Investidora:0.9,Reconstrução:1.6};
 return balance>=fee+Math.ceil(payroll*reserves[profile])+terms(player.overall).salary;
}
export function aiFinanceProfile(organization:string,balance:number,payroll:number){
 if(payroll>0&&balance<payroll*2)return 'Reconstrução';
 const profiles=['Conservadora','Equilibrada','Investidora'] as const;
 const seed=[...organization].reduce((hash,char)=>(Math.imul(hash,31)+char.charCodeAt(0))>>>0,0);
 return profiles[seed%profiles.length];
}
export function aiPurchase(run:Run,read:Read,careerId:string,organization:string,player:Pick<Player,'id'|'overall'>,fee:number,day:number){
 if(!aiCanBuy(read,careerId,organization,player,fee))throw Error('O clube comprador não possui orçamento disponível.');
 run('UPDATE web_ai_finances SET balance=balance-?,payroll=payroll+? WHERE career_id=? AND organization=?',[fee,terms(player.overall).salary,careerId,organization]);
 const tenure=Number(read('SELECT start_day FROM web_contracts WHERE career_id=? AND player_id=? ORDER BY start_day DESC LIMIT 1',[careerId,player.id])?.start_day??0);
 run('INSERT INTO web_ai_cash_events VALUES(?,?,?,?,?,?)',[careerId,'purchase:'+organization+':'+player.id+':'+day+':'+tenure,organization,day,-fee,'Compra do atleta '+player.id+'.']);
}
export function aiHire(run:Run,read:Read,careerId:string,organization:string,player:Pick<Player,'id'|'overall'>,day:number){
 const cost=terms(player.overall);
 if(!aiCanBuy(read,careerId,organization,player,cost.bonus))return false;
 run('UPDATE web_ai_finances SET balance=balance-?,payroll=payroll+? WHERE career_id=? AND organization=?',[cost.bonus,cost.salary,careerId,organization]);
 run('INSERT INTO web_ai_cash_events VALUES(?,?,?,?,?,?)',[careerId,'hire:'+organization+':'+player.id+':'+day,organization,day,-cost.bonus,'Contratação livre do atleta '+player.id+'.']);return true;
}
export function aiReceiveTransfer(run:Run,careerId:string,organization:string,player:Pick<Player,'id'|'overall'>,fee:number,key:string,day:number){
 run('UPDATE web_ai_finances SET balance=balance+?,payroll=MAX(0,payroll-?) WHERE career_id=? AND organization=?',[fee,terms(player.overall).salary,careerId,organization]);
 run('INSERT INTO web_ai_cash_events VALUES(?,?,?,?,?,?)',[careerId,'transfer:'+key,organization,day,fee,'Venda do atleta '+player.id+'.']);
}
