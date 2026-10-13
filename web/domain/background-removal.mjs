const MAX_PIXELS=16_000_000;
function parseColor(color){if(Array.isArray(color)&&color.length>=3)return color.slice(0,3).map(v=>Math.max(0,Math.min(255,Number(v)||0)));const m=/^#?([0-9a-f]{6})$/i.exec(String(color||""));if(!m)throw new TypeError("Background color must be a six-digit RGB hex value");return[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16));}
function validate(image,operation){const width=Number(image?.width),height=Number(image?.height),data=image?.data;if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_PIXELS||!data||data.length!==width*height*4)throw new TypeError(operation+" requires valid image pixels up to 16 megapixels");return{width,height,data};}
function distance(data,offset,target){const r=data[offset]-target[0],g=data[offset+1]-target[1],b=data[offset+2]-target[2];return Math.sqrt((r*r+g*g+b*b)/3);}
function unmatte(data,offset,target,alpha){if(alpha<=0||alpha>=1)return;for(let c=0;c<3;c++)data[offset+c]=Math.max(0,Math.min(255,Math.round((data[offset+c]-target[c]*(1-alpha))/alpha)));}
/**
 * Local, non-AI edge-connected matte for flat backgrounds. Strong local color
 * transitions stop flood propagation, protecting black ink and warm/cool fills.
 * Feathering is restricted to the connected fringe to avoid leaking through lines.
 */
export function removeConnectedBackground(imageData,{targetColor="#ffffff",tolerance=36,feather=18,edgeSensitivity=42,protectLineArt=true,decontaminate=true}={}){
 const{width,height,data:source}=validate(imageData,"Background removal"),target=parseColor(targetColor),threshold=Math.max(0,Math.min(255,Number(tolerance)||0)),soft=Math.max(0,Math.min(100,Number(feather)||0)),edge=Math.max(0,Math.min(180,Number(edgeSensitivity)||0)),reach=Math.min(255,threshold+soft),count=width*height,data=new Uint8ClampedArray(source),visited=new Uint8Array(count),queue=new Int32Array(count);let head=0,tail=0;
 const d=i=>distance(data,i*4,target);
 function seed(i){if(visited[i])return;const o=i*4;if(data[o+3]===0||d(i)>threshold)return;visited[i]=1;queue[tail++]=i;}
 for(let x=0;x<width;x++){seed(x);if(height>1)seed((height-1)*width+x);}
 for(let y=1;y<height-1;y++){seed(y*width);if(width>1)seed(y*width+width-1);}
 while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width),neighbors=[];if(x)neighbors.push(i-1);if(x+1<width)neighbors.push(i+1);if(y)neighbors.push(i-width);if(y+1<height)neighbors.push(i+width);
  for(const n of neighbors){if(visited[n])continue;const o=n*4;if(data[o+3]===0){visited[n]=1;continue;}const nd=d(n);if(nd>reach)continue;
   if(protectLineArt){const p=i*4,delta=Math.sqrt(((data[o]-data[p])**2+(data[o+1]-data[p+1])**2+(data[o+2]-data[p+2])**2)/3);if(delta>edge)continue;}
   visited[n]=1;if(nd<=threshold)queue[tail++]=n;
  }
 }
 for(let i=0;i<count;i++){if(!visited[i])continue;const o=i*4,dist=d(i);if(dist<=threshold)data[o+3]=0;else if(soft>0){const a=Math.max(0,Math.min(1,(dist-threshold)/soft));data[o+3]=Math.round(data[o+3]*a);if(decontaminate)unmatte(data,o,target,a);}}
 return{width,height,data};
}
export function applyEraseStrokes(imageData,strokes=[]){const{width,height,data:source}=validate(imageData,"Manual erase"),data=new Uint8ClampedArray(source);for(const stroke of Array.isArray(strokes)?strokes:[]){const size=Number(stroke?.size),points=Array.isArray(stroke?.points)?stroke.points:[];if(!Number.isFinite(size)||size<=0||!points.length)continue;const radius=size/2,erase=p=>{const minX=Math.max(0,Math.floor(p.x-radius)),maxX=Math.min(width-1,Math.ceil(p.x+radius)),minY=Math.max(0,Math.floor(p.y-radius)),maxY=Math.min(height-1,Math.ceil(p.y+radius));for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const dx=x+.5-p.x,dy=y+.5-p.y;if(dx*dx+dy*dy<=radius*radius)data[(y*width+x)*4+3]=0;}};if(points.length===1){erase(points[0]);continue;}for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(distance/Math.max(1,radius*.5)));for(let s=0;s<=steps;s++){const t=s/steps;erase({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}}return{width,height,data};}
