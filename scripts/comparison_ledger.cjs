/* Server-clock receipts are append-only; final results are separate files. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),cp=require('node:child_process');
const C=require('../comparison-core.js');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'data/comparison'),now=new Date().toISOString();
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const write=(f,x)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(x));};
function append(folder,obj){const body=JSON.stringify(obj),id=crypto.createHash('sha256').update(body).digest('hex');const file=path.join(dir,folder,id+'.json');if(!fs.existsSync(file))write(file,obj);return id;}
function files(folder){const d=path.join(dir,folder);return fs.existsSync(d)?fs.readdirSync(d).filter(f=>f.endsWith('.json')).sort().map(f=>({id:f.slice(0,-5),...read(path.join(d,f))})):[];}
function csv(rows){const headers=['player_id','team','date','game_id','category','projection'];return headers.join(',')+'\n'+rows.map(r=>[r.player_id,r.team,r.date,r.game_id,r.category,r.value].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n');}
function loadGames(){return fs.readdirSync(dir).filter(f=>/^20.*\.json$/.test(f)).flatMap(f=>read(path.join(dir,f)).games);}
function ingest(payload,games){
 const imports=payload.imports||[];if(!Array.isArray(imports)||imports.length>20000)throw Error('Invalid import payload');
 const grouped=new Map();for(const r of imports){const k=[r.engine,r.source,r.as_of].join('|');if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(r);}
 const checked=[];for(const rows of grouped.values()){const r=rows[0];checked.push(...C.importRows(csv(rows),{engine:r.engine,source:r.source,as_of:r.as_of,scope:'game'},games,now));}
 const quotes=(payload.quotes||[]).map(q=>{
  const [r]=C.importRows(csv([{...q,value:1}]),{engine:'SportsLine',source:q.source,as_of:q.as_of,scope:'game'},games,now);
  if(!C.finite(q.line)||q.line<0||!q.book||q.verified!==true||(!C.decimal(q.over_odds)&&!C.decimal(q.under_odds)))throw Error('Invalid verified quote');
  return {game_id:r.game_id,player_id:r.player_id,team:r.team,date:r.date,category:r.category,line:q.line,over_odds:q.over_odds,under_odds:q.under_odds,book:q.book,source:q.source,as_of:q.as_of,verified:true,verification:'Operator-attested import; not a live feed',captured_at:now};
 });
 return {checked,quotes};
}
function collectResults(games,receipts){const results=[];for(const id of new Set(receipts.flatMap(r=>r.rows.map(x=>x.game_id)))){
 const g=games.find(g=>String(g.id)===id);if(g&&!g.completed)continue;
 const url='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event='+encodeURIComponent(id);
 try{const raw=cp.execFileSync('curl',['-fLsS','--max-time','12',url],{encoding:'utf8',stdio:['ignore','pipe','pipe']});const s=JSON.parse(raw);if(!s.header?.competitions?.[0]?.status?.type?.completed)continue;
 const state=s.header.competitions[0].status.type.name;if(/postpon|cancel/i.test(state))continue;
 for(const t of s.boxscore?.players||[])for(const block of t.statistics||[])for(const p of block.athletes||[]){
 const v=Object.fromEntries(block.labels.map((k,i)=>[k,p.stats?.[i]]));const value=k=>C.number(v[k]);const basic={points:value('PTS'),rebounds:value('REB'),assists:value('AST'),minutes:value('MIN'),threes:typeof v['3PT']==='string'?C.number(v['3PT'].split('-')[0]):null};basic.PRA=['points','rebounds','assists'].every(k=>C.finite(basic[k]))?basic.points+basic.rebounds+basic.assists:null;
 for(const category of C.categories)results.push({game_id:id,player_id:String(p.athlete.id),team:t.team.abbreviation,category,value:basic[category],dnp:!!p.didNotPlay,completed:true,source:{url,fetched_at:now,sha256:crypto.createHash('sha256').update(raw).digest('hex')}});
 }}catch(e){console.error('Result unavailable for '+id+': '+e.message.split('\n')[0]);}
 }return results;}
function propGrade(p,a){if(!a||a.dnp)return {outcome:a?.dnp?'void':'pending',profit:null};if(a.value===p.line)return {outcome:'push',profit:0};const win=p.direction==='over'?a.value>p.line:a.value<p.line;return {outcome:win?'win':'loss',profit:win?C.decimal(p.odds)-1:-1};}
function main(){
 const games=loadGames();let imported={checked:[],quotes:[]};if(process.env.COMPARISON_IMPORT_JSON){imported=ingest(JSON.parse(process.env.COMPARISON_IMPORT_JSON),games);if(imported.checked.length||imported.quotes.length)append('imports',{captured_at:now,rows:imported.checked,quotes:imported.quotes});}
 const allImports=files('imports');const external=allImports.flatMap(x=>x.rows),quotes=allImports.flatMap(x=>x.quotes);
 const receipts=files('receipts');
 for(const g of games){if(Date.parse(g.tip)<=Date.parse(now)||g.state!=='pre'||/postpon|cancel|delay/i.test(g.status||''))continue;
 if(!C.stamp(g.as_of)&&!external.some(r=>r.game_id===String(g.id)&&r.prospective))continue;
 const rows=g.teams.flatMap(t=>t.players.flatMap(p=>C.categories.filter(c=>C.finite(C.projection(p,c))).map(category=>({engine:'DOC',game_id:String(g.id),date:g.date,player_id:String(p.id),player:p.name,team:t.abbr,category,value:C.projection(p,category),as_of:g.as_of,source:'DOC '+g.model_version,prospective:Date.parse(g.as_of)<Date.parse(g.tip)}))));
 const erows=external.filter(r=>r.game_id===String(g.id)&&r.prospective);const qs=quotes.filter(q=>q.game_id===String(g.id));const picks=g.teams.flatMap(t=>C.topTwo(g,t,qs,Date.parse(now)).picks.map(p=>({game_id:String(g.id),team:t.abbr,player_id:String(p.player.id),category:p.category,direction:p.direction,line:p.line,odds:p.odds,probability:p.probability,edge:p.edge,ev:p.ev,quote:p.quote,simulation:p.simulation})));
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify({rows:[...rows,...erows],qs,picks})).digest('hex');if(receipts.some(r=>r.fingerprint===fingerprint))continue;
 append('receipts',{schema:1,game_id:String(g.id),date:g.date,tip:g.tip,captured_at:now,fingerprint,rows:[...rows,...erows],quotes:qs,picks});
 }
 const saved=files('receipts');const actuals=collectResults(games,saved);
 // One latest eligible server capture per engine/player/category. Never choose by result.
 const primary=new Map();for(const s of saved.sort((a,b)=>Date.parse(a.captured_at)-Date.parse(b.captured_at))){if(Date.parse(s.captured_at)>=Date.parse(s.tip))continue;for(const r of s.rows){if(!r.prospective)continue;primary.set([r.engine,r.game_id,r.team,r.player_id,r.category].join('|'),r);}}
 const grades=C.grade([...primary.values()],actuals);const latestGames=new Map();for(const s of saved.sort((a,b)=>Date.parse(a.captured_at)-Date.parse(b.captured_at))){if(Date.parse(s.captured_at)<Date.parse(s.tip))latestGames.set(s.game_id,s);}const selections=new Map();for(const s of latestGames.values())for(const p of s.picks)selections.set([p.game_id,p.team,p.player_id,p.category].join('|'),{...p,captured_at:s.captured_at});
 const props=[...selections.values()].map(p=>({...p,...propGrade(p,actuals.find(a=>a.game_id===p.game_id&&a.player_id===p.player_id&&C.team(a.team)===C.team(p.team)&&a.category===p.category))}));const settled=props.filter(p=>['win','loss','push'].includes(p.outcome));const profit=settled.reduce((s,p)=>s+p.profit,0);
 write(path.join(dir,'grades.json'),{updated_at:now,metrics:grades,props,record:{wins:props.filter(p=>p.outcome==='win').length,losses:props.filter(p=>p.outcome==='loss').length,pushes:props.filter(p=>p.outcome==='push').length,voids:props.filter(p=>p.outcome==='void').length,profit_units:profit,roi:settled.length?profit/settled.length:null},receipt_count:saved.length});
 write(path.join(dir,'results.json'),{updated_at:now,actuals});
 for(const file of fs.readdirSync(dir).filter(f=>/^20.*\.json$/.test(f))){const slate=read(path.join(dir,file));slate.external=external.filter(r=>r.date===slate.date);slate.quotes=quotes.filter(r=>r.date===slate.date);write(path.join(dir,file),slate);}
 console.log(JSON.stringify({imports:imported.checked.length,receipts:saved.length,graded:grades.length}));
}
if(require.main===module)main();module.exports={ingest,propGrade};
