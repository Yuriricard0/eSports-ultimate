import {defineConfig} from 'vite';
import {resolve} from 'node:path';
import {writeOfflineWorker} from './tools/offline-build.mjs';

export default defineConfig({
  worker:{format:'es'},
  optimizeDeps:{exclude:['@sqlite.org/sqlite-wasm']},
  plugins:[{
    name:'uem-offline',
    apply:'build',
    configResolved(config){thisOutDir=resolve(config.root,config.build.outDir);},
    closeBundle(){writeOfflineWorker(thisOutDir);},
  }],
});
let thisOutDir:string;
