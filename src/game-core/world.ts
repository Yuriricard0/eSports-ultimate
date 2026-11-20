export type Organization={id:string;name:string;code:string;country:string;logo:string;reputation:number};
export type League={id:string;name:string;discipline:'MOBA'|'FPS';tier:number;season:string;kind:string;source:string};
export type Team={id:string;organization:string;name:string;league:string;academy:boolean;tier:number;global_rank:number};
export type WorldCatalog={organizations:Organization[];teams:Team[];leagues:League[]};
export type WorldFilter={query:string;mode:string;country:string;league:string;tier:number};

export function filterOrganizations(catalog:WorldCatalog,filter:WorldFilter) {
  const leagues=new Map(catalog.leagues.map(league=>[league.id,league]));
  const compatible=new Set(catalog.teams.filter(team=>
    (!filter.league||team.league===filter.league) &&
    (!filter.mode||leagues.get(team.league)?.discipline===filter.mode) &&
    (!filter.tier||team.tier===filter.tier)
  ).map(team=>team.organization));
  const normalize=(value:string)=>value.toLowerCase().normalize('NFD').replace(/\p{Mark}/gu,'');
  const query=normalize(filter.query.trim());
  return catalog.organizations.filter(org=>
    (!filter.country||org.country===filter.country) &&
    compatible.has(org.id) &&
    (normalize(org.name).includes(query)||normalize(org.code).includes(query))
  );
}
