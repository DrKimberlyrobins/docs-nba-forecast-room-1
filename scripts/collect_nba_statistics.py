"""Official NBA per-game statistics. A failed endpoint produces no substitute."""
import sys, pathlib, json, concurrent.futures, urllib.parse, unicodedata, re
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from build_comparison import fetch, save, OUT, NOW
from datetime import datetime
from zoneinfo import ZoneInfo
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
def team(s):return {'NYK':'NY','GSW':'GS','NOP':'NO','SAS':'SA','UTA':'UTAH','PHO':'PHX','BRK':'BKN'}.get(s,s)
def get_stats(job):
 window,kind=job;today=datetime.now(ZoneInfo('America/Chicago'));y=today.year if today.month>=10 else today.year-1
 params=dict(LeagueID='00',Season=f'{y}-{str(y+1)[2:]}',SeasonType='Regular Season',PerMode='PerGame',LastNGames=window,MeasureType='Base',Month=0,OpponentTeamID=0,PaceAdjust='N',PlusMinus='N',Rank='N',Period=0,TeamID=0,DateFrom='',DateTo='',Outcome='',Location='',SeasonSegment='',VsConference='',VsDivision='',GameSegment='',PlayerExperience='',PlayerPosition='',StarterBench='',Conference='',Division='',Weight=0,College='',Country='',DraftYear='',DraftPick='',Height='')
 endpoint='leaguedashplayerstats'
 if kind=='advanced':params['MeasureType']='Advanced'
 elif kind!='base':
  endpoint='leaguedashptstats';params.update(PlayerOrTeam='Player',PtMeasureType=kind)
 url='https://stats.nba.com/stats/'+endpoint+'?'+urllib.parse.urlencode(params)
 try:
  data,src=fetch(url);rs=data.get('resultSets',[]);rs=[rs] if isinstance(rs,dict) else rs
  rows=[dict(zip(r['headers'],v)) for r in rs for v in r.get('rowSet',[])]
  return {'window':window,'kind':kind,'rows':rows,'source':src}
 except Exception as e:return {'window':window,'kind':kind,'rows':[],'error':type(e).__name__+': official NBA endpoint unavailable'}
def main():
 jobs=[(w,k) for w in [5,10,0] for k in ['base','advanced','Possessions','Rebounding','Passing']]
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:datasets=list(pool.map(get_stats,jobs))
 for path in OUT.glob('20*.json'):
  slate=json.loads(path.read_text());stats=[]
  for g in slate['games']:
   for t in g['teams']:
    for p in t['players']:
     entry={'game_id':g['id'],'player_id':p['id'],'team':t['abbr'],'windows':{}}
     for d in datasets:
      matches=[r for r in d['rows'] if norm(r.get('PLAYER_NAME',''))==norm(p['name']) and team(r.get('TEAM_ABBREVIATION',''))==team(t['abbr'])]
      if len(matches)==1:entry['windows'].setdefault(str(d['window']),{})[d['kind']]={'values':matches[0],'source':d['source'],'nba_player_id':matches[0].get('PLAYER_ID')}
     if entry['windows']:stats.append(entry)
  slate['statistics']=stats;slate['statistics_errors']=[{k:v for k,v in d.items() if k!='rows'} for d in datasets if d.get('error')];save(path,slate)
 print(json.dumps({'official_endpoints':len(datasets),'successful':sum(bool(d['rows']) for d in datasets),'errors':[d['error'] for d in datasets if 'error'in d]}))
if __name__=='__main__':main()
