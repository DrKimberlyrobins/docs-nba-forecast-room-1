"""Read-only collectors; original DOC archives and model inputs are never changed.
ESPN IDs are canonical for this repository. NBA IDs are linked only on exact
normalized full name AND team. A mismatch is missing data, never a fuzzy match.
"""
import base64, gzip, json, pathlib, datetime, subprocess, concurrent.futures, unicodedata, re, hashlib
from zoneinfo import ZoneInfo
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'data/comparison'
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
def fetch(url):
 raw=subprocess.check_output(['curl','-fLsS','--max-time','12','--connect-timeout','5','-H','User-Agent: Mozilla/5.0','-H','Referer: https://www.nba.com/',url],stderr=subprocess.PIPE)
 return json.loads(raw),{'url':url,'fetched_at':NOW,'sha256':hashlib.sha256(raw).hexdigest()}
def save(path,obj):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,separators=(',',':')))
def roster(t):
 try:
  r,s=fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/'+str(t['id'])+'/roster')
  ps=[{'id':str(p['id']),'name':p['displayName'],'position':p.get('position',{}).get('abbreviation'),'status':'Unconfirmed','projections':{},'evidence':[],'roster_source':s} for p in r.get('athletes',[])]
  if len({p['id'] for p in ps})!=len(ps):raise ValueError('Duplicate roster IDs')
  return t['id'],ps
 except Exception:return t['id'],[]
def main():
 OUT.mkdir(exist_ok=True,parents=True)
 today=datetime.datetime.now(ZoneInfo('America/Chicago')).date()
 dates=[(today+datetime.timedelta(days=i)).isoformat() for i in range(-1,3)]
 slates={};errors=[]
 for date in dates:
  try:
   raw,src=fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+date.replace('-',''))
   gs=[]
   for e in raw.get('events',[]):
    c=e['competitions'][0];gs.append({'id':e['id'],'date':date,'name':e['name'],'tip':e['date'],'state':e['status']['type']['state'],'status':e['status']['type'].get('name'),'completed':e['status']['type']['completed'],'source':src,'teams':[{'id':x['team']['id'],'abbr':x['team']['abbreviation'],'name':x['team']['displayName'],'home':x['homeAway']=='home'} for x in c['competitors']]})
   slates[date]=gs
  except Exception as e:errors.append(date+': schedule retrieval failed ('+type(e).__name__+')')
 teams={t['id']:t for gs in slates.values() for g in gs for t in g['teams']}
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:rosters=dict(pool.map(roster,teams.values()))
 for date,gs in slates.items():
  archived={}
  path=ROOT/('data/'+date+'.txt')
  if path.exists():
   r=json.loads(gzip.decompress(base64.b64decode(path.read_text())));archived={str(g['id']):g for g in r.get('forecasts',[])}
  for g in gs:
   f=archived.get(str(g['id']))
   for t in g['teams']:
    ft=next((x for x in (f or {}).get('teams',[]) if str(x['id'])==str(t['id'])),None)
    t['players']=ft['players'] if ft else rosters.get(t['id'],[])
    if not t['players']:errors.append(g['id']+' '+t['abbr']+': roster unavailable')
   if f:g['as_of']=f['as_of'];g['model_version']=f['model_version']
  save(OUT/(date+'.json'),{'date':date,'updated_at':NOW,'games':gs,'errors':errors,'external':[],'quotes':[],'statistics':[]})
 # Archive dates remain selectable without copying or rewriting original forecasts.
 old=sorted(p.stem for p in (ROOT/'data').glob('20*.txt'))
 save(OUT/'index.json',{'updated_at':NOW,'dates':sorted(set(old+list(slates)),reverse=True),'errors':errors})
 print(json.dumps({'dates':list(slates),'scheduled_games':sum(map(len,slates.values())),'rosters':sum(bool(v) for v in rosters.values()),'errors':errors}))
if __name__=='__main__':main()
