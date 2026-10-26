import asyncio,json,sys,time,os,re
from pathlib import Path
ROOT=Path(os.environ.get('FISH_ROOT','D:/DeepSeekCompanion'));HOME=ROOT/'data/dsh'
sys.path.insert(0,str(HOME/'bili-duty'))
import mcp_server as m
from bilibili_api import video,user,comment
from bilibili_api.utils.network import Api
import aiohttp
FILE=HOME/'fish-manual-mention.json'
def save(s):
    t=FILE.with_suffix('.tmp');t.write_text(json.dumps(s,ensure_ascii=False),encoding='utf8');os.replace(t,FILE)
async def main(req):
    p=json.loads((HOME/'fish-control.json').read_text(encoding='utf8'))
    if not p.get('enabled') or time.time()>=1793462400:return {'ok':False,'blocked':'stopped_or_budget_cutoff'}
    bv=str(req.get('bvid',''));task=str(req.get('taskId',''))
    if not re.fullmatch(r'BV[A-Za-z0-9]{10}',bv) or not task:return {'ok':False,'blocked':'invalid_request'}
    s=json.loads(FILE.read_text(encoding='utf8')) if FILE.exists() else {}
    if task in s:return {'ok':False,'duplicate':True,**s[task]}
    cred=m.get_cred();uid=int(p['ownerBili']);target=await user.User(uid=uid,credential=cred).get_user_info();v=await video.Video(bvid=bv,credential=cred).get_info()
    name=target['name'];title=re.sub(r'https?://\S+|@[\w\u4e00-\u9fff]+|[\r\n]','',str(v['title'])).strip()[:36]
    text=f'@{name} 来啦，一起看看《{title}》 [偷笑]'
    if not json.loads((HOME/'fish-control.json').read_text(encoding='utf8')).get('enabled'):return {'ok':False,'blocked':'stopped'}
    s[task]={'state':'sending','bvid':bv,'at':time.time()};save(s)
    try:
        result=await Api(**comment.API['comment']['send'],credential=cred).update_data(oid=v['aid'],type=1,message=text,plat=1,at_name_to_mid=json.dumps({name:uid},ensure_ascii=False)).result
        rid=result.get('rpid_str') or result.get('rpid') or (result.get('reply') or {}).get('rpid');s[task].update(state='sent' if rid else 'uncertain',receipt=str(rid) if rid else None,publicVisible=None);save(s)
        if rid:
            async with aiohttp.ClientSession(headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'}) as client:
                async with client.get('https://api.bilibili.com/x/v2/reply/reply',params={'oid':v['aid'],'type':1,'root':rid,'pn':1,'ps':20}) as resp:
                    j=await resp.json();r=j.get('data',{}).get('root') or {};s[task]['publicVisible']=str(r.get('rpid'))==str(rid) if j.get('code')==0 else None;save(s)
        return {'ok':bool(rid),**s[task],'url':f'https://www.bilibili.com/video/{bv}/#reply{rid}','note':'平台已接收不等于他人可见，公开可见未确认时不要重复发布'}
    except Exception as e:s[task]['state']='uncertain';save(s);return {'ok':False,'uncertain':True,'error':type(e).__name__}
if __name__=='__main__':
    try:print(json.dumps(asyncio.run(main(json.loads(sys.stdin.read()))),ensure_ascii=False))
    except Exception as e:print(json.dumps({'ok':False,'error':type(e).__name__}))
