"""Do not equate an authenticated receipt with public visibility."""
import aiohttp
async def public_visibility(aid,root,rpid):
    try:
        async with aiohttp.ClientSession(headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'},timeout=aiohttp.ClientTimeout(total=15)) as client:
            for pn in range(1,4):
                async with client.get('https://api.bilibili.com/x/v2/reply/reply',params={'type':1,'oid':aid,'root':root,'pn':pn,'ps':20}) as resp:
                    j=await resp.json()
                if j.get('code')!=0:return None
                data=j.get('data',{});rows=([data['root']] if data.get('root') else [])+(data.get('replies') or [])
                if any(str(x.get('rpid'))==str(rpid) for x in rows):return True
                if pn*20>=int(data.get('page',{}).get('count',0)):return False
            return None
    except:return None
