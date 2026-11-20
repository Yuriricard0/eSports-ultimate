import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultIdentity,validateIdentity,pngDimensions} from '../src/game-core/identity.ts';

test('valida camadas e imagem dentro dos limites da identidade',()=>{
  const identity={...defaultIdentity,shape:'diamond',pattern:'stripes',text:'ARES',secondary:'#102030'};
  assert.deepEqual(validateIdentity(identity),identity);
  assert.throws(()=>validateIdentity({...identity,shape:'fake'}));
  assert.throws(()=>validateIdentity({...identity,text:'X'.repeat(25)}));
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKpcAAAAASUVORK5CYII=','base64');
  assert.deepEqual(pngDimensions(png),{width:1,height:1});
  png.writeUInt32BE(4096,16);
  assert.throws(()=>pngDimensions(png),/2048/);
});
