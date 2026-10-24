"""Seeded synthetic precursor systems, genuinely executed/repaired before target B exists."""
import hashlib,json,subprocess
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2];A=ROOT/'experiments/hard-domains-20261019/source-A'
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def main():
 if (A/'frozen.json').exists():raise SystemExit('Source A already frozen')
 domains={
 'inventory':{
 'before':"export function wallet(messages){let balance=0;for(const m of messages)balance+=(m.kind==='grant'?1:-1)*m.amount;return balance;}\n",
 'after':"export function wallet(messages){const receipts=new Map();let balance=0;for(const m of messages){if(m.kind==='grant'){if(receipts.has(m.receipt)){if(receipts.get(m.receipt).amount!==m.amount)throw Error('CONFLICT');continue;}receipts.set(m.receipt,{amount:m.amount,voided:false});balance+=m.amount;}else{const prior=receipts.get(m.receipt);if(prior&&!prior.voided){balance-=prior.amount;prior.voided=true;}}}return balance;}\n",
 'tests':"""import {wallet} from './MODULE';
const g=(receipt,amount=7)=>({kind:'grant',receipt,amount});const v=(receipt,amount=7)=>({kind:'void',receipt,amount});
const cases=[['retry-grant',[g('a'),g('a')],7],['retry-void',[g('a'),v('a'),v('a')],0],['distinct-receipts',[g('a'),g('b')],14],['reverse-recorded-effect',[g('a'),v('a',99)],0],['unknown-void-no-future-effect',[v('a'),g('a')],7],['retry-after-void',[g('a'),v('a'),g('a')],0]];
console.log(JSON.stringify(cases.map(([id,input,expected])=>{let actual;try{actual=wallet(input)}catch(e){actual={error:e.message}}return {id,input,expected,actual,passed:actual===expected}})));
""",
 'contract':'Synthetic reversible reward-credit consumer: duplicate delivery of a receipt is not a second credit; void reverses the original recorded credit once; unknown void has no effect; distinct receipts are distinct business effects.',
 'rule':'Bind an effect to its stable business receipt and reverse the recorded effect at most once. Repeated delivery is not a new operation; equal amounts under distinct receipts remain distinct. Do not invent a reversal when no original effect exists.',
 'conditions':{'source_system':'synthetic reward-credit replay','scope':'receipt-scoped reversible effects; this source ignores unknown voids'},
 },
 'calendar':{
 'before':"export function alarm(local,zone){return Date.parse(local+'Z');} export function overlaps(a,b){return a.start<=b.end&&b.start<=a.end;}\n",
 'after':"""function wall(t,zone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t));const x=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${x.year}-${x.month}-${x.day}T${x.hour}:${x.minute}`;}
export function alarm(local,zone){const base=Date.parse(local+'Z');for(let t=base-18*3600000;t<=base+18*3600000;t+=60000)if(wall(t,zone)===local)return t;return null;}
export function overlaps(a,b){return a.start<b.end&&b.start<a.end;}
""",
 'tests':"""import {alarm,overlaps} from './MODULE';
const cases=[['winter-zone',()=>alarm('2024-01-07T09:00','America/New_York'),Date.parse('2024-01-07T14:00Z')],['summer-zone',()=>alarm('2024-07-07T09:00','America/New_York'),Date.parse('2024-07-07T13:00Z')],['gap-no-instant',()=>alarm('2024-03-10T02:30','America/New_York'),null],['fold-source-policy-earlier',()=>alarm('2024-11-03T01:30','America/New_York'),Date.parse('2024-11-03T05:30Z')],['nonhour-zone',()=>alarm('2024-01-01T09:00','Asia/Kathmandu'),Date.parse('2024-01-01T03:15Z')],['adjacent-open-end',()=>overlaps({start:0,end:10},{start:10,end:20}),false],['true-overlap',()=>overlaps({start:0,end:11},{start:10,end:20}),true]];
console.log(JSON.stringify(cases.map(([id,fn,expected])=>{let actual;try{actual=fn()}catch(e){actual={error:e.message}}return {id,expected,actual,passed:actual===expected}})));
""",
 'contract':'Synthetic single civil-time alarm: use the named IANA zone; nonexistent local times produce null; this source chooses the earlier occurrence at a fold. Alarm windows use half-open overlap.',
 'rule':'Resolve civil-time labels under the named zone and the source ambiguity policy before reasoning about elapsed instants. Local labels can have zero or multiple instants; fixed offsets and inclusive interval ends can misclassify them. The earlier-fold choice belongs to this alarm source, not all future consumers.',
 'conditions':{'source_system':'synthetic single civil-time alarm','scope':'minute precision; earlier-fold policy only in this source; half-open intervals'},
 },
 'events':{
 'before':"export function latest(readings){const state={};for(const r of readings)state[r.device]=r.value;return state;}\n",
 'after':"export function latest(readings){const state=new Map();for(const r of readings){const old=state.get(r.device);if(!old||r.observed_ms>old.observed_ms||(r.observed_ms===old.observed_ms&&r.reading_id>old.reading_id))state.set(r.device,r);}return Object.fromEntries([...state].map(([k,v])=>[k,v.value]));}\n",
 'tests':"""import {latest} from './MODULE';
const r=(device,observed_ms,value,reading_id)=>({device,observed_ms,value,reading_id});const a=r('a',100,10,'z'),b=r('a',50,5,'b'),c=r('a',100,11,'y');
const cases=[['late-arrival',[a,b],{a:10}],['reordered',[b,a],{a:10}],['retry',[a,a],{a:10}],['stable-tie',[a,c],{a:10}],['tie-permutation',[c,a],{a:10}],['independent-device',[a,r('b',1,9,'a'),b],{a:10,b:9}]];
console.log(JSON.stringify(cases.map(([id,input,expected])=>{const actual=latest(input);return {id,input,expected,actual,passed:JSON.stringify(actual)===JSON.stringify(expected)}})));
""",
 'contract':'Synthetic unversioned telemetry snapshot: choose greatest observed_ms per device, then greatest reading_id for ties. Delivery order and replay do not establish freshness.',
 'rule':'Choose ordering and identity from the business contract rather than arrival position, and test replay/permutation. In this unversioned snapshot source greatest observed time and its reading-id tie-break select one value. That policy is not a universal command to discard every late arrival in other consumers.',
 'conditions':{'source_system':'synthetic unversioned telemetry snapshot','scope':'one latest value per device; timestamp/id ordering is this source policy'},
 }}
 for name,d in domains.items():
  p=A/name;p.mkdir(parents=True,exist_ok=True)
  (p/'before.mjs').write_text(d['before']);(p/'after.mjs').write_text(d['after']);(p/'contract.txt').write_text(d['contract']+'\n')
  logs=[]
  for variant in ['before','after']:
   test=p/f'check-{variant}.mjs';test.write_text(d['tests'].replace('MODULE',variant+'.mjs'))
   run=subprocess.run(['node',str(test)],capture_output=True,text=True,check=True);cases=json.loads(run.stdout);save(p/(variant+'-observations.json'),{'executed_at':datetime.now(timezone.utc).isoformat(),'command':['node',str(test.relative_to(ROOT))],'cases':cases,'passed':sum(c['passed'] for c in cases),'total':len(cases),'stdout':run.stdout,'stderr':run.stderr});logs.append(cases)
  assert not all(c['passed'] for c in logs[0]) and all(c['passed'] for c in logs[1])
  lesson={'id':name+'-observed-source-A','rule':d['rule'],'conditions':d['conditions'],'provenance':'Coordinator-authored synthetic precursor with intentionally seeded defects; actually executed and repaired before target B construction. Not a historical product defect or autonomous worker-learned lesson.','observed_failures':[c for c in logs[0] if not c['passed']],'observed_repair':{'passed':len(logs[1]),'total':len(logs[1]),'repair_kind':'coordinator code repair; source A only'},'falsifier':'A change satisfying the source contract still reproduces these source-A failures, or this scoped lesson is forced on a consumer with a different explicit policy.','source_files':[str((p/f).relative_to(ROOT)) for f in ['contract.txt','before.mjs','after.mjs','before-observations.json','after-observations.json']]};save(p/'experience.json',lesson)
 paths=sorted(p for p in A.rglob('*') if p.is_file());save(A/'frozen.json',{'frozen_at':datetime.now(timezone.utc).isoformat(),'target_B_not_constructed':True,'synthetic_source':True,'model_api_calls':0,'files':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}})
 print(json.dumps({name:{'before_passed':sum(c['passed'] for c in json.loads((A/name/'before-observations.json').read_text())['cases']),'after_passed':json.loads((A/name/'after-observations.json').read_text())['passed']} for name in domains}))
if __name__=='__main__':main()
