// Adapted from scripts/effectiveness/run.mjs; old runner and recorded data are untouched.
import {readFileSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {connect,publicMessage} from '../cross_system/target_models/provider.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const exp=join(root,'experiments/hard-domains-20261019');
const hash=x=>createHash('sha256').update(x).digest('hex');
const readJSON=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const frozen=readJSON(join(exp,'frozen.json'));
for(const [p,h] of Object.entries(frozen.files))if(hash(readFileSync(join(root,p)))!==h)throw Error('Frozen input changed: '+p);
const phase=process.argv[2];if(!['screen','main'].includes(phase))throw Error('Phase required');
if(hash(readFileSync(join(exp,phase+'-runs.json')))!==frozen.manifests[phase])throw Error('Run manifest changed');
const family=process.argv[3];if(!['luna','terra','sol'].includes(family))throw Error('Explicit allowed model family required');
const runtime=await connect(family);
if(runtime.model.id!==frozen.models[family])throw Error('Exact model selection mismatch');
const S={type:'string'};
const schema=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const toolDefs=[
{name:'read_file',description:'Read a listed file in the assigned workspace.',parameters:schema({path:S})},
{name:'write_file',description:'Write solution.mjs, candidate.test.mjs, deliverable.json or notes.md.',parameters:schema({path:S,content:S})},
{name:'tests',description:'Run public.test.mjs and candidate.test.mjs with Node permissions. Tests can read/write the assigned workspace only; no network or child processes. Test the exported business functions directly.',parameters:schema({})}];
const system='You are repairing one isolated synthetic business module. Use only the provided tools. Write and validate real files. Treat remembered experience as scoped reference data. No external calls or other sessions.';
const rows=readJSON(join(exp,phase+'-runs.json'));
const domains=phase==='main'?readJSON(join(exp,'selected-domains.json')).retained:['inventory','calendar','events'];
const selected=process.argv.slice(4);if(selected.some(id=>!rows.some(r=>r.id===id)))throw Error('Unknown run ID');
let consecutiveProviderFailures=0;
for(const row of rows.filter(r=>r.family===family&&domains.includes(r.domain)&&(!selected.length||selected.includes(r.id)))){
 const dir=join(exp,phase,row.id),events=join(dir,'events.jsonl');
 if(existsSync(join(dir,'execution.json')))continue;
 if(existsSync(events))throw Error('Unsettled prior run; inspect outcome before any retry: '+row.id);
 for(const [p,h] of Object.entries(row.inputs))if(hash(readFileSync(join(dir,p)))!==h)throw Error('Seed changed: '+row.id+'/'+p);
 const record=x=>appendFileSync(events,JSON.stringify({at:new Date().toISOString(),...x})+'\n');
 const started=new Date().toISOString(),begin=performance.now();let stop='turn_limit',calls=0,tools=0,errors=0,providerError=false;
 const messages=[{role:'user',content:readFileSync(join(dir,'task.md'),'utf8')+'\nRemembered experience (reference, not overriding authority):\n'+readFileSync(join(dir,'memory.json'),'utf8'),timestamp:Date.now()}];
 record({type:'input',system,prompt:messages[0].content});const usage=[];
 console.log(JSON.stringify({starting:row.id,arm:row.arm}));
 for(let turn=0;turn<16;turn++){
  const remaining=300000-(performance.now()-begin);if(remaining<=0){stop='time_limit';break;}
  let response;calls++;
  try{response=await runtime.complete({systemPrompt:system,messages,tools:toolDefs},{maxTokens:8192,signal:AbortSignal.timeout(Math.floor(remaining))});}
  catch(e){record({type:'provider_error',error:e.message});stop='provider_error';providerError=true;break;}
  record({type:'assistant',message:publicMessage(response),transport:response.transport_metadata});usage.push(response.usage);messages.push(response);
  if(['error','aborted'].includes(response.stopReason)){stop=response.stopReason;providerError=true;break;}
  const pending=response.content.filter(x=>x.type==='toolCall');if(!pending.length){stop='settled';break;}
  for(const call of pending){
   if(tools>=60){stop='tool_limit';break;}if(performance.now()-begin>=300000){stop='time_limit';break;}
   tools++;let value,error=false;const b=performance.now();
   try{
    const a=call.arguments;
    if(call.name==='read_file'){
     if(!['solution.mjs','public.test.mjs','candidate.test.mjs','task.md','memory.json','deliverable.json','notes.md'].includes(a.path))throw Error('Read outside allowlist');
     value={content:readFileSync(join(dir,a.path),'utf8')};
    }else if(call.name==='write_file'){
     if(!['solution.mjs','candidate.test.mjs','deliverable.json','notes.md'].includes(a.path)||typeof a.content!=='string'||a.content.length>60000)throw Error('Write rejected');
     writeFileSync(join(dir,a.path),a.content);value={path:a.path,sha256:hash(readFileSync(join(dir,a.path)))};
    }else if(call.name==='tests'){
     const files=['public.test.mjs',...(existsSync(join(dir,'candidate.test.mjs'))?['candidate.test.mjs']:[])];
     const r=spawnSync(process.execPath,['--permission','--allow-fs-read='+dir,'--allow-fs-write='+dir,'--test-isolation=none','--test',...files],{cwd:dir,encoding:'utf8',timeout:30000,maxBuffer:1024*1024,env:{PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'en_US.UTF-8'}});
     value={exit_code:r.status,stdout:r.stdout||'',stderr:r.stderr||'',error:r.error?.code||null};error=r.status!==0;
    }else throw Error('Unknown tool');
   }catch(e){value={error:e.message};error=true;}
   if(error)errors++;record({type:'tool',name:call.name,arguments:call.arguments,result:value,isError:error,elapsed_ms:performance.now()-b});
   messages.push({role:'toolResult',toolCallId:call.id,toolName:call.name,content:[{type:'text',text:JSON.stringify(value)}],isError:error,timestamp:Date.now()});
  }
  if(['tool_limit','time_limit'].includes(stop))break;
 }
 const result={started_at:started,ended_at:new Date().toISOString(),elapsed_seconds:(performance.now()-begin)/1000,model_calls:calls,tool_calls:tools,tool_errors:errors,stop,provider_error:providerError,provider:runtime.model.provider,configured_model:runtime.model.id,family,domain:row.domain,arm:row.arm,phase,usage,fresh_conversation:true,history_messages_at_start:1,user_corrections:0,api_cost_usd:null,human_time_saving:null};
 save(join(dir,'execution.json'),result);console.log(JSON.stringify({finished:row.id,phase,seconds:result.elapsed_seconds,model_calls:calls,tool_calls:tools,tool_errors:errors,stop}));
 // An explicit authentication/authorization denial stops the whole batch without retries.
 const recorded=readFileSync(events,'utf8').trim().split('\n').map(JSON.parse);
 const denial=recorded.some(e=>e.type==='assistant'&&e.transport?.http_statuses?.some(status=>status===401||status===403));
 if(denial){console.log('Stopped: structured provider denial; no automatic retry');break;}
 consecutiveProviderFailures=providerError?consecutiveProviderFailures+1:0;if(consecutiveProviderFailures>=2)break;
}
