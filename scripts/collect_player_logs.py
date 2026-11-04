"""Current-season ESPN athlete logs: actual appearances, never game projections."""
import pathlib,json,concurrent.futures,datetime,sys,gzip,base64
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from build_comparison import fetch,save,OUT,NOW
from zoneinfo import ZoneInfo

def number(x):
 try:return float(x)
 except (ValueError,TypeError):return None
def parse(raw,src):
 out=[];seen=set()
 for season in raw.get('seasonTypes',[]):
  if 'Regular Season' not in season.get('displayName',''):continue
  for category in season.get('categories',[]):
   for e in category.get('events',[]):
    gid=str(e.get('eventId'));event=raw.get('events',{}).get(gid,{})
    if gid in seen or not event.get('gameDate'):continue
    seen.add(gid);v=dict(zip(raw.get('labels',[]),e.get('stats',[])))
    def split(key,i):
     try:return number(v[key].split('-')[i])
     except (KeyError,IndexError,AttributeError):return None
    row={'game_id':gid,'date':event['gameDate'],'opponent':event.get('opponent',{}).get('abbreviation'),'team':event.get('team',{}).get('abbreviation'),'source':src,'minutes':number(v.get('MIN')),'points':number(v.get('PTS')),'rebounds':number(v.get('REB')),'assists':number(v.get('AST')),'blocks':number(v.get('BLK')),'fga':split('FG',1),'fgm':split('FG',0),'threea':split('3PT',1),'threes':split('3PT',0),'fta':split('FT',1)}
    if row['minutes'] and row['minutes']>0:out.append(row)
 return sorted(out,key=lambda r:r['date'],reverse=True)
def one(pid):
 cache=OUT/'playerlogs'/(pid+'.json')
 if cache.exists():
  obj=json.loads(cache.read_text())
  if datetime.datetime.fromisoformat(NOW)-datetime.datetime.fromisoformat(obj['fetched_at'])<datetime.timedelta(hours=1):return pid,obj
 today=datetime.datetime.now(ZoneInfo('America/Chicago'));season=today.year+(1 if today.month>=10 else 0)
 try:
  raw,src=fetch('https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/'+pid+'/gamelog?season='+str(season))
  obj={'player_id':pid,'season':season,'fetched_at':NOW,'source':src,'evidence':parse(raw,src)};save(cache,obj);return pid,obj
 except Exception:return pid,{'error':'ESPN current-season player log unavailable'}
def main():
 paths=list(OUT.glob('20*.json'));slates=[json.loads(p.read_text()) for p in paths];ids=sorted({str(p['id']) for s in slates for g in s['games'] for t in g['teams'] for p in t['players']})
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:logs=dict(pool.map(one,ids))
 for path,slate in zip(paths,slates):
  slate.pop('player_logs',None);save(path,slate)
 (OUT/'playerlogs.txt').write_text(base64.b64encode(gzip.compress(json.dumps({'updated_at':NOW,'players':logs},separators=(',',':')).encode())).decode())
 print(json.dumps({'players':len(ids),'retrieved':sum('error' not in x for x in logs.values()),'with_regular_season_appearances':sum(bool(x.get('evidence')) for x in logs.values())}))
if __name__=='__main__':main()
