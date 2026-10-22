import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterRequests,matchesSearch} from '../src/core.js';
test('띄어쓰기·탭·줄바꿈에 관계없이 검색하고 영문 대소문자 무시',()=>{
 for(const name of ['빔클램프 브라켓','빔 클램프 브라켓']){
 const records=[{id:'1',kind:'request',data:{name,date:'2026-10-20',trade:'기계',location:'지상 2층',applicant:'홍 길동'}}];
 for(const q of ['빔클램프','빔 클램프',' 빔  클램프 ','빔\t클램프','빔\n클램프'])assert.equal(filterRequests(records,{q}).length,1);
 assert.equal(filterRequests(records,{q:'빔 클램프',trade:'소방'}).length,0);
 assert.equal(filterRequests(records,{location:'지상2 층',applicant:'홍길동'}).length,1);
 assert.equal(filterRequests(records,{q:'볼밸브'}).length,0);
 }
 assert.equal(matchesSearch('STS 관','sts관'),true);
 assert.equal(matchesSearch('대리점 이름','대리점이름'),true);
 assert.equal(matchesSearch(undefined,'빔'),false);
});
