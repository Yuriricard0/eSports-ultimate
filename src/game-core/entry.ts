import {countryRegions} from './countries.ts';
import type {WorldCatalog} from './world.ts';

export type CareerEntry={leagueId:string;kind:'career_slot'|'open_circuit';displacedTeamId:string|null};
const development:Record<string,string>={
  BR:'circuito_desafiante',KR:'lck_challengers',CN:'wsci_classificatoria_chinesa',US:'nacl',CA:'nacl',
  JP:'ljl',VN:'vcs',TW:'pcs',HK:'pcs',FR:'la_ligue_francaise',DE:'prime_league',AT:'prime_league',
  CH:'prime_league',ES:'les',PT:'liga_portuguesa',IT:'lol_italian_tournament',GR:'hellenic_legends_league',
  CZ:'hitpoint_masters',PL:'rift_legends',BE:'road_of_legends',NL:'road_of_legends',TR:'tcl',MX:'lrn',
  CR:'lrn',PA:'lrn',EG:'arabian_league',MA:'arabian_league',SA:'arabian_league',AE:'arabian_league',
};
export function startingEntry(catalog:WorldCatalog,country:string,mode:string):CareerEntry {
  const region=countryRegions[country];
  const asiaPacific=region==='Ásia'||region==='Oceania';
  const americas=region==='América do Sul'||region==='América do Norte';
  if(mode==='FPS'){
    const leagueId=americas?'vrs_americas':asiaPacific?'vrs_asia':'vrs_europa';
    if(!catalog.leagues.some(league=>league.id===leagueId&&league.kind==='ranking'))throw Error('Circuito inicial indisponível.');
    return {leagueId,kind:'open_circuit',displacedTeamId:null};
  }
  const leagueId=development[country]??(region==='América do Sul'?'lrs':americas?'lrn':asiaPacific?'pcs':'nlc');
  const league=catalog.leagues.find(item=>item.id===leagueId&&item.discipline==='MOBA'&&item.tier===2);
  const candidates=catalog.teams.filter(team=>team.league===leagueId).reverse();
  const team=candidates.find(item=>!item.academy)??candidates[0];
  if(!league||!team)throw Error('Divisão de desenvolvimento indisponível.');
  return {leagueId,kind:'career_slot',displacedTeamId:team.id};
}
