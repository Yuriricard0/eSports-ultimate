import {defaultIdentity,validateIdentity,type Identity} from './identity.ts';
import {validateSaveName} from './career.ts';
import {overall,roles,type Mode} from './attributes.ts';
import type {Player} from './recruitment.ts';
import {favoriteIds,favoriteName} from './lineup-favorites.ts';

export const maxBackupBytes=128*1024*1024;
type Value=string|number|Uint8Array|null;
type Row=Record<string,unknown>;
type Select=(sql:string,bind?:Value[])=>Row[];
type Execute=(sql:string,bind?:Value[])=>void;
const tables={
  careers:['id','name','code','country','mode','difficulty','balance','color','symbol','created','day'],
  web_contracts:['career_id','player_id','role','starter','salary','bonus','start_day','end_day'],
  web_loans:['career_id','player_id','origin','destination','club','start_day','end_day','starter'],
  web_contract_expectations:['career_id','player_id','start_day','squad_role','promised_day'],
  web_renewal_requests:['career_id','player_id','start_day','day','gain','played','available','suggested_salary','state'],
  web_finances:['career_id','player_id','day','amount'],
  web_payroll:['career_id','player_id','start_day','due_day','amount','paid'],
  web_identity:['career_id','config'],
  web_uniforms:['career_id','variant','config'],
  web_godot_source:['career_id','file'],
  web_save_names:['career_id','name'],
  web_save_versions:['career_id','created_version'],
  web_career_entry:['career_id','league_id','kind','displaced_team_id'],
  web_career_world:['career_id','seed','version','players'],
  web_lineup_history:['career_id','day','player_id'],
  web_market_targets:['career_id','player_id'],
  web_ranked_watch:['career_id','player_id','active'],
  web_ranked_history:['career_id','player_id','day','position','points'],
  web_solo_seasons:['career_id','start_day','end_day','final'],
  web_solo_weeks:['career_id','day','standings'],
  web_academy_snapshots:['career_id','player_id','day','data'],
  web_youth_coach:['career_id'],
  web_tryouts:['career_id','player_id','start_day','end_day','state','opening','final'],
  web_lineup_favorites:['career_id','id','name','players'],
  web_negotiations:['id','career_id','player_id','opened_day','expires_day','state','bonus','salary','days','counter_bonus','counter_salary','reason'],
  web_transfer_quotes:['career_id','negotiation_id','organization','team','fee'],
  web_negotiation_terms:['career_id','negotiation_id','squad_role','estimated_fee','asking_fee'],
  web_contract_closures:['career_id','player_id','start_day','day','reason'],
  web_salary_rates:['career_id','player_id','start_day','day','salary'],
  web_ai_market_days:['career_id','day'],
  web_ai_approaches:['career_id','day','buyer','player_id','data'],
  web_market_moves:['career_id','player_id','day','kind','amount','description'],
  web_imported_players:['career_id','player_id','data','member','starter'],
  web_player_training:['career_id','player_id','academy','focus','changed_day'],
  web_training_focus_overrides:['career_id','player_id','focus'],
  web_training_weeks:['career_id','id','name','data'],
  web_training_events:['career_id','mode','day','data','done','result'],
  web_matches:['career_id','id','opponent_team_id','mode','day','seed','result'],
  web_competition_config:['career_id','data'],
  web_competition_seasons:['career_id','number','data'],
  web_competition_awards:['career_id','season','competition_id','team_id','organization','day','name','mode','prestige','prize','reputation'],
  web_cash_events:['career_id','event_key','day','category','amount','description'],
  web_finance_state:['career_id','opened_day','opening_balance'],
  web_sponsors:['career_id','id','company','payment','duration','min_reputation','offered_day','expires_day','state','accepted_day'],
  web_facilities:['career_id','kind','level','upgraded_day'],
  web_equipment_stock:['career_id','sku','quantity'],
  web_equipment_setup:['career_id','player_id','category','sku','unit'],
  web_ai_finances:['career_id','organization','balance','arrears','last_day','payroll'],
  web_ai_cash_events:['career_id','event_key','organization','day','amount','description'],
  web_news:['career_id','news_key','day','category','sequence','data'],
  web_news_marks:['career_id','kind','entity_id','day','value'],
  web_world_events:['career_id','event_key','day','player_id','kind','delta'],
} as const;

export function assertBackupFile(bytes:Uint8Array){
  if(bytes.length<100||bytes.length>maxBackupBytes||new TextDecoder().decode(bytes.subarray(0,16))!=='SQLite format 3\0'){
    throw Error('Selecione um arquivo SQLite válido de até 128 MB.');
  }
}

export function readGodotRoster(read:Select,mode:Mode,day:number){
  const organization=Number(read('SELECT organization_id FROM career_settings WHERE id=1')[0]?.organization_id);
  const rows=read(`SELECT DISTINCT p.*, l.role_id AS lineup,
    EXISTS(SELECT 1 FROM roster_memberships m JOIN teams t ON t.id=m.team_id
      WHERE m.player_id=p.id AND m.end_day IS NULL AND t.organization_id=? AND t.discipline_id=?) AS member
    FROM players p
    LEFT JOIN team_lineups l ON l.player_id=p.id AND l.team_id IN
      (SELECT id FROM teams WHERE organization_id=? AND discipline_id=?)
    WHERE p.id IN (SELECT m.player_id FROM roster_memberships m JOIN teams t ON t.id=m.team_id
      WHERE t.organization_id=? AND t.discipline_id=?)`,
    [organization,mode,organization,mode,organization,mode]);
  return rows.map(row=>{
    const sourceId=Number(row.id);
    if(!Number.isSafeInteger(sourceId)||sourceId<1)throw Error('ID de atleta inválido.');
    const attributes=Object.fromEntries(read('SELECT attribute_id,value FROM player_attributes WHERE player_id=?',[sourceId])
      .map(attribute=>[String(attribute.attribute_id),Number(attribute.value)]));
    const role=String(row.lineup??row.role_id);
    if(!roles[mode].includes(role))throw Error('Função de atleta incompatível.');
    const rating=overall(attributes,mode,role);
    if(rating<1)throw Error('O save contém atleta com atributos incompletos.');
    const estimate=read('SELECT potential_low,potential_high FROM player_assessments WHERE player_id=? AND observer_organization_id=? ORDER BY assessed_day DESC,id DESC LIMIT 1',[sourceId,organization])[0];
    const history=read('SELECT day,description FROM player_history WHERE player_id=? ORDER BY day DESC,id DESC',[sourceId])
      .map(event=>({day:Number(event.day),description:String(event.description)}));
    const player:Player={id:-sourceId,nickname:String(row.nickname),name:String(row.name),role,mode,attributes,
      country:String(row.country_id),birthDay:Number(row.birth_day),portraitIndex:-1,organization:null,team:null,
      estimateLow:estimate?Number(estimate.potential_low):null,estimateHigh:estimate?Number(estimate.potential_high):null,overall:rating,history};
    const member=Boolean(row.member);
    const starter=member&&Boolean(row.lineup);
    const contract=member?read(`SELECT start_day,end_day,salary_cents,signing_bonus_cents FROM player_contracts
      WHERE player_id=? AND organization_id=? AND status='active' AND end_day>=? ORDER BY start_day DESC LIMIT 1`,[sourceId,organization,day])[0]:undefined;
    return {player,member,starter,contract};
  });
}

function physicalTables(read:Select){
  return new Set(read("SELECT name FROM sqlite_schema WHERE type='table' AND sql LIKE 'CREATE TABLE%'").map(row=>String(row.name)));
}

function requireIntegrity(read:Select){
  if(read('PRAGMA quick_check(1)')[0]?.quick_check!=='ok'||read('PRAGMA foreign_key_check').length){
    throw Error('O SQLite da cópia tem registros inválidos.');
  }
}

export function restoreWebBackup(read:Select,run:Execute,newId:()=>string){
  const names=physicalTables(read);
  const version=Number(read('PRAGMA user_version')[0]?.user_version);
  const required=['careers','web_contracts','web_finances'];
  if(version>=2)required.push('web_payroll');
  if(version>=3)required.push('web_identity','web_godot_source');
  if(version>=4)required.push('web_transfer_quotes','web_contract_closures','web_salary_rates','web_market_moves');
  if(version>=5)required.push('web_player_training');
  if(version>=6)required.push('web_matches');
  if(version>=7)required.push('web_competition_config','web_competition_seasons','web_competition_awards');
  if(version>=8)required.push('web_cash_events','web_finance_state','web_sponsors','web_facilities','web_ai_finances','web_ai_cash_events');
  if(version>=9)required.push('web_news','web_news_marks','web_world_events');
  if(![1,2,3,4,5,6,7,8,9,10].includes(version)||!required.every(table=>names.has(table)))throw Error('Versão de backup web incompatível ou arquivo incompleto.');
  requireIntegrity(read);
  const ids=new Map<string,string>();
  const careers=read('SELECT id FROM careers');
  if(!careers.length)throw Error('O backup não contém carreiras.');
  for(const row of careers)ids.set(String(row.id),newId());
  run('BEGIN IMMEDIATE');
  try{
    for(const [table,columns] of Object.entries(tables)){
      if(!names.has(table))continue;
      const rows=read('SELECT '+columns.join(',')+' FROM '+table);
      for(const row of rows){
        if(table==='web_negotiations'){
          const careerId=ids.get(String(row.career_id));
          if(!careerId)throw Error('O backup contém proposta sem carreira.');
          run('INSERT INTO web_negotiations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
            [careerId+':'+String(row.id),careerId,...columns.slice(2).map(key=>row[key] as Value)]);
          continue;
        }
        const id=ids.get(String(row[columns[0]]));
        if(!id)throw Error('O backup contém registro sem carreira.');
        if(table==='careers'&&(
          typeof row.name!=='string'||!row.name.trim()||row.name.length>60||
          typeof row.code!=='string'||!row.code.trim()||row.code.length>5||
          !Number.isSafeInteger(row.day)||!Number.isSafeInteger(row.balance)
        ))throw Error('O backup contém dados de carreira inválidos.');
        if(table==='web_identity')row.config=JSON.stringify(validateIdentity(JSON.parse(String(row.config))));
        if(table==='web_save_names')row.name=validateSaveName(row.name);
        if(table==='web_lineup_favorites'){
          row.name=favoriteName(row.name);
          row.players=JSON.stringify(favoriteIds(JSON.parse(String(row.players))));
        }
        if(table==='web_transfer_quotes'||table==='web_negotiation_terms')row.negotiation_id=id+':'+String(row.negotiation_id);
        if(table==='web_matches')row.id=id+':'+String(row.id);
        run('INSERT INTO '+table+'('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')',
          [id,...columns.slice(1).map(key=>row[key] as Value)]);
      }
    }
    run('COMMIT');
    return ids.size;
  }catch(error){
    run('ROLLBACK');
    throw error;
  }
}

export function readGodotCareer(read:Select){
  const names=physicalTables(read);
  const version=Number(read('PRAGMA user_version')[0]?.user_version);
  if(!names.has('career')||!names.has('career_settings')||!names.has('organization_identities')||version<9||version>15){
    throw Error('Selecione uma carreira Godot dos esquemas 9 a 15.');
  }
  requireIntegrity(read);
  const career=read('SELECT organization, abbreviation, country, modality, difficulty, balance, day, color FROM career WHERE id=1')[0];
  if(!career)throw Error('O arquivo Godot não contém uma carreira.');
  const org=read('SELECT organization_id FROM career_settings WHERE id=1')[0];
  const config=read('SELECT shape_id, symbol_id, secondary_color, detail_color, display_text, pattern_id, custom_png FROM organization_identities WHERE organization_id=?',[Number(org?.organization_id)])[0];
  const png=config?.custom_png;
  const identity:Identity=validateIdentity({
    ...defaultIdentity,shape:config?.shape_id??defaultIdentity.shape,pattern:config?.pattern_id??defaultIdentity.pattern,
    symbol:config?.symbol_id??defaultIdentity.symbol,primary:String(career.color),
    secondary:config?.secondary_color??defaultIdentity.secondary,detail:config?.detail_color??defaultIdentity.detail,
    text:config?.display_text??'',png:png instanceof Uint8Array?btoa(Array.from(png,byte=>String.fromCharCode(byte)).join('')):'',
  });
  const regions=new Intl.DisplayNames(['pt-BR'],{type:'region'});
  const country=names.has('countries')?read('SELECT id FROM countries WHERE name=? LIMIT 1',[String(career.country)])[0]?.id:undefined;
  const countryLabel=String(career.country);
  const countryCode=typeof country==='string'&&/^[A-Z]{2}$/.test(country)?country
    : ['BR','US','KR','CN','DE','FR','JP','AR','GB','CA','PT','AU','RU','MX','ES'].find(code=>regions.of(code)===countryLabel)??'ZZ';
  const balance=Number(career.balance)*100,day=Number(career.day);
  if(!Number.isSafeInteger(balance)||balance<0||!Number.isSafeInteger(day)||day<1||!['MOBA','FPS'].includes(String(career.modality)))throw Error('Saldo, dia ou modalidade inválidos no save Godot.');
  return {name:String(career.organization),code:String(career.abbreviation),country:countryCode,
    mode:String(career.modality),difficulty:String(career.difficulty),balance,day,identity};
}
