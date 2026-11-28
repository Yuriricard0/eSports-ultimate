import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appHarness} from './helpers/component-harness.ts';
import {cashProjection,realizedCash} from '../src/game-core/finance-projection.ts';

const data={
 balance:1000,projection:cashProjection(60,1000,0,[{day:90,income:20,expense:45},{day:120,expense:111}]),
 realized:realizedCash(60,1000,[{day:30,income:156,expenses:0},{day:60,income:0,expenses:123}]),
 periodStart:1,periodEnd:60,sponsors:[],transactions:[],investments:[],facilities:[],equipment:[],setups:[],seasons:[],
 payroll:45,facilityInvestment:0,outstanding:0,recognition:30,reputation:40,
};

test('Finanças usa abas sem misturar visão mensal com extrato e mantém o horizonte',async()=>{
 const app=appHarness({listFinances:async()=>data},[],'Finances',{career:{id:'a',day:60,mode:'FPS'},players:[]});
 app.render();await app.flush();
 assert.match(app.text(),/Receita nos últimos 30 dias/);
 assert.doesNotMatch(app.text(),/Movimentações da temporada/);
 app.component('FinanceCashChart').props.setHorizon(12);
 app.button('Receitas e despesas').props.onClick();app.render();
 assert.match(app.text(),/Movimentações da temporada/);
 app.button('Planejamento').props.onClick();app.render();
 assert.equal(app.component('FinanceCashChart').props.horizon,12);
 assert.match(app.text(),/Viabilidade de expansão para/);
});

test('gráfico distingue realizado e projetado e consulta valores mensais',()=>{
 const app=appHarness({},[],'FinanceCashChart',{data,horizon:3,setHorizon:()=>{}});
 app.render();
 const period=()=>app.control('Período do gráfico');
 assert.ok(period().props.children.some((option:any)=>option.key==='actual-30'));
 assert.ok(period().props.children.some((option:any)=>option.key==='forecast-3'));
 assert.ok(!period().props.children.some((option:any)=>option.key==='forecast-4'));
 period().props.onChange({target:{value:'forecast-2'}});app.render();
 assert.match(app.text(),/Despesas no período\s+111/);
 assert.doesNotMatch(app.text(),/Despesas no período\s+156/);
});
