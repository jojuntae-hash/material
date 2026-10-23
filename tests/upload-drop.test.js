import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUploadFiles} from '../src/upload-drop.js';
test('끌어놓기는 한 개의 xlsx·15MB 이내만 허용',()=>{const file={name:'청구서.XLSX',size:15*1024*1024};assert.equal(validateUploadFiles([file]),file);assert.throws(()=>validateUploadFiles([]),/한 파일/);assert.throws(()=>validateUploadFiles([file,file]),/한 파일/);assert.throws(()=>validateUploadFiles([{name:'청구서.pdf',size:100}]),/xlsx/);assert.throws(()=>validateUploadFiles([{...file,size:file.size+1}]),/15MB/);});
