import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const fixture=mkdtempSync(join(tmpdir(),'fish-control-test-'));process.env.DSH_HOME=fixture;process.env.FISH_ROOT=fixture;
const {policy,policyFile,atomic,accepts,fresh}=await import('../runtime/policy.mjs');
const {createPublicChat,contextKey,buildMessages}=await import('../runtime/public-chat.mjs');
const {messageSegments}=await import('../runtime/public-chat.mjs');
const {budgetStatus,cutoff}=await import('../runtime/budget-status.mjs');
test('budget status matches existing reservation and cutoff without changing ledger',()=>{const b={estimatedCny:38.89,limitCny:40,unsettled:{}};assert.equal(budgetStatus(b,cutoff-1000).blocked,true);assert.equal(budgetStatus({...b,estimatedCny:1},cutoff).blocked,true);assert.equal(b.estimatedCny,38.89);});
test('QQ null and CQ-string messages normalize without breaking intake',()=>{assert.deepEqual(messageSegments(null),[]);assert.equal(messageSegments('[CQ:at,qq=9]hello')[1].data.qq,'9');assert.equal(messageSegments([null,{type:'text',data:{text:'hi'}}]).length,1);});
test('closed/owner-only/open authorization matrix and fail closed',()=>{
 assert.equal(policy().enabled,false);
 for(const enabled of [false,true])for(const open of [false,true]){
  assert.equal(accepts({enabled,open},'1','1'),enabled);assert.equal(accepts({enabled,open},'2','1'),enabled&&open);
 }
 assert.equal(fresh({publicSince:20000},19,true),false);assert.equal(fresh({publicSince:20000},20,true),true);
});
test('public contexts separate by platform, peer and thread',()=>{
 const a={platform:'qq',kind:'dm',peer:'2',thread:''};assert.notEqual(contextKey(a),contextKey({...a,peer:'3'}));assert.notEqual(contextKey(a),contextKey({...a,platform:'bili'}));
 assert.equal(buildMessages([], 'hello').length,1);
 const historical=buildMessages([{role:'assistant',content:[{type:'text',text:'hi'}]}],'again');assert.equal(historical[0].source.kind,'model');assert.equal(historical[0].source.provider,'deepseek-official');
});
test('open routes to actual sender; owner excluded; no owner history; switch closes before send; no replay',async()=>{
 const now=Math.floor(Date.now()/1000);const base={enabled:true,open:true,ownerQQ:'1',publicSince:(now-1)*1000,revision:1};atomic(policyFile,base);
 const sends=[],prompts=[];let close=false;
 const ctx={llm:{async *stream(options){prompts.push(options);if(close)atomic(policyFile,{...base,open:false});yield {type:'text-delta',text:'你好呀'};yield {type:'finish',reason:{kind:'stop'}};}}};
 let message=1;
 const adapters={bili:async()=>({ok:true,items:[]}),nap:async(action,body)=>{
  if(action==='get_login_info')return {user_id:9};if(action==='get_friend_list')return [{user_id:1},{user_id:2},{user_id:3}];if(action==='get_group_list')return [];
  if(action==='get_friend_msg_history')return {messages:[{user_id:body.user_id,time:now,message_id:message+body.user_id,message:[{type:'text',data:{text:'hello '+body.user_id}}]}]};
  if(action==='send_private_msg'){sends.push(body);return {message_id:100+sends.length};}throw Error(action);
 }};
 let publicChat=createPublicChat(ctx,adapters);await publicChat.tick();publicChat.dispose();
 assert.deepEqual(sends.map(x=>x.user_id),[2,3]);assert.equal(prompts[0].messages.length,1);assert.equal(prompts[1].messages.length,1);assert.deepEqual(prompts[0].tools,[]);
 publicChat=createPublicChat(ctx,adapters);await publicChat.tick();publicChat.dispose();assert.equal(sends.length,2);
 message=20;close=true;publicChat=createPublicChat(ctx,adapters);await publicChat.tick();publicChat.dispose();assert.equal(sends.length,2);
 const calls=prompts.length;publicChat=createPublicChat(ctx,adapters);await publicChat.tick();publicChat.dispose();assert.equal(prompts.length,calls);
 atomic(policyFile,{...base,enabled:false});publicChat=createPublicChat(ctx,adapters);await publicChat.tick();publicChat.dispose();assert.equal(prompts.length,calls);
});
