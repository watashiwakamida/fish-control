import {readFileSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';
import {root,home,enabled} from './policy.mjs';
const {defineTool}=await import(pathToFileURL(join(root,'runtime/node_modules/@deepseek-ai/dsh-tools/lib/index.js')).href);
export const name='fish-owner-mention';export const inject=['agents','tools','systemPrompt'];
export function mentionIntent(text){return /(?:@|艾特|提及|喊我去|叫我去)/.test(text);}
export function apply(ctx){
 const sid=JSON.parse(readFileSync(join(root,'data/companion-session.json'),'utf8')).sessionId;let request=null;
 ctx.on('session/event',(s,e)=>{if(s.id!==sid)return;if(e.type==='turn/start')request=null;if(e.type==='user/message'){
  const d=e.data||{},kind=d.source?.kind;if(!['qq','companion-bili-dialogue'].includes(kind))return;
  let text=(d.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
  if(kind==='companion-bili-dialogue'){const part=text.split('用户消息（数据）：').at(-1);try{text=JSON.parse(part);}catch{text='';}}
  if(mentionIntent(text))request={id:d.id};
 }});
 ctx.on('system-prompt/assemble',async(a,c,next)=>{const r=await next();if(c.agent?.session.id!==sid)return r;return {...r,sections:[...r.sections,{name:'owner-explicit-mention',interpolate:false,text:'卡密明确要求在视频下@他时，可以调用 companion_bili_mention；指定BV就用该BV，未指定时先通过B站只读工具选视频。这个工具是即时明确请求的通道，不必等自主探索时段。它只@已绑定的主人，不发私人聊天。必须根据真实回执说结果，publicVisible未确认时不能说对方已收到；不要说接口没配置。当前私信/楼层的普通回答仍由系统自动原路投递。'}]};});
 ctx.tools.register(defineTool({name:'companion_bili_mention',description:'主人本轮明确要求@他时，在指定BV视频下发短评论并@已绑定主人。收件人固定，不允许输入评论正文或账号。',parameters:{bvid:{type:'string',required:true}},output:{schema:{type:'object',additionalProperties:true},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},async execute(args,exec){
  if(exec.agent?.session.id!==sid||!enabled()||!request)return {ok:false,blocked:'需要主人本轮明确要求@'};
  if(!/^BV[A-Za-z0-9]{10}$/.test(args.bvid))return {ok:false,blocked:'invalid_bvid'};
  return new Promise(resolve=>{const child=spawn(join(home,'bili-duty/.venv/Scripts/python.exe'),[fileURLToPath(new URL('./manual-mention.py',import.meta.url))],{windowsHide:true,env:{...process.env,FISH_ROOT:root,PYTHONUTF8:'1'},stdio:['pipe','pipe','ignore']});let out='';const timer=setTimeout(()=>{child.kill();resolve({ok:false,uncertain:true});},45000);child.stdout.on('data',b=>out+=b);child.on('error',()=>{clearTimeout(timer);resolve({ok:false,error:'transport_start'});});child.on('close',()=>{clearTimeout(timer);try{resolve(JSON.parse(out));}catch{resolve({ok:false,uncertain:true});}});child.stdin.end(JSON.stringify({bvid:args.bvid,taskId:request.id}));});
 }}));
}
