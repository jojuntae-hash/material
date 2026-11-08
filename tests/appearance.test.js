import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAppearance,readAppearance,writeAppearance,appearanceKey} from '../src/appearance-preferences.js';
test('invalid and old preferences safely return readable defaults',()=>{assert.deepEqual(readAppearance({getItem:()=>'{bad'}),{theme:'quiet',fontScale:100});assert.deepEqual(normalizeAppearance({theme:'removed',fontScale:999}),{theme:'quiet',fontScale:100});assert.deepEqual(readAppearance(null),{theme:'quiet',fontScale:100});});
test('preferences round trip without persisting unrelated data',()=>{let saved;const storage={setItem:(key,value)=>{assert.equal(key,appearanceKey);saved=value;},getItem:()=>saved};assert.equal(writeAppearance(storage,{theme:'classic',fontScale:130,records:['private']}),true);assert.deepEqual(readAppearance(storage),{theme:'classic',fontScale:130});assert.equal(saved.includes('records'),false);});
test('blocked browser storage is reported without throwing',()=>{assert.equal(writeAppearance({setItem:()=>{throw Error('blocked');}},{theme:'grid',fontScale:115}),false);});
