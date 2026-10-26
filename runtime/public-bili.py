"""Public-only Bilibili adapter; credentials and inbox stay in the existing local home."""
import asyncio,json,sys,time,os,re
from pathlib import Path
ROOT=Path(os.environ.get('FISH_ROOT','D:/DeepSeekCompanion'))
HOME=ROOT/'data/dsh'
sys.path.insert(0,str(HOME/'bili-duty'))
import mcp_server as m
from bilibili_api import session,comment
from bilibili_api.utils.network import Api
from comment_visibility import public_visibility
FILE=HOME/'fish-public-bili.json'
def policy():
    try:return json.loads((HOME/'fish-control.json').read_text(encoding='utf8'))
    except:return {}
def allowed(p):return p.get('enabled') is True and p.get('open') is True
def save(s):
    temp=FILE.with_suffix('.tmp');temp.write_text(json.dumps(s,ensure_ascii=False),encoding='utf8');os.replace(temp,FILE)
async def find(cred,item):
    for pn in range(1,4):
        d=await Api(**comment.API['comment']['sub_reply'],credential=cred).update_params(type=1,oid=int(item['aid']),root=int(item.get('root') or item['rpid']),pn=pn,ps=20).result
        for row in ([d['root']] if d.get('root') else [])+(d.get('replies') or []):
            if str(row.get('rpid'))==str(item['rpid']):return row
    return None
async def main(req):
    p=policy()
    if not allowed(p):return {'ok':False,'blocked':'closed','items':[]}
    cred=m.get_cred();me=int(cred.dedeuserid);owner=int(p['ownerBili']);since=p['publicSince']/1000
    s=json.loads(FILE.read_text(encoding='utf8')) if FILE.exists() else {'items':{}}
    if req.get('mode')=='poll':
        candidates=[];errors=[]
        try:
            sessions=await session.get_sessions(credential=cred,session_type=1)
            for peer in sessions.get('session_list',[]) or []:
                uid=int(peer.get('talker_id') or 0)
                if uid in [0,owner,me] or int(peer.get('session_type',1))!=1:continue
                data=m._dm_get('https://api.vc.bilibili.com/svr_sync/v1/svr_sync/fetch_session_msgs?talker_id='+str(uid)+'&session_type=1&size=30&build=0&mobi_app=web')
                if data.get('code')!=0:errors.append('dm_api');continue
                for x in data.get('data',{}).get('messages',[]) or []:
                    if int(x.get('sender_uid',0))!=uid:continue
                    c=json.loads(x.get('content') or '{}');text=c.get('content') or c.get('text') or c.get('title')
                    if isinstance(text,str) and text:candidates.append({'key':'dm:'+str(uid)+':'+str(x.get('msg_key') or x.get('msg_seqno')),'kind':'dm','owner':uid,'ts':int(x.get('timestamp',0)),'text':text[:3000]})
        except Exception as e:errors.append('dm:'+type(e).__name__)
        for kind,fn in [('at',session.get_at),('reply',session.get_replies)]:
            try:
                for x in m._norm_feed(kind,await fn(credential=cred)):
                    uid=int(x.get('mid') or 0)
                    if uid in [0,owner,me] or x.get('business_id')!=1 or not x.get('rpid'):continue
                    x.update(key='comment:'+str(x['rpid']),kind='comment',owner=uid,ts=int(x.get('at') or 0),text=str(x.get('content') or '')[:3000]);candidates.append(x)
            except Exception as e:errors.append(kind+':'+type(e).__name__)
        for x in sorted(candidates,key=lambda x:x['ts']):
            if x['ts']<since or x['key'] in s['items']:continue
            if x['kind']=='comment':
                try:
                    row=await find(cred,x)
                    if not row or int(row.get('mid') or row.get('member',{}).get('mid') or 0)!=x['owner']:continue
                    x['root']=int(row.get('root') or x['rpid']);x['text']=str(row.get('content',{}).get('message') or x['text'])[:3000]
                except Exception as e:errors.append('verify:'+type(e).__name__);continue
            x['status']='new';s['items'][x['key']]=x
        save(s);return {'ok':True,'errors':errors,'items':[x for x in s['items'].values() if x['status']=='new' and x['ts']>=since]}
    item=s['items'].get(req.get('key'))
    if not item or item['owner'] in [owner,me] or item['ts']<since:return {'ok':False,'blocked':'invalid_source'}
    if item['status']!='new':return {'ok':False,'blocked':'already_attempted'}
    text=str(req.get('text') or '').replace('[[sticker:hehe]]','[偷笑]').strip()
    if not text or len(text)>480 or re.search(r'(?i)(sessdata|bili_jct|api[_ -]?key|sk-[a-z0-9]{10}|[a-z]:[\\/])',text):return {'ok':False,'blocked':'invalid_text'}
    if item['kind']=='comment':
        row=await find(cred,item)
        if not row or int(row.get('mid') or row.get('member',{}).get('mid') or 0)!=item['owner']:return {'ok':False,'blocked':'parent_mismatch'}
    if not allowed(policy()) or policy().get('publicSince')!=p.get('publicSince'):return {'ok':False,'blocked':'closed'}
    item['status']='sending';save(s)
    try:
        if item['kind']=='dm':r=await session.send_msg(credential=cred,receiver_id=item['owner'],msg_type=session.EventType.TEXT,content=text);receipt=r.get('msg_key') or r.get('msg_seqno')
        else:r=await comment.send_comment(text=text,oid=int(item['aid']),type_=comment.CommentResourceType.VIDEO,root=int(item['root']),parent=int(item['rpid']),credential=cred);receipt=r.get('rpid_str') or r.get('rpid')
        item['status']='sent' if receipt else 'uncertain';item['receipt']=str(receipt) if receipt else None;save(s)
        if receipt and item['kind']=='comment':item['publicVisible']=await public_visibility(item['aid'],item['root'],receipt);save(s)
        return {'ok':bool(receipt),'receipt':item['receipt'],'publicVisible':item.get('publicVisible')}
    except Exception as e:item['status']='uncertain';save(s);return {'ok':False,'uncertain':True,'error':type(e).__name__}
if __name__=='__main__':
    try:print(json.dumps(asyncio.run(main(json.loads(sys.stdin.read()))),ensure_ascii=False))
    except Exception as e:print(json.dumps({'ok':False,'error':type(e).__name__}))
