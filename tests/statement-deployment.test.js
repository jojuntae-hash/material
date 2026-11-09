import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('statement documents allow same-origin framing while other pages deny framing',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 const headers=path=>Object.fromEntries(config.headers.filter(rule=>new RegExp('^'+rule.source+'$').test(path)).flatMap(rule=>rule.headers.map(h=>[h.key,h.value])));
 assert.equal(headers('/statements/実行.html')['X-Frame-Options'],'SAMEORIGIN');
 assert.equal(headers('/statements/実行.html')['Content-Security-Policy'],"frame-ancestors 'self'");
 assert.equal(headers('/')['X-Frame-Options'],'DENY');
 assert.equal(headers('/settings')['X-Frame-Options'],'DENY');
 const fallback=new RegExp('^'+config.rewrites[0].source+'$');
 assert.equal(fallback.test('/statements/실행.html'),false);
 assert.equal(fallback.test('/statements/app.js'),false);
 assert.equal(fallback.test('/request'),true);
});
