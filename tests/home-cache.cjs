const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const handlers={},entries=new Map();let calls=0,offline=false;
const response=()=>({ok:true,clone(){return this}}),cache={match:async r=>entries.get(typeof r==='string'?r:r.url),put:async(r,v)=>entries.set(r.url,v)};
const context={self:{addEventListener:(n,f)=>handlers[n]=f},location:{origin:'https://example.com'},URL,caches:{open:async()=>cache},fetch:async()=>{calls++;if(offline)throw Error('offline');return response()},Response:{error:()=>({error:true})}};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),context);
async function request(path,mode='cors'){let result;const pending=[];handlers.fetch({request:{method:'GET',url:'https://example.com/'+path,mode},respondWith:r=>result=r,waitUntil:p=>pending.push(p)});const value=await result;await Promise.all(pending);return value}
(async()=>{
 await request('assets/coloring/kitty.svg?v=15');assert.equal(calls,1);
 offline=true;assert.ok((await request('assets/coloring/kitty.svg?v=15')).ok);assert.equal(calls,1,'cached artwork must not wait for network');
 assert.ok((await request('assets/coloring/rabbit.svg?v=15')).error,'unvisited sheets are not advertised as offline available');
 entries.set('./index.html',response());assert.ok((await request('', 'navigate')).ok,'offline shell fallback');
 offline=false;const before=calls;await request('', 'navigate');assert.equal(calls,before+1,'navigation must check for a new release');
 const sw=fs.readFileSync('sw.js','utf8');const files=JSON.parse(sw.match(/const FILES=(\[[^;]+\])/)[1]);assert.ok(files.every(f=>!f.startsWith('./assets/coloring/')),'installation must not preload the entire artwork collection');
 console.log('Cache hits, offline shell, fresh navigation, and lean installation passed');
})().catch(e=>{console.error(e);process.exitCode=1});
