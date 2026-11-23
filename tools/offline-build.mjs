import {createHash} from 'node:crypto';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

export function writeOfflineWorker(outDir){
  function files(directory,prefix=''){
    return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
      const relative=prefix+entry.name;
      return entry.isDirectory()?files(join(directory,entry.name),relative+'/'):[relative];
    });
  }
  const assets=files(outDir).filter(file=>file!=='offline-worker.js').sort();
  const hash=createHash('sha256');
  for(const file of assets)hash.update(file).update(readFileSync(join(outDir,file)));
  const version='uem-offline-'+hash.digest('hex').slice(0,16);
  const runtime=readFileSync(new URL('./offline-worker.js',import.meta.url),'utf8');
  writeFileSync(join(outDir,'offline-worker.js'),
    'const CACHE = '+JSON.stringify(version)+';\nconst ASSETS = '+JSON.stringify(assets.map(file=>'/'+file))+';\n'+runtime);
}
