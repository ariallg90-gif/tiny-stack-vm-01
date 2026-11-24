import * as fs from "node:fs";
const I=process.env.MAKEFUN_INPUT_DIR??"/input",O=process.env.MAKEFUN_OUTPUT_DIR??"/output";
function b(s:number[],f:(a:number,b:number)=>number){if(s.length<2)throw 2;const y=s.pop()!,x=s.pop()!;s.push(f(x,y))}
function u(s:number[],f:(a:number)=>number){if(s.length<1)throw 2;s.push(f(s.pop()!))}
function S(p:Buffer,a:number){return((p[a]|p[a+1]<<8)<<16)>>16}
function U(p:Buffer,a:number){return p[a]|p[a+1]<<8}

function run(p:Buffer,g:Buffer):{exit:number;out:Buffer}{
const s:number[]=[],c:number[]=[],m=new Int32Array(256),o:number[]=[];
let q=0,j=0,t=0;
const k=(n:number)=>{if(s.length<n)throw 2},F=()=>{if(s.length>=256)throw 3};
try{for(;;){
if(t>=1e6)throw 10;
if(q<0||q>=p.length)throw 9;
const d=p[q],e=d===1?1:d===2?4:d>=48&&d<=51?2:0;
if(q+1+e>p.length)throw 9;
t++;
const n=q+1+e;

switch(d){
case 0:return{exit:0,out:Buffer.from(o)};
case 1:F();s.push(p[q+1]<<24>>24);break;
case 2:F();s.push(p[q+1]|p[q+2]<<8|p[q+3]<<16|p[q+4]<<24);break;
case 3:k(1);s.pop();break;
case 4:k(1);F();s.push(s[s.length-1]);break;
case 5:k(2);{const x=s[s.length-1];s[s.length-1]=s[s.length-2];s[s.length-2]=x}break;
case 6:k(2);F();s.push(s[s.length-2]);break;
case 7:k(3);{const x=s[s.length-3];s[s.length-3]=s[s.length-2];s[s.length-2]=s[s.length-1];s[s.length-1]=x}break;
case 16:b(s,(a,b)=>(a+b)|0);break;
case 17:b(s,(a,b)=>(a-b)|0);break;
case 18:b(s,Math.imul);break;
case 19:b(s,(a,b)=>{if(b===0)throw 4;return(a/b)|0});break;
case 20:b(s,(a,b)=>{if(b===0)throw 4;return(a%b)|0});break;
case 21:b(s,(a,b)=>{if(b===0)throw 4;return(a>>>0)/(b>>>0)|0});break;
case 22:b(s,(a,b)=>{if(b===0)throw 4;return(a>>>0)%(b>>>0)|0});break;
case 23:u(s,a=>(-a)|0);break;
case 24:b(s,(a,b)=>a&b);break;
case 25:b(s,(a,b)=>a|b);break;
case 26:b(s,(a,b)=>a^b);break;
case 27:u(s,a=>~a);break;
case 28:b(s,(a,b)=>a<<(b&31));break;
case 29:b(s,(a,b)=>a>>(b&31));break;
case 30:b(s,(a,b)=>(a>>>(b&31))|0);break;
case 32:b(s,(a,b)=>a===b?1:0);break;
case 33:b(s,(a,b)=>a<b?1:0);break;
case 34:b(s,(a,b)=>(a>>>0)<(b>>>0)?1:0);break;
case 48:q=n+S(p,q+1);continue;
case 49:k(1);if(s.pop()===0){q=n+S(p,q+1);continue}break;
case 50:k(1);if(s.pop()!==0){q=n+S(p,q+1);continue}break;
case 51:if(c.length>=64)throw 7;c.push(n);q=U(p,q+1);continue;
case 52:if(c.length===0)throw 8;q=c.pop()!;continue;
case 64:k(1);{const a=s.pop()!;if(a<0||a>255)throw 6;s.push(m[a])}break;
case 65:k(2);{const a=s.pop()!,v=s.pop()!;if(a<0||a>255)throw 6;m[a]=v}break;
case 80:{k(1);const w=String(s.pop());if(o.length+w.length>65536)throw 11;for(let i=0;i<w.length;i++)o.push(w.charCodeAt(i))}break;
case 81:k(1);if(o.length+1>65536)throw 11;o.push(s.pop()!&255);break;
case 82:F();s.push(j<g.length?g[j++]:-1);break;
case 83:k(1);return{exit:s.pop()!&255,out:Buffer.from(o)};
default:throw 5;
}
q=n;
}}catch(e){if(typeof e==="number")return{exit:e,out:Buffer.from(o)};throw e}}
for(let n=1;n<=40;n++){
const id="i"+("00"+n).slice(-3),y=fs.readFileSync(I+"/"+id+"/program.bin"),g=fs.readFileSync(I+"/"+id+"/input.bin"),r=run(y,g),d=O+"/"+id;
fs.mkdirSync(d,{recursive:true});
fs.writeFileSync(d+"/stdout.bin",r.out);
fs.writeFileSync(d+"/exit.txt",r.exit+"\n");
}
