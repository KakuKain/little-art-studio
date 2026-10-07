// Compare every prepared layer pair with the original SVG, including colored regions.
const fs=require('node:fs'), assert=require('node:assert/strict'), sharp=require('sharp');
(async()=>{
 for(const item of JSON.parse(fs.readFileSync('assets/coloring/catalog.json'))){
  const original=fs.readFileSync(`assets/coloring/${item.id}.svg`,'utf8');
  const bundle=JSON.parse(fs.readFileSync(`assets/coloring/prepared/${item.id}.json`));
  assert.equal(bundle.id,item.id);
  assert.equal(new Set(bundle.regions.map(r=>r.id)).size,bundle.regions.length);
  assert.ok(bundle.regions.some(r=>r.id==='sky'));
  assert.ok(!bundle.lines.includes('data-region='),'Ink must not own fill regions');
  for(const colored of [false,true]){
   const tint=s=>colored?s.replace(/(<[^>]*data-region="[^"]+"[^>]*fill=")white/g,'$1#ff7399'):s;
   const reconstructed=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bundle.viewBox.join(' ')}">${tint(bundle.paint)}${bundle.lines}</svg>`;
   const render=s=>sharp(Buffer.from(s)).resize(720,880).flatten({background:'#fff'}).raw().toBuffer();
   const [a,b]=await Promise.all([render(tint(original)),render(reconstructed)]);
   let bad=0;for(let i=0;i<a.length;i+=3)if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>16)bad++;
   assert.ok(bad<720*880*.001,`${item.id}/${colored?'colored':'white'}: ${bad} pixels changed`);
  }
  console.log(`PASS ${item.id}: layer reconstruction and stable region IDs`);
 }
})().catch(e=>{console.error(e);process.exitCode=1});
