// Sample real rendered fill interiors instead of pre-spline pixel geometry.
const fs=require('fs'),sharp=require('sharp');
(async()=>{
 const report=JSON.parse(fs.readFileSync('assets/coloring/CLEAN-LINES-REPORT.json'));
 for(const id of process.argv.slice(2)){
  const file=`assets/coloring/${id}.svg`,source=fs.readFileSync(file,'utf8');let next=1;
  const labeled=source.replace(/(<path\b[^>]*data-region="[^"]+"[^>]*fill=")white/g,(_,prefix)=>`${prefix}#${(next++).toString(16).padStart(6,'0')}`);
  const {data,info}=await sharp(Buffer.from(labeled)).resize(720,880).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const value=(x,y)=>{const i=(y*info.width+x)*3;return data[i]*65536+data[i+1]*256+data[i+2]};
  const samples=new Map();
  for(let y=4;y<info.height-4;y+=3)for(let x=4;x<info.width-4;x+=3){const v=value(x,y);if(v<=1||v>=next||samples.has(v))continue;if([[-3,0],[3,0],[0,-3],[0,3],[-3,-3],[3,3],[-3,3],[3,-3]].every(([dx,dy])=>value(x+dx,y+dy)===v))samples.set(v,[x/2,y/2]);}
  const row=report.find(i=>i.id===id);row.seeds=[...samples.values()];row.seedMethod='rendered fill interior';console.log(id,row.seeds.length);
 }
 fs.writeFileSync('assets/coloring/CLEAN-LINES-REPORT.json',JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
