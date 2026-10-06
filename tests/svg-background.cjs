// Background color must leave independently visible white character samples white.
const sharp=require('sharp'),fs=require('fs');
(async()=>{
 const items=JSON.parse(fs.readFileSync('assets/coloring/catalog.json'));
 const seeds=JSON.parse(fs.readFileSync('tests/coloring-seeds.json'));
 const clean=Object.fromEntries(JSON.parse(fs.readFileSync('assets/coloring/CLEAN-LINES-REPORT.json')).map(i=>[i.id,i.seeds]));
 fs.mkdirSync('/tmp/art-review12',{recursive:true});
 for(const item of items){
  const original=fs.readFileSync(`assets/coloring/${item.id}.svg`,'utf8');
  const svg=original.replace(/(<path\b[^>]*data-region="sky"[^>]*fill=")white/,'$1#ff7399');
  const buffer=await sharp(Buffer.from(svg)).resize(720,880).png().toBuffer();
  await sharp(buffer).toFile(`/tmp/art-review12/${item.id}.png`);
  const {data,info}=await sharp(buffer).raw().toBuffer({resolveWithObject:true});
  const before=clean[item.id]?await sharp(Buffer.from(original)).resize(720,880).raw().toBuffer():null;
  let checked=0;
  for(const [x,y] of (clean[item.id]||seeds[item.id]||seeds[item.simpleOf])){
   const i=(Math.round(y*2)*info.width+Math.round(x*2))*info.channels;
   // Spline rendering can put a generated geometry seed on ink rather than a
   // white fill cell. Check source-white samples, with a minimum per sheet.
   if(before&&(before[i]<245||before[i+1]<245||before[i+2]<245))continue;
   let white=false;for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){const p=i+(oy*info.width+ox)*info.channels;if(data[p]>=245&&data[p+1]>=245&&data[p+2]>=245)white=true;}
   if(!white)throw Error(`${item.id}: seed ${x},${y} is not isolated white`);
   checked++;
  }
  if(checked<(before?3:1))throw Error(`${item.id}: too few independent white character samples`);
  console.log(`PASS ${item.id}: ${checked} white samples`);
 }
 console.log(`PASS ${items.length} normalized SVG background isolation checks`);
})().catch(e=>{console.error(e);process.exit(1)});
