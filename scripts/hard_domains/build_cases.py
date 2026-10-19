"""Coordinator-only Python oracles; targets use independent JS controls. No model calls."""
import copy,json,math,datetime as dt
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[2];B=ROOT/'experiments/hard-domains-20261019/source-B'
def inv(a):
 stock=copy.deepcopy(a['stock']);rs={};seen={};out=[];now=0
 def held(s):return sum(r['quantity'] for r in rs.values() if r['state']=='reserved' and r['sku']==s)
 for o in a['operations']:
  now=max(now,o['at'])
  for r in rs.values():
   if r['state']=='reserved' and r['expires_at']<=now:r['state']='expired'
  typ=o['type'];core=tuple(o.get(k) for k in (['type','reservation_id','sku','quantity','ttl_ms'] if typ=='reserve' else ['type','sku','delta'] if typ=='adjust' else ['type','reservation_id']))
  if o['request_id'] in seen:
   old,status=seen[o['request_id']]
   if old!=core:raise ValueError('conflict')
  else:
   r=rs.get(o.get('reservation_id'))
   if typ=='reserve':
    if r:
     if r['sku'] is not None and (r['sku'],r['quantity'],r.get('ttl_ms'))!=(o['sku'],o['quantity'],o['ttl_ms']):raise ValueError('conflict')
     status=r['state']
    elif stock[o['sku']]-held(o['sku'])<o['quantity']:status='insufficient'
    else:
     rs[o['reservation_id']]={'id':o['reservation_id'],'sku':o['sku'],'quantity':o['quantity'],'expires_at':now+o['ttl_ms'],'state':'reserved','ttl_ms':o['ttl_ms']};status='reserved'
   elif typ=='adjust':
    if stock[o['sku']]+o['delta']<max(0,held(o['sku'])):status='rejected'
    else:stock[o['sku']]+=o['delta'];status='adjusted'
   elif r is None:
    status='cancelled' if typ=='cancel' else 'missing'
    if typ=='cancel':rs[o['reservation_id']]={'id':o['reservation_id'],'sku':None,'quantity':0,'expires_at':None,'state':'cancelled'}
   elif r['state']!='reserved':status=r['state']
   else:
    status='committed' if typ=='commit' else 'cancelled';r['state']=status
    if typ=='commit':stock[r['sku']]-=r['quantity']
   seen[o['request_id']]=(core,status)
  out.append({'request_id':o['request_id'],'status':status})
 return {'now':now,'on_hand':stock,'available':{s:n-held(s) for s,n in stock.items()},'reservations':[{k:r[k] for k in ['id','sku','quantity','expires_at','state']} for _,r in sorted(rs.items())],'outcomes':out}
def events(a):
 width=a['window_ms'];late=a['lateness_ms'];mark=None;state={}
 def closed(t):return mark is not None and (t//width+1)*width<=mark-late
 def payload(r):return ('delete',) if r['kind']=='delete' else ('upsert',r['key'],r['event_time'],r['amount'])
 for r in a['records']:
  if r['kind']=='watermark':mark=r['time'] if mark is None else max(mark,r['time']);continue
  old=state.get(r['id'])
  if old and r['rev']<old['rev']:continue
  if old and r['rev']==old['rev']:
   if payload(r)!=payload(old):raise ValueError('conflict')
   continue
  if old and old['kind']=='upsert' and closed(old['event_time']):continue
  if r['kind']=='upsert' and closed(r['event_time']):continue
  state[r['id']]=r.copy()
 buckets={}
 for r in state.values():
  if r['kind']=='delete':continue
  start=r['event_time']//width*width;k=(start,r['key'])
  if k not in buckets:buckets[k]={'key':r['key'],'start':start,'end':start+width,'total':0,'count':0,'final':closed(r['event_time'])}
  buckets[k]['total']+=r['amount'];buckets[k]['count']+=1
 return {'watermark':mark,'windows':[v for k,v in sorted(buckets.items())]}
def instant(s):return dt.datetime.fromisoformat(s.replace('Z','+00:00')).astimezone(dt.timezone.utc)
def iso(t):return t.isoformat(timespec='milliseconds').replace('+00:00','Z')
def calendar(a):
 low=instant(a['range_start']);high=instant(a['range_end']);zone=ZoneInfo(a['zone']);out=[];day=(low-dt.timedelta(days=2)).date();last=(high+dt.timedelta(days=2)).date()
 while day<=last:
  date=day.isoformat()
  for r in a['rules']:
   if (day.weekday()+1)%7!=r['weekday'] or not r['from']<=date<=r['through'] or {'rule_id':r['id'],'date':date} in a['exclusions']:continue
   local=dt.datetime.fromisoformat(date+'T'+r['start']);starts=set()
   for fold in [0,1]:
    t=local.replace(tzinfo=zone,fold=fold).astimezone(dt.timezone.utc)
    if t.astimezone(zone).replace(tzinfo=None)==local:starts.add(t)
   starts=sorted(starts)
   if r['fold']=='earlier':starts=starts[:1]
   if r['fold']=='later':starts=starts[-1:]
   for start in starts:
    end=start+dt.timedelta(minutes=r['minutes'])
    if start<low or end>high or any(start<instant(b['end']) and instant(b['start'])<end for b in a['busy']):continue
    out.append({'rule_id':r['id'],'local_date':date,'start':iso(start),'end':iso(end)})
  day+=dt.timedelta(days=1)
 return sorted(out,key=lambda x:(x['start'],x['rule_id']))
def main():
 if (B/'inventory/cases.json').exists():raise SystemExit('Cases already recorded')
 datasets={k:[] for k in ['inventory','calendar','events']}
 def add(domain,name,args,axis='boundary',error=False):
  try:value={'value':{'inventory':inv,'calendar':calendar,'events':events}[domain](copy.deepcopy(args))}
  except ValueError:value={'throws':True}
  assert bool(value.get('throws'))==error,(domain,name,value)
  datasets[domain].append({'id':name,'axis':axis,'input':args,**value})
 def R(q='r1',id='a',at=0,n=3,ttl=10,sku='s'):return dict(request_id=q,type='reserve',at=at,reservation_id=id,sku=sku,quantity=n,ttl_ms=ttl)
 def C(q='c1',id='a',at=1,typ='cancel'):return dict(request_id=q,type=typ,at=at,reservation_id=id)
 def J(q='j1',at=1,n=1,sku='s'):return dict(request_id=q,type='adjust',at=at,sku=sku,delta=n)
 def I(ops,stock=None):return {'stock':stock or {'s':10},'operations':ops}
 for name,ops,axis in [
 ('empty',[],'normal'),('simple-reserve',[R()],'normal'),('commit-consumes-once',[R(),C(typ='commit')],'regression'),('cancel-releases-once',[R(),C()],'regression'),
 ('duplicate-receipt',[R(),R(at=2)],'boundary'),('duplicate-business-new-receipt',[R(),R(q='r2',at=2)],'boundary'),('double-cancel',[R(),C(),C(q='c2',at=2)],'boundary'),
 ('cancel-after-commit',[R(),C(typ='commit'),C(q='c2',at=2)],'regression'),('commit-after-cancel',[R(),C(),C(q='k2',at=2,typ='commit')],'regression'),
 ('unknown-cancel-tombstone',[C(),R(at=2)],'counterexample'),('unknown-commit-not-tombstone',[C(typ='commit'),R(at=2)],'counterexample'),
 ('expiry-exact-boundary',[R(),C(at=10,typ='commit')],'boundary'),('just-before-expiry',[R(),C(at=9,typ='commit')],'boundary'),
 ('replay-does-not-renew',[R(),R(at=8),C(at=10,typ='commit')],'boundary'),('late-replay-original-outcome',[R(),C(at=11),R(at=12)],'counterexample'),
 ('new-receipt-after-expired',[R(),J(at=11,n=0),R(q='r2',at=12)],'regression'),('receipt-clock-never-rewinds',[J(at=20,n=0),R(at=5)],'boundary'),
 ('rejected-reserve-retry',[R(n=11),J(n=5),R(at=2,n=11),R(q='r2',at=3,n=11)],'boundary'),
 ('adjust-cannot-steal-held',[R(n=8),J(n=-3)],'regression'),('adjust-to-held-floor',[R(n=8),J(n=-2)],'boundary'),('negative-stock-rejected',[J(n=-11)],'regression'),
 ('same-quantity-distinct-identities',[R(),R(q='r2',id='b')],'counterexample'),('expiry-releases-for-second',[R(n=8),R(q='r2',id='b',at=10,n=8)],'boundary'),
 ('commit-then-replenish',[R(n=7),C(typ='commit'),J(q='j2',n=4),R(q='r2',id='b',at=3,n=7)],'regression'),
 ('transport-conflict',[R(),R(n=2)],'boundary'),('business-conflict-after-terminal',[R(),C(),R(q='r2',n=2,at=2)],'boundary')]:add('inventory',name,I(ops),axis,error=name in ['transport-conflict','business-conflict-after-terminal'])
 add('inventory','two-skus-independent',I([R(sku='s',n=7),R(q='r2',id='b',sku='t',n=4),C(id='a'),J(sku='t',n=-1)],{'s':10,'t':5}),'regression')
 # Independent manual arithmetic checks of the Python oracle.
 assert inv(I([R(),C(),C(q='c2')]))['available']['s']==10
 assert inv(I([C(),R(at=2)]))['reservations'][0]['sku'] is None
 assert inv(I([R(),C(typ='commit')]))['on_hand']['s']==7
 def U(id='a',rev=1,key='x',t=1,n=3):return {'kind':'upsert','id':id,'rev':rev,'key':key,'event_time':t,'amount':n}
 def D(id='a',rev=2):return {'kind':'delete','id':id,'rev':rev}
 def W(t):return {'kind':'watermark','time':t}
 def E(rr,late=0,width=10):return {'window_ms':width,'lateness_ms':late,'records':rr}
 for name,rr,axis,late in [
 ('empty',[],'normal',0),('simple',[U()],'normal',0),('retransmission',[U(),U()],'boundary',0),('same-payload-distinct-ids',[U(),U(id='b')],'counterexample',0),
 ('replace-not-add',[U(),U(rev=2,n=8)],'boundary',0),('older-time-higher-revision',[U(t=8),U(rev=2,t=1,n=9)],'counterexample',0),('newer-time-lower-revision',[U(rev=3,t=1),U(rev=2,t=8,n=99)],'counterexample',0),
 ('move-key-and-window',[U(),U(rev=2,key='y',t=12,n=9)],'boundary',0),('delete-removes',[U(),D()],'regression',0),('unknown-delete-tombstone',[D(rev=3),U(rev=2)],'boundary',0),
 ('resurrection-higher-revision',[U(),D(),U(rev=3,n=7)],'regression',0),('zero-total-not-empty',[U(n=3),U(id='b',n=-3)],'counterexample',0),('zero-amount-counts',[U(n=0)],'boundary',0),
 ('negative-time-floor',[U(t=-1)],'boundary',0),('exact-window-boundary',[U(t=9),U(id='b',t=10)],'boundary',0),
 ('late-new-after-finalization',[W(10),U()],'boundary',0),('allowed-lateness-open',[W(10),U()],'boundary',1),('exact-seal-with-lateness',[W(11),U()],'boundary',1),
 ('watermark-never-rewinds',[W(20),W(0),U(t=11)],'regression',0),('duplicate-after-finalization',[U(),W(10),U()],'regression',0),
 ('move-from-sealed-atomic',[U(),W(10),U(rev=2,t=11,n=8)],'boundary',0),('move-to-sealed-atomic',[U(t=11),W(10),U(rev=2,t=1,n=8)],'boundary',0),
 ('rejected-version-does-not-poison',[U(t=11),W(10),U(rev=2,t=1,n=8),U(rev=2,t=12,n=9)],'boundary',0),('delete-sealed-rejected',[U(),W(10),D()],'boundary',0),
 ('signed-watermark-zero',[U(t=-1),W(0)],'boundary',0),('conflicting-revision',[U(),U(n=8)],'boundary',0),('delete-conflict-same-revision',[U(),D(rev=1)],'boundary',0),
 ('lower-revision-different-payload',[U(rev=3),U(rev=2,key='y',n=99)],'regression',0),('distinct-keys-with-separator',[U(key='x|0'),U(id='b',key='x')],'regression',0)]:add('events',name,E(rr,late),axis,error=name in ['conflicting-revision','delete-conflict-same-revision'])
 assert events(E([U(),U(rev=2,n=8)]))['windows'][0]['total']==8
 assert events(E([U(),W(10),U(rev=2,t=11,n=8)]))['windows'][0]['total']==3
 def rule(id='a',weekday=0,time='09:00',minutes=30,fold='earlier',first='2024-01-01',last='2026-12-31'):return {'id':id,'weekday':weekday,'start':time,'minutes':minutes,'from':first,'through':last,'fold':fold}
 def Q(zone='UTC',start='2024-01-07T00:00Z',end='2024-01-08T00:00Z',rules=None,exclusions=None,busy=None):return {'zone':zone,'range_start':start,'range_end':end,'rules':rules if rules is not None else [rule()],'exclusions':exclusions or [],'busy':busy or []}
 add('calendar','empty',Q(rules=[]),'normal');add('calendar','simple-utc',Q(),'normal')
 add('calendar','winter-new-york',Q(zone='America/New_York'),'regression');add('calendar','summer-new-york',Q(zone='America/New_York',start='2024-07-07T00:00Z',end='2024-07-08T00:00Z'),'boundary')
 for fold in ['earlier','later','both']:
  add('calendar','new-york-fold-'+fold,Q(zone='America/New_York',start='2024-11-03T00:00Z',end='2024-11-04T00:00Z',rules=[rule(time='01:30',fold=fold)]),'counterexample' if fold!='earlier' else 'boundary')
 add('calendar','new-york-gap',Q(zone='America/New_York',start='2024-03-10T00:00Z',end='2024-03-11T00:00Z',rules=[rule(time='02:30')]),'boundary')
 add('calendar','berlin-gap',Q(zone='Europe/Berlin',start='2024-03-31T00:00Z',end='2024-04-01T00:00Z',rules=[rule(time='02:30')]),'boundary')
 add('calendar','berlin-fold-both',Q(zone='Europe/Berlin',start='2024-10-27T00:00Z',end='2024-10-28T00:00Z',rules=[rule(time='02:30',fold='both')]),'counterexample')
 add('calendar','lord-howe-half-hour-fold',Q(zone='Australia/Lord_Howe',start='2024-04-06T00:00Z',end='2024-04-08T00:00Z',rules=[rule(time='01:45',fold='both')]),'counterexample')
 add('calendar','kathmandu-quarter-offset',Q(zone='Asia/Kathmandu'),'boundary')
 add('calendar','adjacent-busy-allowed',Q(busy=[{'start':'2024-01-07T08:00Z','end':'2024-01-07T09:00Z'},{'start':'2024-01-07T09:30Z','end':'2024-01-07T10:00Z'}]),'regression')
 add('calendar','one-minute-overlap',Q(busy=[{'start':'2024-01-07T09:29Z','end':'2024-01-07T10:00Z'}]),'boundary')
 add('calendar','busy-with-offset',Q(busy=[{'start':'2024-01-07T10:15+01:00','end':'2024-01-07T10:16+01:00'}]),'boundary')
 add('calendar','exclude-one-identity',Q(rules=[rule(),rule(id='b')],exclusions=[{'rule_id':'a','date':'2024-01-07'}]),'counterexample')
 add('calendar','same-label-distinct-rules',Q(rules=[rule(id='b'),rule(id='a')]),'regression')
 add('calendar','inclusive-local-effective-dates',Q(start='2024-01-01T00:00Z',end='2024-01-15T00:00Z',rules=[rule(first='2024-01-07',last='2024-01-07')]),'boundary')
 add('calendar','local-date-before-utc-date',Q(zone='America/New_York',start='2024-01-08T00:00Z',end='2024-01-08T06:00Z',rules=[rule(time='23:00')]),'boundary')
 add('calendar','midnight-elapsed-duration',Q(start='2024-01-07T23:00Z',end='2024-01-08T01:00Z',rules=[rule(time='23:45',minutes=60)]),'boundary')
 add('calendar','range-end-equality',Q(start='2024-01-07T09:00Z',end='2024-01-07T09:30Z'),'regression')
 add('calendar','range-clip-whole-slot',Q(start='2024-01-07T09:01Z',end='2024-01-07T10:00Z'),'boundary')
 add('calendar','fold-duration-is-elapsed',Q(zone='America/New_York',start='2024-11-03T00:00Z',end='2024-11-04T00:00Z',rules=[rule(time='01:30',minutes=120,fold='both')]),'boundary')
 add('calendar','busy-one-fold-instant',Q(zone='America/New_York',start='2024-11-03T00:00Z',end='2024-11-04T00:00Z',rules=[rule(time='01:30',fold='both')],busy=[{'start':'2024-11-03T05:30Z','end':'2024-11-03T06:00Z'}]),'counterexample')
 assert len(calendar(Q(zone='America/New_York',start='2024-11-03T00:00Z',end='2024-11-04T00:00Z',rules=[rule(time='01:30',fold='both')])))==2
 for name,cases in datasets.items():
  (B/name/'cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n')
  pub=[c for c in cases if c['axis']=='normal'][:2]
  fn={'inventory':'replay','calendar':'plan','events':'aggregate'}[name]
  text="import test from 'node:test';import assert from 'node:assert/strict';import {"+fn+"} from './solution.mjs';\n"
  for c in pub:text+="test("+json.dumps(c['id'])+",async()=>assert.deepEqual(await "+fn+"("+json.dumps(c['input'])+"),"+json.dumps(c['value'])+"));\n"
  (B/name/'public.test.mjs').write_text(text)
 print(json.dumps({k:len(v) for k,v in datasets.items()}))
if __name__=='__main__':main()
