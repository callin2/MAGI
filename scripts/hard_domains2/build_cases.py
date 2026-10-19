import copy,json,random,datetime as dt
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[2];B=ROOT/'experiments/hard-domains-round2-20261019/source-B'
def allocate(a):
 skus=sorted(a['on_hand']);cap=[a['on_hand'][s] for s in skus];blocked=set()
 for h in a['holds']:
  if h['state'] in ['committed','cancelled'] or h['state']=='reserved' and h['expires_at']>a['now']:blocked.add(h['order_id'])
  if h['state']=='reserved' and h['expires_at']>a['now']:cap[skus.index(h['sku'])]-=h['quantity']
 def canon(o):return (o['value'],o['group'],tuple(sorted((c['id'],tuple(sorted(c['items'].items()))) for c in o['choices'])))
 seen={}
 for o in a['orders']:
  if o['id'] in seen and canon(seen[o['id']])!=canon(o):raise ValueError('conflict')
  seen[o['id']]=o
 orders=[o for k,o in sorted(seen.items()) if k not in blocked];groups=sorted({o['group'] for o in orders if o['group'] is not None})
 @lru_cache(None)
 def solve(i,caps,mask):
  if i==len(orders):return (0,0,(),caps)
  o=orders[i];best=solve(i+1,caps,mask);bit=0 if o['group'] is None else 1<<groups.index(o['group'])
  if not mask&bit:
   for c in o['choices']:
    nc=tuple(n-c['items'].get(s,0) for n,s in zip(caps,skus))
    if min(nc)<0:continue
    v,n,tail,left=solve(i+1,nc,mask|bit);p=(v+o['value'],n+1,((o['id'],c['id']),)+tail,left)
    if p[0]>best[0] or p[0]==best[0] and (p[1]>best[1] or p[1]==best[1] and p[2]<best[2]):best=p
  return best
 value,count,alloc,left=solve(0,tuple(cap),0);return {'value':value,'count':count,'allocations':[{'order_id':i,'choice_id':c} for i,c in alloc],'remaining':dict(zip(skus,left))}
def instant(s):return dt.datetime.fromisoformat(s.replace('Z','+00:00')).astimezone(dt.timezone.utc)
def iso(t):return t.isoformat(timespec='milliseconds').replace('+00:00','Z')
def book(a):
 meetings=sorted(a['meetings'],key=lambda m:m['id']);low=instant(a['range_start']);high=instant(a['range_end']);options=[]
 for m in meetings:
  local=dt.datetime.fromisoformat(m['local_start']);zone=ZoneInfo(m['zone']);ts=sorted({t for fold in [0,1] for t in [local.replace(tzinfo=zone,fold=fold).astimezone(dt.timezone.utc)] if t.astimezone(zone).replace(tzinfo=None)==local})
  if m['fold']=='earlier':ts=ts[:1]
  if m['fold']=='later':ts=ts[-1:]
  oo=[]
  for t in ts:
   end=t+dt.timedelta(minutes=m['minutes'])
   for room in m['eligible_rooms']:
    if t<low or end>high or any(b['room_id']==room and t<instant(b['end']) and instant(b['start'])<end for b in a['blocks']):continue
    oo.append((m,room,t,end))
  options.append(oo)
 best=(0,0,())
 def valid(chosen):
  indexed={m['id']:(m,room,start,end) for m,room,start,end in chosen}
  if any(p not in indexed or indexed[p][3]>start for m,room,start,end in chosen for p in m['requires']):return False
  for person in {p for m,_,_,_ in chosen for p in m['people']}:
   seq=sorted([o for o in chosen if person in o[0]['people']],key=lambda o:(o[2],o[0]['id']))
   if any(y[2]<x[3]+dt.timedelta(minutes=a['transitions'][x[1]][y[1]]) for x,y in zip(seq,seq[1:])):return False
  return True
 def dfs(i,chosen,value):
  nonlocal best
  if value+sum(m['value'] for m in meetings[i:])<best[0]:return
  if i==len(meetings):
   if not valid(chosen):return
   serial=tuple((m['id'],room,iso(start),iso(end)) for m,room,start,end in chosen);p=(value,len(chosen),serial)
   if p[0]>best[0] or p[0]==best[0] and (p[1]>best[1] or p[1]==best[1] and p[2]<best[2]):best=p
   return
  for o in options[i]:
   m,room,start,end=o
   if any(start<x[3] and x[2]<end and (room==x[1] or set(m['people'])&set(x[0]['people'])) for x in chosen):continue
   dfs(i+1,chosen+[o],value+m['value'])
  dfs(i+1,chosen,value)
 dfs(0,[],0)
 return {'value':best[0],'count':best[1],'bookings':[dict(zip(['meeting_id','room_id','start','end'],row)) for row in best[2]]}
def sessions(a):
 gap=a['gap_ms'];late=a['lateness_ms'];watermark=None;state={};sealed=set()
 def payload(r):return ('delete',) if r['kind']=='delete' else ('upsert',r['key'],r['event_time'],r['amount'])
 def groups(s):
  per={}
  for r in s.values():
   if r['kind']=='upsert':per.setdefault(r['key'],[]).append(r)
  out=[]
  for key,rr in per.items():
   current=None
   for r in sorted(rr,key=lambda r:(r['event_time'],r['id'])):
    if current is None or r['event_time']-current['last']>gap:
     current={'key':key,'start':r['event_time'],'last':r['event_time'],'total':0,'ids':[]};out.append(current)
    current['last']=r['event_time'];current['total']+=r['amount'];current['ids'].append(r['id'])
  return out
 def finalize():
  if watermark is not None:
   for g in groups(state):
    if g['last']+gap<=watermark-late:sealed.update(g['ids'])
 for r in a['records']:
  if r['kind']=='watermark':watermark=r['time'] if watermark is None else max(watermark,r['time']);finalize();continue
  old=state.get(r['id'])
  if old and r['rev']<old['rev']:continue
  if old and r['rev']==old['rev']:
   if payload(old)!=payload(r):raise ValueError('conflict')
   continue
  if old and old['kind']=='upsert' and r['id'] in sealed:continue
  if r['kind']=='upsert' and any(g['key']==r['key'] and set(g['ids'])&sealed and g['start']-gap<=r['event_time']<=g['last']+gap for g in groups(state)):continue
  proposed={**state,r['id']:r.copy()}
  if r['kind']=='upsert' and watermark is not None:
   g=next(g for g in groups(proposed) if r['id'] in g['ids'])
   if g['last']+gap<=watermark-late:continue
  state=proposed;finalize()
 out=[{'key':g['key'],'start':g['start'],'end':g['last']+gap,'total':g['total'],'count':len(g['ids']),'ids':sorted(g['ids']),'final':set(g['ids'])<=sealed} for g in groups(state)]
 return {'watermark':watermark,'sessions':sorted(out,key=lambda g:(g['start'],g['key']))}
def main():
 if (B/'inventory/cases.json').exists():raise SystemExit('Already built')
 cases={k:[] for k in ['inventory','calendar','events']}
 def add(d,id,input,axis='boundary',throws=False):
  try:value={'value':{'inventory':allocate,'calendar':book,'events':sessions}[d](copy.deepcopy(input))}
  except ValueError:value={'throws':True}
  assert bool(value.get('throws'))==throws,(d,id,value)
  cases[d].append({'id':id,'axis':axis,'input':input,**value})
 def O(id='a',value=5,items=None,group=None,choices=None):return {'id':id,'value':value,'group':group,'choices':choices or [{'id':'a','items':items or {'s':1}}]}
 def I(orders=None,stock=None,holds=None):return {'now':10,'on_hand':stock or {'s':3},'holds':holds or [],'orders':orders or []}
 def H(order='z',state='reserved',qty=1,expiry=20,sku='s'):return {'id':'h','order_id':order,'sku':sku,'quantity':qty,'state':state,'expires_at':expiry}
 add('inventory','empty',I(),'normal');add('inventory','one-order',I([O()]),'normal')
 add('inventory','greedy-is-suboptimal',I([O('a',8,{'s':3}),O('b',5,{'s':2}),O('c',4,{'s':1})]),'boundary')
 add('inventory','global-alternative-choice',I([O('a',6,choices=[{'id':'a','items':{'s':2}},{'id':'b','items':{'t':2}}]),O('b',5,{'s':2})],{'s':2,'t':2}),'boundary')
 add('inventory','value-tie-prefers-count',I([O('a',10,{'s':2}),O('b',5),O('c',5)],{'s':2}),'boundary')
 add('inventory','lex-selected-identities',I([O('c'),O('b'),O('a')],{'s':2}),'regression')
 add('inventory','lex-choice-identity',I([O(choices=[{'id':'z','items':{'s':1}},{'id':'a','items':{'s':1}}])]),'regression')
 add('inventory','group-competition',I([O('a',6,group='g'),O('b',5,group='g'),O('c',4)]),'boundary')
 add('inventory','zero-value-count-objective',I([O('a',0),O('b',0)]),'boundary')
 add('inventory','active-hold-capacity',I([O('a',6,{'s':3}),O('b',5,{'s':1})],holds=[H(qty=2)]),'regression')
 for state,expiry in [('expired',8),('reserved',10),('committed',8),('cancelled',8)]:add('inventory','existing-'+state+str(expiry),I([O()],holds=[H(order='a',state=state,qty=2,expiry=expiry)]),'counterexample')
 add('inventory','commit-already-in-snapshot',I([O('a',5,{'s':2})],{'s':2},[H(state='committed',qty=7)]),'counterexample')
 add('inventory','duplicate-orders-once',I([O(),O()]),'regression')
 q=O(choices=[{'id':'a','items':{'s':1,'t':1}},{'id':'b','items':{'s':2}}]);other=copy.deepcopy(q);other['choices'].reverse();other['choices'][1]['items']={'t':1,'s':1};add('inventory','canonical-duplicate-order',I([q,other],{'s':3,'t':2}),'boundary')
 add('inventory','duplicate-conflict',I([O(),O(value=6)]),'boundary',True)
 add('inventory','symmetric-bounded-search',I([O(f'o{i:02}',i%4,choices=[{'id':c,'items':{'s':1}} for c in ['z','b','a']]) for i in range(18)],{'s':12}),'boundary')
 rng=random.Random(20261020)
 for n in range(12):
  stock={s:rng.randint(2,7) for s in ['s','t','u']};oo=[]
  for i in range(8):
   choices=[{'id':chr(97+j),'items':{s:rng.randint(1,3) for s in rng.sample(list(stock),rng.randint(1,2))}} for j in range(2)]
   oo.append(O(chr(97+i),rng.randint(0,12),group=rng.choice([None,'g1','g2']),choices=choices))
  add('inventory',f'mixed-capacity-{n}',I(oo,stock),'boundary')
 assert allocate(I([O('a',8,{'s':3}),O('b',5,{'s':2}),O('c',4,{'s':1})]))['value']==9
 def M(id='a',time='09:00',mins=30,value=5,rooms=None,people=None,requires=None,zone='UTC',date='2024-01-07',fold='earlier'):return {'id':id,'zone':zone,'local_start':date+'T'+time,'minutes':mins,'value':value,'eligible_rooms':rooms or ['a'],'people':people or [],'requires':requires or [],'fold':fold}
 def Q(mm=None,rooms=None,blocks=None,trans=None,start='2024-01-07T00:00Z',end='2024-01-08T00:00Z'):
  rr=rooms or ['a'];return {'range_start':start,'range_end':end,'rooms':rr,'transitions':trans or {x:{y:0 for y in rr} for x in rr},'meetings':mm or [],'blocks':blocks or []}
 add('calendar','empty',Q(),'normal');add('calendar','simple',Q([M()]),'normal')
 add('calendar','global-short-pair-beats-long',Q([M('a',mins=120,value=8),M('b',mins=60,value=5),M('c','10:00',mins=60,value=4)]),'boundary')
 add('calendar','assign-room-globally',Q([M('a',rooms=['a','b']),M('b',rooms=['a'])],rooms=['a','b']),'boundary')
 add('calendar','shared-person-conflict',Q([M('a',people=['p'],rooms=['a']),M('b',people=['p'],rooms=['b'])],rooms=['a','b']),'regression')
 add('calendar','directed-setup-boundary',Q([M('a',people=['p']),M('b','09:35',people=['p'],rooms=['b'])],rooms=['a','b'],trans={'a':{'a':0,'b':10},'b':{'a':1,'b':0}}),'boundary')
 add('calendar','setup-equality',Q([M('a',people=['p']),M('b','09:40',people=['p'],rooms=['b'])],rooms=['a','b'],trans={'a':{'a':0,'b':10},'b':{'a':1,'b':0}}),'regression')
 rr=['a','b','c'];tt={x:{y:0 for y in rr} for x in rr};tt['a']['c']=50
 add('calendar','consecutive-not-all-pairs',Q([M('a',people=['p'],rooms=['a']),M('c','10:00',people=['p'],rooms=['c']),M('z','09:30',people=['p'],rooms=['b'])],rooms=rr,trans=tt),'counterexample')
 add('calendar','required-booking-unavailable',Q([M('a',time='08:00'),M('b',requires=['a'])],blocks=[{'room_id':'a','start':'2024-01-07T08:00Z','end':'2024-01-07T08:30Z'}]),'boundary')
 add('calendar','dependency-ends-at-start',Q([M('z',time='08:30'),M('a',requires=['z'])]),'regression')
 add('calendar','dependency-order-not-id-order',Q([M('a',requires=['z'],value=20),M('z','08:00',value=0)]),'boundary')
 add('calendar','either-fold-one-booking',Q([M(zone='America/New_York',date='2024-11-03',time='01:30',fold='either')],start='2024-11-03T00:00Z',end='2024-11-04T00:00Z'),'counterexample')
 add('calendar','either-fold-selects-later-option',Q([M(zone='America/New_York',date='2024-11-03',time='01:30',fold='either')],blocks=[{'room_id':'a','start':'2024-11-03T05:30Z','end':'2024-11-03T06:00Z'}],start='2024-11-03T00:00Z',end='2024-11-04T00:00Z'),'counterexample')
 add('calendar','gap-not-bookable',Q([M(zone='America/New_York',date='2024-03-10',time='02:30')],start='2024-03-10T00:00Z',end='2024-03-11T00:00Z'),'boundary')
 add('calendar','quarter-offset',Q([M(zone='Asia/Kathmandu')]),'regression')
 add('calendar','half-hour-fold-choice',Q([M(zone='Australia/Lord_Howe',date='2024-04-07',time='01:45',fold='either')],start='2024-04-06T00:00Z',end='2024-04-08T00:00Z'),'boundary')
 add('calendar','block-is-room-only',Q([M(rooms=['a','b'])],rooms=['a','b'],blocks=[{'room_id':'a','start':'2024-01-07T08:00Z','end':'2024-01-07T10:00Z'}]),'regression')
 add('calendar','zero-value-count-and-lex',Q([M('b',value=0,rooms=['b','a']),M('a','10:00',value=0,rooms=['b','a'])],rooms=['a','b']),'boundary')
 for n in range(8):
  rr=['a','b'];mm=[]
  for i in range(6):
   mins=rng.choice([20,30,40]);t=9*60+rng.choice([0,15,30,45,60,75]);mm.append(M(chr(97+i),f'{t//60:02}:{t%60:02}',mins=mins,value=rng.randint(0,10),rooms=rng.sample(rr,rng.randint(1,2)),people=rng.sample(['p','q'],rng.randint(0,2))))
  add('calendar',f'mixed-assignment-{n}',Q(mm,rooms=rr,trans={'a':{'a':0,'b':rng.choice([0,5,15])},'b':{'a':rng.choice([0,10]),'b':0}}),'boundary')
 assert book(Q([M('a',mins=120,value=8),M('b',mins=60,value=5),M('c','10:00',mins=60,value=4)]))['value']==9
 def U(id='a',rev=1,t=0,n=1,key='x'):return {'kind':'upsert','id':id,'rev':rev,'key':key,'event_time':t,'amount':n}
 def D(id='b',rev=2):return {'kind':'delete','id':id,'rev':rev}
 def W(t):return {'kind':'watermark','time':t}
 def E(rr=None,gap=10,late=0):return {'gap_ms':gap,'lateness_ms':late,'records':rr or []}
 for name,rr,axis,late in [
 ('empty',[],'normal',0),('simple',[U()],'normal',0),('bridge-merges',[U(),U('c',t=20),U('b',t=10)],'boundary',0),('remove-bridge-splits',[U(),U('c',t=20),U('b',t=10),D()],'boundary',0),
 ('equal-gap-connects',[U(),U('b',t=10)],'counterexample',0),('one-more-gap-separates',[U(),U('b',t=11)],'boundary',0),('distinct-ids-count',[U(),U('b')],'regression',0),
 ('signed-zero-total',[U(n=3),U('b',n=-3)],'regression',0),('replace-moves-session',[U(),U('b',t=10),U(rev=2,t=40)],'boundary',0),
 ('seal-exact-boundary',[U(),W(10)],'boundary',0),('new-touch-sealed-rejected',[U(),W(10),U('b',t=10)],'counterexample',0),('old-left-touch-rejected',[U(t=20),W(30),U('b',t=10)],'counterexample',0),
 ('sealed-cannot-be-bridged',[U(),U('c',t=20),W(10),U('b',t=10)],'counterexample',0),('old-event-joins-open',[U('b',t=20),U('c',t=30),W(25),U(t=10)],'counterexample',0),
 ('isolated-old-rejected',[W(20),U()],'boundary',0),('delete-split-finalizes',[U(),U('b',t=10),U('c',t=20),W(15),D()],'boundary',0),
 ('split-created-seal-protects',[U(),U('b',t=10),U('c',t=20),W(15),D(),U('d',t=5)],'boundary',0),
 ('move-from-sealed-atomic',[U(),W(10),U(rev=2,t=40)],'boundary',0),('move-to-sealed-atomic',[U(),U('b',t=40),W(10),U('b',rev=2,t=5)],'boundary',0),
 ('rejected-version-not-poison',[U(),W(10),U('b',rev=2,t=5),U('b',rev=2,t=40)],'regression',0),('delete-sealed-keeps-version',[U(),W(10),D('a'),U(rev=2,t=40)],'boundary',0),
 ('unknown-delete-tombstone',[D('a',3),U(rev=2)],'regression',0),('replay-after-seal',[U(),W(10),U()],'regression',0),('lower-revision-ignored',[U(rev=3),U(rev=2,t=40)],'regression',0),
 ('explicit-lateness',[U(),W(10),U('b',t=10)],'boundary',1),('watermark-monotone',[U(),W(10),W(-10),U('b',t=10)],'boundary',0),
 ('negative-time',[U(t=-10),U('b',t=-1),W(9)],'boundary',0),('same-rev-conflict',[U(),U(n=8)],'boundary',0),('sealed-conflict-still-throws',[U(),W(10),U(n=8)],'boundary',0),
 ('move-key-removes-old',[U(),U(rev=2,t=0,key='y')],'boundary',0)]:add('events',name,E(rr,late=late),axis,throws='conflict' in name)
 for n in range(10):
  rr=[];rev={};hist=[]
  for k in range(35):
   if k%7==6:rr.append(W(rng.randint(0,40)));continue
   if hist and k%9==8:rr.append(copy.deepcopy(rng.choice(hist)));continue
   id=rng.choice(['a','b','c','d','e']);rev[id]=rev.get(id,0)+1
   r=D(id,rev[id]) if rng.random()<.22 else U(id,rev[id],rng.randint(-5,50),rng.randint(-3,5),rng.choice(['x','y']));rr.append(r);hist.append(r)
  add('events',f'mixed-session-history-{n}',E(rr,late=10),'boundary')
 assert len(sessions(E([U(),U('c',t=20),U('b',t=10)]))['sessions'])==1
 for domain,cc in cases.items():
  (B/domain/'cases.json').write_text(json.dumps(cc,indent=2)+'\n');fn={'inventory':'allocate','calendar':'book','events':'sessions'}[domain];text="import test from 'node:test';import assert from 'node:assert/strict';import {"+fn+"} from './solution.mjs';\n"
  for c in [c for c in cc if c['axis']=='normal']:text+="test("+json.dumps(c['id'])+",async()=>assert.deepEqual(await "+fn+"("+json.dumps(c['input'])+"),"+json.dumps(c['value'])+"));\n"
  (B/domain/'public.test.mjs').write_text(text)
 print(json.dumps({d:len(cc) for d,cc in cases.items()}))
if __name__=='__main__':main()
