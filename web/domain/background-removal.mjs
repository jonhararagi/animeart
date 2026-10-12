const MAX_PIXELS = 16_000_000;
function parseColor(color) {
  if (Array.isArray(color) && color.length >= 3) return color.slice(0,3).map(v => Math.max(0,Math.min(255,Number(v)||0)));
  const match = /^#?([0-9a-f]{6})$/i.exec(String(color||""));
  if (!match) throw new TypeError("Background color must be a six-digit RGB hex value");
  return [0,2,4].map(offset => parseInt(match[1].slice(offset,offset+2),16));
}
function colorDistance(data, offset, target) {
  const r=data[offset]-target[0],g=data[offset+1]-target[1],b=data[offset+2]-target[2];
  return Math.sqrt((r*r+g*g+b*b)/3);
}
export function removeConnectedBackground(imageData,{targetColor="#ffffff",tolerance=36,feather=18}={}) {
  const width=Number(imageData?.width),height=Number(imageData?.height),source=imageData?.data;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_PIXELS||!source||source.length!==width*height*4)
    throw new TypeError("Background removal requires valid image pixels up to 16 megapixels");
  const target=parseColor(targetColor),threshold=Math.max(0,Math.min(255,Number(tolerance)||0)),softness=Math.max(0,Math.min(100,Number(feather)||0)),reach=Math.min(255,threshold+softness);
  const pixels=width*height,data=new Uint8ClampedArray(source),visited=new Uint8Array(pixels),queue=new Int32Array(pixels);
  let head=0,tail=0;
  function enqueue(index) {
    if(visited[index])return;
    const offset=index*4;
    if(data[offset+3]===0||colorDistance(data,offset,target)>reach)return;
    visited[index]=1;queue[tail++]=index;
  }
  for(let x=0;x<width;x++){enqueue(x);if(height>1)enqueue((height-1)*width+x);}
  for(let y=1;y<height-1;y++){enqueue(y*width);if(width>1)enqueue(y*width+width-1);}
  while(head<tail){
    const index=queue[head++],offset=index*4,distance=colorDistance(data,offset,target);
    if(distance<=threshold)data[offset+3]=0;
    else if(softness>0)data[offset+3]=Math.round(data[offset+3]*Math.max(0,Math.min(1,(distance-threshold)/softness)));
    const x=index%width,y=Math.floor(index/width);
    if(x>0)enqueue(index-1);if(x+1<width)enqueue(index+1);if(y>0)enqueue(index-width);if(y+1<height)enqueue(index+width);
  }
  return {width,height,data};
}
export function applyEraseStrokes(imageData, strokes = []) {
  const width=Number(imageData?.width),height=Number(imageData?.height),source=imageData?.data;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_PIXELS||!source||source.length!==width*height*4)
    throw new TypeError("Manual erase requires valid image pixels up to 16 megapixels");
  const data=new Uint8ClampedArray(source);
  for(const stroke of Array.isArray(strokes)?strokes:[]) {
    const size=Number(stroke?.size),points=Array.isArray(stroke?.points)?stroke.points:[];
    if(!Number.isFinite(size)||size<=0||points.length===0)continue;
    const radius=size/2;
    const eraseCircle=(point)=>{
      const minX=Math.max(0,Math.floor(point.x-radius)),maxX=Math.min(width-1,Math.ceil(point.x+radius));
      const minY=Math.max(0,Math.floor(point.y-radius)),maxY=Math.min(height-1,Math.ceil(point.y+radius));
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        const dx=x+0.5-point.x,dy=y+0.5-point.y;
        if(dx*dx+dy*dy<=radius*radius)data[(y*width+x)*4+3]=0;
      }
    };
    if(points.length===1){eraseCircle(points[0]);continue;}
    for(let index=1;index<points.length;index++){
      const a=points[index-1],b=points[index],distance=Math.hypot(b.x-a.x,b.y-a.y);
      const steps=Math.max(1,Math.ceil(distance/Math.max(1,radius*0.5)));
      for(let step=0;step<=steps;step++){
        const t=step/steps;eraseCircle({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      }
    }
  }
  return {width,height,data};
}
