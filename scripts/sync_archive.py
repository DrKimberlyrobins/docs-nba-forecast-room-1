import base64,gzip,json,pathlib,subprocess,datetime
from zoneinfo import ZoneInfo
origin="https://docs-nba-forecast-room.dr-kimberlyrobins.chatgpt.site"
def get(path):
 return subprocess.check_output(["curl","--fail","--silent","--show-error","--retry","3",origin+path])
def save(path,raw):
 p=pathlib.Path(path);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(base64.b64encode(gzip.compress(raw)).decode())
day=datetime.datetime.now(ZoneInfo("America/Chicago")).date().isoformat()
raw=get("/api/room?date="+day);room=json.loads(raw)
for date in room["dates"]:
 data=raw if date==day else get("/api/room?date="+date)
 save("data/"+date+".txt",data)
 record=json.loads(data)
 for version in record["all_versions"]:
  from urllib.parse import quote
  key=quote(version["key"],safe="")
  path="data/snapshots/"+key+".txt"
  if not pathlib.Path(path).exists():save(path,get("/api/snapshot?key="+key))
save("data/latest.txt",raw)
