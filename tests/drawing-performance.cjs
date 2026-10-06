// Native Canvas regression: compare optimized rendering with the previous full-frame renderer.
// NODE_PATH=/tmp/little-art-qa/node_modules node tests/drawing-performance.cjs
const {createCanvas}=require('@napi-rs/canvas');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const current=fs.readFileSync('app.js','utf8');
const previous=cp.execFileSync('git',['show','aaff6a9:app.js'],{encoding:'utf8'});
function run(source,tool,masked){
 const canvas=createCanvas(720,1400),ink=createCanvas(720,1400),mask=createCanvas(720,1400);
 canvas.getBoundingClientRect=()=>({width:390});
 const mc=mask.getContext('2d');mc.fillStyle='white';mc.fillRect(0,0,360,1400);
 const context={canvas,ink,ctx:canvas.getContext('2d'),inkCtx:ink.getContext('2d'),stroke:{width:24*720/390,region:masked?'body':null,mask:masked?mask:null},tool,scene:masked?'kitty':'blank',color:'#ff6fa0',hue:0,$:()=>({value:24}),regionMask:()=>mask};
 vm.createContext(context);const start=source.indexOf('function mark('),end=source.indexOf('canvas.onpointerdown',start);
 vm.runInContext(source.slice(start,end),context);
 const points=Array.from({length:240},(_,i)=>({x:100+i*2,y:250+Math.sin(i/15)*100}));
 const t=performance.now();points.forEach((p,i)=>context.mark(p,i?points[i-1]:null));
 return {pixels:context.ctx.getImageData(0,0,720,1400).data,ms:performance.now()-t};
}
for(const tool of ['pen','eraser','rainbow'])for(const masked of [false,true]){
 const old=run(previous,tool,masked),now=run(current,tool,masked);
 // Clipping changes native antialiasing at the translucent edge; opaque interiors must match.
 let differing=0,max=0;for(let i=0;i<old.pixels.length;i++){const a=i-i%4+3;const d=Math.abs(i%4===3?old.pixels[i]-now.pixels[i]:(old.pixels[i]*old.pixels[a]-now.pixels[i]*now.pixels[a])/255);if(d>1){differing++;max=Math.max(max,d)}}
 assert.ok(differing<5000&&max<=32,`${tool}/${masked}: changed ${differing} channels, maximum difference ${max}`);
 for(let i=0;i<old.pixels.length;i+=4)if(tool!=='rainbow'&&old.pixels[i+3]===255&&now.pixels[i+3]===255)for(let j=0;j<3;j++)assert.ok(Math.abs(old.pixels[i+j]-now.pixels[i+j])<=1,'opaque stroke changed');
 if(masked)for(let y=0;y<1400;y++)for(let x=360;x<720;x++)assert.equal(now.pixels[(y*720+x)*4+3],0,'stroke escaped its initial region');
 console.log(`${tool} ${masked?'clipped':'blank'}: previous ${old.ms.toFixed(1)} ms, optimized ${now.ms.toFixed(1)} ms; pixels passed`);
}
