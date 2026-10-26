import {join} from 'node:path';
import {home,policy,atomic,readJson} from './policy.mjs';
import {createPublicChat} from './public-chat.mjs?v=4';
export const name='fish-control';export const inject=['llm','agents'];
export function apply(ctx){
 const social=createPublicChat(ctx);let previous=policy();
 ctx.on('llm/stream',(options,next)=>(async function*(){
  if(!policy().enabled)throw Error('大肥鱼已在控制台停止');
  for await(const c of next()){if(!policy().enabled)throw Error('大肥鱼已停止');yield c;}
 })());
 const tick=()=>{const p=policy();if(!p.enabled){const sid=readJson(join(home,'../companion-session.json'),{}).sessionId;const a=sid&&ctx.agents.get(sid);if(a&&a.status!=='idle')a.cancel({kind:'hook',reason:'Fish stopped in control panel'},{keepInbox:false});}
  if(!p.enabled||!p.open||p.publicSince!==previous.publicSince)social.stop();previous=p;
  atomic(join(home,'fish-control-runtime.json'),{at:Date.now(),revision:p.revision,enabled:p.enabled,open:p.open,public:social.health});void social.tick().catch(()=>{});
 };
 const timer=setInterval(()=>{try{tick();}catch{}},1000);ctx.effect(()=>()=>{clearInterval(timer);social.dispose();});tick();
}
