// Incremental adapter installer for the existing DSH deployment. No credentials leave disk.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {root,home,policyFile,atomic,readJson} from './runtime/policy.mjs';
const here=dirname(fileURLToPath(import.meta.url)),profile=join(home,'profiles/web/cordis.patch.yml');
const marker='companion-fish-control-v3',oldProfile=readFileSync(profile,'utf8');
if(oldProfile.includes('id: companion-fish-control-')){console.log('Already installed; no files overwritten. Read HANDOFF before upgrading adapters.');process.exit(0);}
const backup=join(root,'backups','fish-control-'+new Date().toISOString().replace(/[:.]/g,'-'));mkdirSync(backup,{recursive:true});
function replaceOnce(s,from,to){if(s.split(from).length!==2)throw Error('Adapter baseline mismatch: '+from.slice(0,50));return s.replace(from,to);}
const controlUrl=pathToFileURL(join(here,'runtime/policy.mjs')).href;
const imports=`import {enabled as fishEnabled,policy as fishPolicy} from '${controlUrl}';\n`;
const plans=[];
function plan(oldName,newName,edit){const old=join(root,oldName),next=join(root,newName);const source=readFileSync(old,'utf8');plans.push({old,next,source,body:edit(source)});}
plan('work/qq-bridge-local/lib/host-v4.js','work/qq-bridge-local/lib/host-v5.js',s=>{
 s=imports+s;s=replaceOnce(s,'async function 发一个(base, action, 体) {','async function 发一个(base, action, 体) {\n    if(!fishEnabled())return {action,ok:false,blocked:true};');
 s=replaceOnce(s,"async function 转入一条(文字, 图们, 消息id, 会话id, 方向 = '私聊') {","async function 转入一条(文字, 图们, 消息id, 会话id, 方向 = '私聊') {\n    if(!fishEnabled())return {ok:false,说:'大肥鱼已停止'};");
 s=replaceOnce(s,'if (!配置.总开关 || (!配置.私聊会话 && !配置.群会话)) {','if (!fishEnabled() || !配置.总开关 || (!配置.私聊会话 && !配置.群会话)) {');
 s=replaceOnce(s,'if ((条.time || 0) < 上次私聊时间) continue','if ((条.time || 0)*1000 < (fishPolicy().enabledSince||0) || (条.time || 0) < 上次私聊时间) continue');
 return s;
});
plan('work/maintenance/bili-dialogue-v2.mjs','work/maintenance/bili-dialogue-v3.mjs',s=>{
 s=imports+s;
 s=replaceOnce(s,'if(busy||disposed)return;busy=true;',"if(busy||disposed)return;\n   if(!fishEnabled()){if(state.active)state.seen[state.active.item.key]={status:'cancelled'};state.queue=[];delete state.active;channel.locked=false;channel.requestId=null;save();return;}\n   state.queue=state.queue.filter(x=>x.ts*1000 >= (fishPolicy().enabledSince||0));\n   busy=true;");
 s=replaceOnce(s,'if(canAccept(x,result.since,state.seen)&&', 'if(x.ts*1000 >= (fishPolicy().enabledSince||0)&&canAccept(x,result.since,state.seen)&&');
 return s;
});
plan('work/maintenance/companion-bili-autonomy-v3.mjs','work/maintenance/companion-bili-autonomy-v4.mjs',s=>{
 s=imports+s;s=replaceOnce(s,'if(ticking)return;ticking=true;','if(ticking||!fishEnabled())return;ticking=true;');
 s=replaceOnce(s,"if(exec.agent?.session.id!==sid||!p.enabled||!a||publishing)","if(!fishEnabled()||exec.agent?.session.id!==sid||!p.enabled||!a||publishing)");return s;
});
plan('work/maintenance/companion-tool-policy-v2.mjs','work/maintenance/companion-tool-policy-v3.mjs',s=>s.replace("'companion_bili_share'","'companion_bili_share','companion_bili_mention'"));
const pythonGate=`\nsys.path.insert(0,'${here.replaceAll('\\','/')}/runtime')\nfrom comment_visibility import public_visibility\ndef fish_enabled():\n    try:return json.loads((Path('${home.replaceAll('\\','/')}')/'fish-control.json').read_text(encoding='utf8')).get('enabled') is True\n    except:return False\n`;
plan('work/maintenance/bili-dialogue-transport.py','work/maintenance/bili-dialogue-transport.py',s=>{
 s=replaceOnce(s,'async def main(req):',pythonGate+"\nasync def main(req):\n    if not fish_enabled():return {'ok':False,'blocked':'fish_stopped','items':[]}");
 s=replaceOnce(s,"item.update(status='sending',", "if not fish_enabled():return {'ok':False,'blocked':'fish_stopped'}\n        item.update(status='sending',");
 s=replaceOnce(s,"if hit:item['renderedEmotes']", "item['publicVisible']=await public_visibility(item['aid'],item['root'],receipt)\n            if hit:item['renderedEmotes']");return s;
});
plan('work/maintenance/bili-public-share.py','work/maintenance/bili-public-share.py',s=>{
 s=replaceOnce(s,'async def main(req):',pythonGate+"\nasync def main(req):\n    if not fish_enabled():return {'ok':False,'blocked':'fish_stopped'}");
 s=replaceOnce(s,"row={'state':'sending'", "if not fish_enabled():return {'ok':False,'blocked':'fish_stopped'}\n    row={'state':'sending'");return s;
});
let nextProfile=oldProfile;
for(const [oldId,newId,oldFile,newFile] of [
 ['companion-qq-reliable-v4','companion-qq-reliable-v5','host-v4.js','host-v5.js'],
 ['companion-bili-dialogue-v2','companion-bili-dialogue-v3','bili-dialogue-v2.mjs','bili-dialogue-v3.mjs'],
 ['companion-bili-autonomy-v3','companion-bili-autonomy-v4','companion-bili-autonomy-v3.mjs','companion-bili-autonomy-v4.mjs'],
 ['companion-tool-policy-v2','companion-tool-policy-v3','companion-tool-policy-v2.mjs','companion-tool-policy-v3.mjs']
]){nextProfile=replaceOnce(nextProfile,'- id: '+oldId,'- id: '+newId);nextProfile=replaceOnce(nextProfile,oldFile,newFile);}
nextProfile+=`\n- insert:\n    - id: ${marker}\n      name: ${pathToFileURL(join(here,'runtime/plugin.mjs')).href}?v=3\n- insert:\n    - id: fish-owner-mention-v1\n      name: ${pathToFileURL(join(here,'runtime/manual-mention.mjs')).href}\n`;
// All expected anchors were checked before making runtime changes.
copyFileSync(profile,join(backup,'cordis.patch.yml'));
const manifest=[];
for(const [i,p]of plans.entries()){copyFileSync(p.old,join(backup,`${i}-${p.old.split(/[\\/]/).pop()}`));manifest.push({source:p.old,destination:p.next,sha256:createHash('sha256').update(p.source).digest('hex')});}
atomic(join(backup,'manifest.json'),manifest);
if(!existsSync(policyFile)){
 const qq=readJson(join(home,'qq-bridge-config.json'),{}),bp=readJson(join(home,'companion-bili-policy.json'),{});
 if(!qq.私聊QQ||!bp.targetUid)throw Error('Owner bindings missing');
 atomic(policyFile,{version:1,revision:1,enabled:true,open:false,enabledSince:0,publicSince:Date.now(),ownerQQ:String(qq.私聊QQ),ownerBili:bp.targetUid});
}
for(const p of plans)writeFileSync(p.next,p.body,'utf8');
writeFileSync(profile,nextProfile,'utf8');
console.log('Installed incremental adapters. Private backup: '+backup);
