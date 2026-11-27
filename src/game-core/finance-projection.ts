export type ScheduledCash={day:number;income?:number;expense?:number};

export function paymentPeriods(start:number,end:number,from:number,to:number){
 const periods:{start:number;day:number}[]=[];
 for(let cursor=start;cursor<=Math.min(end,to);cursor+=30){
   const day=Math.min(cursor+29,end);
   if(day>from&&day<=to)periods.push({start:cursor,day});
 }
 return periods;
}

export function cashProjection(day:number,balance:number,overdue:number,schedule:ScheduledCash[]){
 const days=new Map<number,{income:number;expense:number}>();
 for(const item of schedule){
   if(item.day<=day||item.day>day+360)continue;
   const total=days.get(item.day)??{income:0,expense:0};
   total.income+=item.income??0;total.expense+=item.expense??0;days.set(item.day,total);
 }
 let income=0,expenses=overdue,firstShortfall=balance<overdue?day:null;
 const months=Array.from({length:12},(_,index)=>{
   const month=index+1;
   for(let date=day+index*30+1;date<=day+month*30;date++){
     const item=days.get(date);
     if(!item)continue;
     income+=item.income;expenses+=item.expense;
     if(firstShortfall===null&&balance+income<expenses)firstShortfall=date;
   }
   return {month,day:day+month*30,income,expenses,balance:balance+income-expenses,firstShortfall};
 });
 return {balance,overdue,months};
}
export type FinanceProjection=ReturnType<typeof cashProjection>;
import {terms} from './recruitment.ts';
import type {Mode} from './attributes.ts';
import {equipmentCatalog} from './equipment.ts';
import {facilityDefinitions} from './finance.ts';


export function payrollHealth(projection:FinanceProjection,payroll:number){
 const next=projection.months[0],quarter=projection.months[2],half=projection.months[5];
 const reserve=projection.balance-projection.overdue;
 if(projection.overdue>0||quarter.firstShortfall!==null)return {level:'Risco elevado',reason:'Há salários atrasados ou falta de caixa prevista nos próximos três meses.'};
 if(half.firstShortfall!==null||reserve<payroll*3&&next.income<payroll)
   return {level:'Atenção',reason:'As receitas contratadas deixam pouca margem para a folha e para novas despesas.'};
 return {level:'Sustentável',reason:'O caixa cobre os compromissos projetados para seis meses.'};
}

export function expansionStudy(mode:Mode,balance:number,facility:number){
 const estimate=terms(50),payroll=estimate.salary*5;
 const equipment=5*(equipmentCatalog.find(item=>item.mode===mode&&item.tier===2)?.price??0);
 const infrastructure=facility===0?facilityDefinitions.training.costs[0]:0;
 const initial=estimate.bonus*5+equipment+infrastructure;
 const reserve=payroll*3,remaining=balance-initial-reserve;
 return {payroll,equipment,infrastructure,initial,reserve,remaining,viable:remaining>=0};
}
