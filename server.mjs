import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {root,home,policy,policyFile,atomic,readJson} from './runtime/policy.mjs';
import {budgetStatus} from './runtime/budget-status.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.FISH_PORT||17860),origin=`http://127.0.0.1:${port}`,token=randomBytes(32).toString('hex');
let starting=false;
function status(){const p=policy(),r=readJson(join(home,'fish-control-runtime.json'),{});const comments=['fish-public-bili.json','bili-dialogue-transport.json'].flatMap(f=>Object.values(readJson(join(home,f),{}).items||{})).filter(x=>x.kind==='comment'&&x.receipt&&x.publicVisible===false);return {enabled:p.enabled,open:p.open,revision:p.revision||0,runtime:Date.now()-(r.at||0)<10000,appliedRevision:r.revision,starting,public:r.public||{},commentVisibilityWarning:comments.length>0,budgetStatus:budgetStatus(readJson(join(home,'companion-budget.json'),null)),budget:readJson(join(home,'companion-budget.json'),{}).estimatedCny,cutoff:'2026-11-01 00:00（北京时间）',version:'0.1.0'};}
function startBackend(){if(starting||status().runtime)return;starting=true;const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'Start-Companion.ps1')],{windowsHide:true,stdio:'ignore'});child.once('error',()=>{starting=false;});child.once('close',()=>{starting=false;});}
export function validRequest(req){return req.headers.host===`127.0.0.1:${port}`&&(!req.headers.origin||req.headers.origin===origin);}
const server=http.createServer(async(req,res)=>{
 const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(!validRequest(req))return send(403,{error:'仅允许本机控制页面'});
 try{
  if(req.method==='GET'&&req.url==='/'){let html=readFileSync(join(here,'public/index.html'),'utf8').replace('__CSRF__',token);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"});return res.end(html);}
  if(req.method==='GET'&&req.url==='/api/status')return send(200,status());
  if(req.method==='POST'&&req.url==='/api/control'){
   if(req.headers['x-fish-token']!==token||req.headers.origin!==origin)return send(403,{error:'请从本机面板操作'});
   let raw='';for await(const c of req){raw+=c;if(raw.length>1024)return send(413,{error:'请求过大'});}
   const input=JSON.parse(raw),p=policy();
   if(Object.keys(input).some(k=>!['enabled','open'].includes(k))||!Object.keys(input).length||Object.values(input).some(v=>typeof v!=='boolean'))return send(400,{error:'只接受两个布尔开关'});
   const now=Date.now();if(input.enabled===true&&!p.enabled)p.enabledSince=now;
   if(input.open===true&&!p.open||input.enabled===true&&!p.enabled)p.publicSince=now;
   Object.assign(p,input,{revision:(p.revision||0)+1,updatedAt:now});atomic(policyFile,p);
   if(p.enabled)startBackend();return send(200,status());
  }
  send(404,{error:'Not found'});
 }catch{send(500,{error:'操作失败，请查看本机配置或重试'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Fish Control: ${origin}`));
