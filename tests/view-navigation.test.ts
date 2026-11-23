import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appHarness} from './helpers/component-harness.ts';

test('filtros e ordenação da lista sobrevivem à volta e respeitam a carreira e a tela',()=>{
 const career={id:'a',mode:'MOBA',day:1};
 const players=[
   {id:1,nickname:'Alpha',name:'Equipe A',mode:'MOBA',role:'mid',country:'BR',birthDay:-7300,overall:70},
   {id:2,nickname:'Bravo',name:'Equipe B',mode:'MOBA',role:'mid',country:'BR',birthDay:-9000,overall:40},
 ];
 const props={career,players,contracts:[],organizations:{},view:'players'};
 const app=appHarness({},[],'Players',props);
 app.render();
 assert.ok(app.text().indexOf('Alpha')<app.text().indexOf('Bravo'));
 app.control('Ordenar jogadores').props.onChange({target:{value:'age'}});
 app.control('Buscar jogador').props.onChange({target:{value:'Equipe'}});
 app.remount();
 assert.equal(app.control('Buscar jogador').props.value,'Equipe');
 assert.equal(app.control('Ordenar jogadores').props.value,'age');
 assert.ok(app.text().indexOf('Bravo')<app.text().indexOf('Alpha'));
 props.view='market';app.remount();
 assert.equal(app.control('Buscar jogador').props.value,'');
 props.view='players';props.career={...career,id:'b'};app.remount();
 assert.equal(app.control('Ordenar jogadores').props.value,'overall');
});

test('Central conta apenas decisões disponíveis no dia da carreira',async()=>{
 const finance={reputation:40,sponsors:[
   {state:'pending',expires_day:20,min_reputation:30},
   {state:'pending',expires_day:20,min_reputation:70},
 ]};
 const destinations:string[]=[];
 const app=appHarness({
   listCompetitions:async()=>({seasons:[{editions:[{mode:'MOBA',name:'Liga',participants:[],fixtures:[{id:'g1',home:'career',away:'rival',day:10}]}]}]}),
   listMatches:async()=>[],
   listNegotiations:async()=>[{state:'counter',expires_day:11},{state:'accepted',expires_day:9}],
   listFinances:async()=>finance,
 },[],'CareerDashboard',{career:{id:'a',mode:'MOBA',day:10},players:[],contracts:[],navigate:(screen:string)=>destinations.push(screen)});
 app.render();await app.flush();
 assert.match(app.text(),/3\s+decisões pendentes/);
 app.button('Negociações').props.onClick();
 assert.deepEqual(destinations,['market']);
});
