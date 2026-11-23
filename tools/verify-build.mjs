import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(process.argv[2]??'dist');
const read=file=>readFileSync(join(root,file),'utf8');
const runtime=read('offline-worker.js');
const assets=JSON.parse(runtime.match(/^const ASSETS = (\[[^\n]*\]);/m)?.[1]??'null');
assert.ok(Array.isArray(assets)&&assets.length>0,'Manifesto offline ausente.');
let bytes=0;
function check(url){
 const path=resolve(root,'.'+decodeURIComponent(url.split(/[?#]/)[0]));
 assert.ok(path.startsWith(root+sep),'Recurso fora do build: '+url);
 assert.ok(existsSync(path)&&statSync(path).isFile()&&statSync(path).size>0,'Recurso ausente: '+url);
 return statSync(path).size;
}
for(const asset of assets)bytes+=check(asset);
const html=read('index.html');
assert.ok(html.includes('V1 Alpha'),'Identificação Alpha ausente do HTML.');
const version=JSON.parse(readFileSync(resolve('package.json'),'utf8')).version;
assert.ok(version.includes('alpha'),'Versão do pacote não é Alpha.');
assert.ok(assets.filter(path=>/\/index-.*\.js$/.test(path)).some(path=>read(path.slice(1)).includes(version)),'Versão exibida difere do pacote.');
for(const [,url] of html.matchAll(/(?:src|href)="(\/[^\"]+)"/g))check(url);
for(const css of assets.filter(path=>path.endsWith('.css'))){
 for(const [,url] of read(css.slice(1)).matchAll(/url\(["']?(\/[^)"']+)["']?\)/g))check(url);
}
const world=JSON.parse(read('data/real_teams_2026.json')),players=JSON.parse(read('data/players-v1.json'));
for(const org of world.organizations)if(org.logo)check(org.logo.replace('res://','/'));
const portraits=new Set(players.filter(p=>p.portraitIndex>=0).map(p=>'/assets/players/players-'+String(Math.floor(p.portraitIndex/128)).padStart(2,'0')+'.webp'));
for(const portrait of portraits)check(portrait);
assert.ok(assets.some(path=>path.endsWith('.wasm')),'SQLite WASM ausente.');
assert.ok(assets.some(path=>/\/worker-.*\.js$/.test(path)),'Worker de persistência ausente.');
console.log(JSON.stringify({files:assets.length,sizeMiB:Math.round(bytes/1048576*100)/100,organizations:world.organizations.length,teams:world.teams.length,players:players.length,portraitAtlases:portraits.size,missing:0},null,2));
