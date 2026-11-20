const groups={
  'América do Sul':'BR AR BO CL CO EC PY PE UY VE',
  'América do Norte':'CA CR US MX PA',
  Europa:'DE AT BE DK ES FI FR GR IE IT NO NL PL PT GB CZ RO RS SE CH UA',
  Ásia:'SA CN KR AE PH IN ID JP MY MN SG TH TR VN',
  África:'ZA EG MA NG',
  Oceania:'AU NZ',
};
const labels=new Intl.DisplayNames(['pt-BR'],{type:'region'});
export const countryRegions:Record<string,string>=Object.fromEntries(Object.entries(groups).flatMap(([region,codes])=>codes.split(' ').map(code=>[code,region])));
export const countries:Record<string,string>=Object.fromEntries(Object.keys(countryRegions).map(code=>[code,labels.of(code)??code]).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')));
