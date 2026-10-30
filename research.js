/* Research ranking, not an automated betting system. All inputs are user verified. */
const SPECIALTY_MARKETS={
'Playmaker':['assists','points'],'Scorer':['points','assists'],'Three-point shooter':['threes','points'],
'Rebounder':['rebounds','points'],'Rim protector':['blocks','rebounds'],
'Defensive wing':['blocks','rebounds'],'Versatile contributor':['points','rebounds','assists']
};
const METRIC_LABELS={points:'Points',rebounds:'Rebounds',assists:'Assists',threes:'3-pointers',blocks:'Blocks'};
function roleMarkets(p){return SPECIALTY_MARKETS[p.specialty]||[]}
function makeResearchCard(p,f){
 const v=f.values,preferred=roleMarkets(p),available=preferred.filter(k=>Number.isFinite(v[k]));
 if(!available.length)return null;
 const m=available[0];
 return {player:p,forecast:f,market:m,minutes:v.minutes,priority:available.length,complete:!!(f.evidence&&f.source&&f.sourceTime),retrospective:f.retrospective};
}
function renderResearch(){
 const node=document.getElementById('researchBoard');if(!node)return;
 const date=val('gameDate'),match=val('matchup').trim().toUpperCase();
 let filtered=db.forecasts.filter(f=>f.gameDate===date&&(!match||f.matchup.toUpperCase()===match));
 const byTeam={};
 for(const f of filtered){
  const p=db.players.find(p=>p.id===f.playerId);
  if(!p||!Number.isFinite(f.values.minutes))continue;
  const c=makeResearchCard(p,f);if(!c)continue;
  (byTeam[p.team]??=[]).push(c);
 }
 const teams=Object.keys(byTeam).sort();
 if(!teams.length){node.innerHTML='<p class="muted">No eligible player research cards yet. Add players and evidence-backed projections for the selected date and matchup. This is not a live NBA feed.</p>';return}
 node.innerHTML=teams.map(team=>{
  const cards=byTeam[team].sort((a,b)=>Number(b.complete)-Number(a.complete)||b.minutes-a.minutes||a.player.name.localeCompare(b.player.name)).slice(0,2);
  return '<h3>'+safe(team)+' — up to two players</h3><div class="grid">'+cards.map(c=>{
    const v=c.forecast.values, market=c.market;
    return '<article style="border:1px solid #d9e4ee;border-radius:9px;padding:14px"><strong>'+safe(c.player.name)+'</strong><p>'+safe(c.player.position)+' · '+safe(c.player.specialty)+' · '+safe(c.player.status)+'</p><p><strong>Role-aligned research focus: '+METRIC_LABELS[market]+'</strong></p><p>Projection: '+v[market]+' · Expected minutes: '+v.minutes+'</p><p class="small">Shot attempts '+v.fga+' · Rebound chances '+v.chances+' · Potential assists '+v.potential+'</p><p class="small"><strong>Evidence:</strong> '+safe(c.forecast.evidence)+'</p><p class="small"><strong>Source:</strong> '+safe(c.forecast.source)+' · '+safe(c.forecast.sourceTime)+'</p><p class="small">'+(c.retrospective?'RETROSPECTIVE — NOT A PREGAME PICK':'Research only — no verified sportsbook line or edge')+'</p></article>'
  }).join('')+'</div>'
 }).join('');
}
