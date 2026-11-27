import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appHarness} from './helpers/component-harness.ts';
import {createDoubleElimination,progressDoubleElimination} from '../src/game-core/competition-formats.ts';
import {defaultCompetitionConfig,type Competition,type Season} from '../src/game-core/competitions.ts';

test('chave visível segue o motor e abre a série escolhida pelo ID',()=>{
 const participants=['Nova Wolves','Iron Ravens','Aurora','Titan'].map((name,index)=>({id:'t'+index,organization:'org'+index,name,code:'E'+index,logo:'',strength:50,reputation:50}));
 const edition:Competition={id:'s1:major',key:'cs_major',name:'Major',region:'Global',mode:'FPS',season:1,prestige:'Major',prize:0,reputationGain:0,
   finalBestOf:5,format:'knockout',participants,fixtures:[],champion:null,finalOrder:[],startDay:10,endDay:70,
   doubleElimination:createDoubleElimination(participants.map(team=>team.id),{upper:3,lower:3,final:5,grandFinal:'reset'})};
 progressDoubleElimination(edition);
 const first=edition.fixtures[0];
 first.result={winner:first.home,score:[2,1],maps:[],completedDay:first.day};
 let selected='';
 const app=appHarness({},[],'CompetitionBracket',{edition,open:(id:string)=>{selected=id;}});
 app.render();
 assert.match(app.text(),/Chave superior/);
 assert.match(app.text(),/Chave inferior/);
 assert.match(app.text(),/Grande final/);
 assert.match(app.text(),/Série de desempate/);
 const card=app.button('Nova Wolves');
 assert.match(card.props.children.props.children[1][0].props.className,/bracket-winner/);
 card.props.onClick();
 assert.equal(selected,first.id);
});

function portalFixture(){
 const participants=['Nova Wolves','Iron Ravens'].map((name,index)=>({id:'t'+index,organization:'o'+index,name,code:'T'+index,logo:'',strength:50,reputation:50}));
 const edition:Competition={id:'s1:major',key:'cs_major',name:'Major',region:'Global',mode:'FPS',season:1,prestige:'Major',prize:10000,reputationGain:5,
   finalBestOf:3,format:'knockout',participants,fixtures:[],champion:null,finalOrder:[],startDay:10,endDay:24};
 edition.fixtures.push({id:'series-1',competitionId:edition.id,day:10,season:1,home:'t0',away:'t1',phase:'final',round:1,bestOf:3,status:'scheduled',result:null});
 const regional:Competition={...edition,id:'s1:regional',key:'regional',name:'Liga Regional',prestige:'Regional',region:'Brasil',mode:'MOBA',fixtures:[]};
 const season:Season={number:1,year:2027,startDay:1,endDay:24,notices:[],editions:[edition,regional]};
 return {season,edition};
}

test('loja filtra o catálogo, abre o produto correto e mantém inventário e setups acessíveis',()=>{
 let bought='';
 const app=appHarness({},[],'EquipmentShop',{career:{mode:'FPS'},players:[],busy:false,data:{balance:9999999,equipment:[],setups:[],equipmentPlayers:[]},
   buy:(id:string)=>{bought=id;},assign:()=>{}});
 app.render();
 app.button('Computador').props.onClick();app.render();
 assert.match(app.text(),/Computador Vector/);
 assert.doesNotMatch(app.text(),/Mouse Vector/);
 app.button('Computador Vector 3').props.onClick();app.render();
 app.button('Comprar equipamento').props.onClick();assert.equal(bought,'fps-computer-3');
 app.button('Inventário').props.onClick();app.render();
 assert.match(app.text(),/Nenhum equipamento/);
 app.button('Ver setups').props.onClick();app.render();
 assert.match(app.text(),/primeiro setup/);
});

test('sala de troféus exibe somente conquistas da organização e abre o arquivo da edição',async()=>{
 const {season,edition}=portalFixture();
 edition.participants[0]={...edition.participants[0],id:'career',organization:'career'};
 edition.champion='career';
 edition.fixtures[0]={...edition.fixtures[0],home:'career',status:'completed',result:{winner:'career',score:[2,0],maps:[],completedDay:10}};
 const other=season.editions[1];other.champion='t1';
 const app=appHarness({listCompetitions:async()=>({seasons:[season],awards:[],config:defaultCompetitionConfig})},[],'TrophyRoom',{
   career:{id:'gallery-test',name:'Nova Wolves',code:'NVW',mode:'FPS',color:'#ee4371',symbol:'animals_wolf'},
   onOpenFixture:()=>{},
 });
 app.render();await app.flush();
 assert.match(app.text(),/Sala de Troféus/);
 assert.doesNotMatch(app.text(),/Liga Regional/);
 app.button('Major').props.onClick();app.render();
 app.button('Voltar à galeria').props.onClick();app.render();
 assert.ok(app.button('Major'));
});

test('portal filtra competições de terceiros e conserva favoritos ao reabrir',async()=>{
 const {season}=portalFixture(),storage=new Map<string,string>();
 const repo={listCompetitions:async()=>({seasons:[season],awards:[],config:defaultCompetitionConfig})};
 const props={career:{id:'portal-test',mode:'FPS',day:5,balance:0},onOpenFixture:()=>{}};
 const app=appHarness(repo,[],'Competitions',props,storage);
 app.render();await app.flush();
 assert.match(app.text(),/Major/);assert.match(app.text(),/Liga Regional/);
 app.control('Favoritar Major').props.onClick();app.render();
 app.button('Internacionais').props.onClick();app.render();
 assert.doesNotMatch(app.text(),/Liga Regional/);
 app.button('Major').props.onClick();app.render();
 const detail=app.component('CompetitionEdition');assert.equal(detail.props.edition.id,'s1:major');
 assert.equal(detail.props.favorite,true);
 detail.props.back();app.render();
 const reopened=appHarness(repo,[],'Competitions',props,storage);
 reopened.render();await reopened.flush();
 reopened.button('Favoritas').props.onClick();reopened.render();
 assert.equal(reopened.control('Favoritar Major').props['aria-pressed'],true);
 assert.doesNotMatch(reopened.text(),/Liga Regional/);
});

test('página de campeonato abre organizações, séries e os regulamentos pelos dados da edição',()=>{
 const {season,edition}=portalFixture();
 let fixture='',organization='';
 const page=appHarness({},[],'CompetitionEdition',{edition,season,seasons:[season],day:8,favorite:false,
   openFixture:(id:string)=>{fixture=id;},openOrganization:(id:string)=>{organization=id;}});
 page.render();
 assert.match(page.text(),/Próximos confrontos/);
 page.button('Ver confronto').props.onClick();assert.equal(fixture,'series-1');
 page.button('Nova Wolves').props.onClick();assert.equal(organization,'o0');
 page.button('Playoffs').props.onClick();page.render();
 assert.match(page.text(),/Nova Wolves.*Iron Ravens/);
 page.button('Estatísticas').props.onClick();page.render();
 assert.match(page.text(),/0\s+séries concluídas/);
 page.button('Regulamento').props.onClick();page.render();
 assert.match(page.text(),/Pináculo do Major/);
});

test('Academy navega entre visão geral, atletas e a mesma central de scouting',async()=>{
 let opened=false;
 const app=appHarness({
   listTraining:async()=>[],getAcademyEvaluation:async()=>({snapshots:[],tryouts:[],competitive:[],coach:false,coachAvailable:false}),
   listRankedWatch:async()=>({ids:[],history:[]}),
 },[],'Academy',{career:{id:'a',mode:'MOBA',day:20},players:[],contracts:[],view:'academy',onScouting:()=>{opened=true;}});
 app.render();await app.flush();
 assert.ok(app.component('AcademyOverview'));
 assert.equal(app.component('AcademyEvaluation'),undefined);
 app.button('Atletas').props.onClick();app.render();
 assert.equal(app.component('AcademyEvaluation').props.section,'reports');
 app.button('Scouting').props.onClick();app.render();
 assert.equal(app.component('AcademyEvaluation').props.section,'tryouts');
 app.button('Abrir Central de scouting').props.onClick();
 assert.equal(opened,true);
});

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
 const app=appHarness({loadMarketOverview:async()=>({targets:[],usage:[]}),listRankedWatch:async()=>({ids:[],history:[]})},[],'Players',{career:{id:'a',mode:'MOBA',day:120},players,contracts:[],organizations:{},view:'ranked'});
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
