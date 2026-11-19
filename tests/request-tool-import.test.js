import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {filterToolsByOwnership} from '../src/tool-ownership.js';
import {requestToolData} from '../src/request-tool-core.js';
import {toolSummary} from '../src/tool-ledger-core.js';
import {buildToolWorkbook} from '../src/tool-ledger-extras.js';
const request={id:'req1',kind:'request',version:1,data:{name:'충전그라인더 본체',spec:'18V',unit:'EA',quantity:2}};
const params={request,ownership:'hq',name:'충전 그라인더',spec:'18V',unit:'EA',quantity:2,date:'2026-11-19',eventId:'receive1',at:'2026-11-19T01:00:00Z'};
test('HQ export excludes our tools and unclassified legacy tools in every sheet',()=>{
 const records=['hq','own',undefined].map((ownership,i)=>({id:String(i),data:{type:'tool-ledger',name:'공구'+i,ownership,unit:'EA',events:[{id:'r'+i,type:'receive',date:'2026-11-19',quantity:1}]}}));
 const selected=filterToolsByOwnership(records,'hq');assert.equal(selected.length,1);
 const wb=buildToolWorkbook(selected);for(const name of wb.SheetNames){const text=JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1}));assert.ok(!text.includes('공구1'));assert.ok(!text.includes('공구2'));assert.ok(text.includes('본사 물량'));}
});
test('claim linking alone never receives stock and preserves source',()=>{
 const before=JSON.stringify(request),data=requestToolData(params);assert.equal(toolSummary(data).stock,0);assert.equal(data.requestTransfers[0].received,false);assert.equal(JSON.stringify(request),before);
});
test('existing tool with different name can receive without losing earlier history',()=>{
 const target={id:'tool1',kind:'batch',version:2,data:{type:'tool-ledger',name:'기존 그라인더',unit:'EA',ownership:'own',events:[{id:'r',type:'receive',date:'2026-11-01',quantity:1}]}};
 const data=requestToolData({...params,target,receive:true});assert.equal(data.name,'기존 그라인더');assert.equal(data.ownership,'own');assert.equal(toolSummary(data).stock,3);assert.equal(target.data.events.length,1);
 assert.throws(()=>requestToolData({...params,target:{...target,data},receive:true}),/이미 연결/);
 assert.throws(()=>requestToolData({...params,target,unit:'SET'}),/단위/);
 assert.throws(()=>requestToolData({...params,ownership:''}),/소유/);
 assert.throws(()=>requestToolData({...params,receive:true,date:'2026-02-30'}),/날짜/);
});
