import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appHarness} from './helpers/component-harness.ts';

test('Central de negociações filtra propostas que vencem em breve e separa as expiradas',async()=>{
 const app=appHarness({
   listNegotiations:async()=>[
     {id:'1',player_id:1,state:'counter',expires_day:12,reason:'Salário abaixo da expectativa'},
     {id:'2',player_id:2,state:'accepted',expires_day:9,reason:'Termos aceitos'},
   ],
   listIncomingApproachHistory:async()=>[
     {team:'buyer',day:8,playerId:3,state:'open',expires:16,name:'Clube comprador',fee:1000},
   ],
   listMarketMoves:async()=>[],
   listRenewalRequests:async()=>[],
 },[],'MarketNegotiations',{career:{id:'a',day:10},players:[
   {id:1,nickname:'Alpha'},{id:2,nickname:'Bravo'},{id:3,nickname:'Charlie'},
 ],draft:null});
 app.render();await app.flush();
 app.control('Filtrar negociações').props.onChange({target:{value:'Vencem em até 3 dias'}});app.render();
 assert.match(app.text(),/Alpha.*Contraproposta/);
 assert.doesNotMatch(app.text(),/Bravo|Charlie/);
 app.control('Filtrar negociações').props.onChange({target:{value:'Recusadas ou expiradas'}});app.render();
 assert.match(app.text(),/Bravo.*Expirada/);
 assert.doesNotMatch(app.text(),/Alpha|Charlie/);
 app.control('Filtrar negociações').props.onChange({target:{value:'Recebidas'}});app.render();
 assert.match(app.text(),/Charlie.*Recebida/);
 assert.doesNotMatch(app.text(),/Alpha|Bravo/);
});

test('apresentação exige confirmação concluída e abre somente quando solicitada',async()=>{
 let finish:()=>void=()=>{};
 const signed=new Promise<void>(resolve=>{finish=resolve;});
 const app=appHarness({
   listNegotiations:async()=>[{id:'offer',player_id:1,state:'accepted',expires_day:12,reason:'Termos aceitos'}],
   listIncomingApproachHistory:async()=>[],listMarketMoves:async()=>[],listRenewalRequests:async()=>[],
 },[],'MarketNegotiations',{career:{id:'a',day:10},players:[{id:1,nickname:'Alpha'}],contracts:[],draft:null,onFinish:()=>signed});
 app.render();await app.flush();
 app.button('Assinar contrato').props.onClick();await app.flush();
 assert.doesNotMatch(app.text(),/Ver apresentação/);
 finish();await app.flush();
 assert.match(app.text(),/Ver apresentação de\s+Alpha/);
 assert.equal(app.component('SigningPresentation'),undefined);
 app.button('Ver apresentação').props.onClick();app.render();
 assert.equal(app.component('SigningPresentation').props.player.id,1);
 app.component('SigningPresentation').props.onClose();app.render();
 assert.equal(app.component('SigningPresentation'),undefined);
});

test('perfil rápido fecha sem perder busca nem ordenação na lista',()=>{
 const player={id:1,nickname:'Alpha',name:'Atleta Alpha',mode:'MOBA',role:'mid',country:'BR',birthDay:-7300,overall:70};
 const app=appHarness({loadMarketOverview:async()=>({targets:[],usage:[]})},[],'Players',{career:{id:'a',mode:'MOBA',day:1},players:[player],contracts:[],organizations:{},view:'market'});
 app.render();app.control('Buscar jogador').props.onChange({target:{value:'Alpha'}});app.control('Ordenar jogadores').props.onChange({target:{value:'age'}});app.render();
 app.control('Perfil de Alpha').props.onClick();app.render();
 assert.equal(app.component('PlayerProfilePanel').props.player.id,1);
 app.component('PlayerProfilePanel').props.onClose();app.render();
 assert.equal(app.component('PlayerProfilePanel'),undefined);
 assert.equal(app.control('Buscar jogador').props.value,'Alpha');
 assert.equal(app.control('Ordenar jogadores').props.value,'age');
});

test('ranked em ascensão exige histórico e mantém a classificação original',()=>{
 const base={name:'Jogador',mode:'MOBA',role:'mid',country:'BR',birthDay:-7000,overall:70,status:'ranked'};
 const players=[{...base,id:1,nickname:'Em Progresso',developmentHistory:[{day:60,overall:69}],rankedPerformance:{points:1000,winRate:50}},
   {...base,id:2,nickname:'Sem Histórico',rankedPerformance:{points:2000,winRate:50}}];
 const app=appHarness({loadMarketOverview:async()=>({targets:[],usage:[]})},[],'Players',{career:{id:'a',mode:'MOBA',day:120},players,contracts:[],organizations:{},view:'ranked'});
 app.render();app.control('Em ascensão').props.onChange({target:{checked:true}});app.render();
 assert.match(app.text(),/#2 ·\s*Em Progresso/);
 assert.doesNotMatch(app.text(),/Sem Histórico/);
});

test('filtros e ordenação da lista sobrevivem à volta e respeitam a carreira e a tela',()=>{
 const career={id:'a',mode:'MOBA',day:1};
 const players=[
   {id:1,nickname:'Alpha',name:'Equipe A',mode:'MOBA',role:'mid',country:'BR',birthDay:-7300,overall:70},
   {id:2,nickname:'Bravo',name:'Equipe B',mode:'MOBA',role:'mid',country:'BR',birthDay:-9000,overall:40},
 ];
 const props={career,players,contracts:[],organizations:{},view:'players'};
 const app=appHarness({loadMarketOverview:async()=>({targets:[],usage:[]})},[],'Players',props);
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

test('Central apresenta as duas partidas pendentes e abre a escolhida pelo ID após reabrir',async()=>{
 const opened:string[]=[];
 const editions=['MOBA','FPS'].map(mode=>({mode,name:'Liga '+mode,participants:[{id:'career',name:'Aurora'},{id:mode,name:'Rival '+mode,code:mode}],
  fixtures:[{id:'g-'+mode,home:'career',away:mode,day:10,phase:'regular',round:1,bestOf:3,status:'scheduled'}]}));
 const app=appHarness({
   listCompetitions:async()=>({seasons:[{editions}]}),listMatches:async()=>[],
   listNegotiations:async()=>[],listFinances:async()=>({reputation:40,sponsors:[]}),
 },[],'CareerDashboard',{career:{id:'a',name:'Aurora',mode:'MOBA',day:10},players:[],contracts:[],onNewsFixture:(id:string)=>opened.push(id)});
 app.render();await app.flush();
 assert.match(app.text(),/Rival MOBA/);assert.match(app.text(),/Rival FPS/);
 assert.match(app.text(),/Dia de jogo/);assert.doesNotMatch(app.text(),/Disputar amistoso/);
 app.button('Disputar partida').props.onClick();
 assert.deepEqual(opened,['g-FPS']);
 app.remount();await app.flush();assert.match(app.text(),/Rival MOBA/);
});
