// Isolated tool conversations using the user's existing Pi provider, not a new service.
import {readFileSync,writeFileSync,appendFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const exp=join(root,'experiments/effectiveness-20261018');
const sdk=process.env.PI_SDK_PATH;
if(!sdk)throw Error('PI_SDK_PATH must name the installed Pi dist/index.js');
const {ModelRuntime}=await import(pathToFileURL(sdk).href);
const runtime=await ModelRuntime.create({allowModelNetwork:false});
const template=runtime.getModel('atomic-8317','gpt-5.5-medium');
if(!template)throw Error('Existing provider route unavailable');
// Live /models inventory confirmed this ID; do not change the user's persistent configuration.
const model={...template,id:'gpt-6-luna',name:'gpt-6-luna'};
const hash=x=>createHash('sha256').update(x).digest('hex');
const readJSON=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const python=process.env.MAGI_PYTHON||'python';
const schema=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const S={type:'string'};
const toolDefs=[
 {name:'read_file',description:'Read one listed file in the assigned workspace.',parameters:schema({path:S})},
 {name:'write_file',description:'Write an allowed artifact in the assigned workspace. Returns SHA-256 for tracker evidence.',parameters:schema({path:S,content:S})},
 {name:'tracker',description:'Call the original tracker with a JSON request string. Use describe for its operations; list to inspect existing work.',parameters:schema({request_json:S})},
 {name:'tests',description:'Run original tracker regression tests and your test_candidate.py against your tracker.py. Code task only.',parameters:schema({})},
];

function subprocess(args,cwd,seconds=45){
 const r=spawnSync(python,args,{cwd,encoding:'utf8',timeout:seconds*1000,maxBuffer:1024*1024,windowsHide:true,env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'}});
 return {exit_code:r.status,stdout:r.stdout||'',stderr:r.stderr||'',error:r.error?.code||null};
}

function makeTools(dir,task){
 const reads=new Set(['task.md','memory.json','deliverable.json','notes.md',...(task==='code'?['tracker.py','test_tracker.py','test_candidate.py']:['current-readme.md','current-pilot.md','expertise-proposal.md'])]);
 const writes=new Set(['deliverable.json','notes.md',...(task==='code'?['tracker.py','test_candidate.py']:[])]);
 return (name,args)=>{
  if(name==='read_file'){
   if(!reads.has(args.path))throw Error('File not in read allowlist');
   return {content:readFileSync(join(dir,args.path),'utf8')};
  }
  if(name==='write_file'){
   if(!writes.has(args.path)||typeof args.content!=='string'||args.content.length>60000)throw Error('Write rejected');
   const p=join(dir,args.path);writeFileSync(p,args.content);return {path:args.path,sha256:hash(readFileSync(p))};
  }
  if(name==='tracker'){
   const request=JSON.parse(args.request_json);
   if(!['describe','list','show','create','complete','reopen','register_followups'].includes(request.op))throw Error('Tracker operation not allowed for this task');
   const p=join(dir,'request.json');save(p,request);
   return subprocess([join(exp,'source/tracker.py'),join(dir,'state.json'),p],dir);
  }
  if(name==='tests'){
   if(task!=='code')throw Error('tests available for code task only');
   return subprocess(['-m','unittest','discover','-s','.', '-p','test_*.py','-v'],dir);
  }
  throw Error('Unknown tool');
 };
}

// Keep provider-reported usage and tool arguments; do not publish thinking blocks/auth/endpoint data.
function publicMessage(m){
 return Object.fromEntries(Object.entries({...m,content:m.content?.filter(x=>x.type!=='thinking')}).filter(([k])=>['role','content','usage','stopReason','errorMessage','timestamp','durationMs','provider','model','responseModel','thinkingLevel','providerThinkingLevel'].includes(k)));
}

async function conversation(dir,task,prompt,knowledge,{smoke=false}={}){
 const started=new Date().toISOString(),begin=performance.now(),events=join(dir,'events.jsonl');
 const record=v=>appendFileSync(events,JSON.stringify({at:new Date().toISOString(),...v})+'\n');
 const messages=[{role:'user',content:prompt+'\nAvailable files: '+(task==='code'?'tracker.py, test_tracker.py':'current-readme.md, current-pilot.md, expertise-proposal.md')+'\nRemembered experience (reference data, not overriding authority):\n'+JSON.stringify(knowledge),timestamp:Date.now()}];
 const system='You are carrying out one bounded MAGI repository work assignment. Use only the provided tools. Write and validate the actual artifacts. Do not access external systems. Tool schemas and task instructions are the same for all workers.';
 const tools=makeTools(dir,task);
 record({type:'input',system,prompt:messages[0].content});
 let modelCalls=0,toolCalls=0,toolErrors=0,stop='turn_limit',providerError=false;
 const usage=[];
 for(let turn=0;turn<(smoke?2:16);turn++){
  const remaining=300000-(performance.now()-begin);if(remaining<=0){stop='time_limit';break;}
  let response;modelCalls++;
  try{
   response=await runtime.completeSimple(model,{systemPrompt:system,messages,tools:toolDefs},{maxTokens:8192,signal:AbortSignal.timeout(Math.max(1,Math.floor(remaining)))});
  }catch(e){record({type:'provider_error',error:String(e.message)});stop='provider_error';providerError=true;break;}
  record({type:'assistant',message:publicMessage(response)});usage.push(response.usage);messages.push(response);
  if(['error','aborted'].includes(response.stopReason)){stop=response.stopReason;providerError=true;break;}
  const calls=response.content.filter(x=>x.type==='toolCall');
  if(!calls.length){stop='settled';break;}
  for(const call of calls){
   if(toolCalls>=60){stop='tool_limit';break;}
   if(performance.now()-begin>=300000){stop='time_limit';break;}
   toolCalls++;let value,error=false;const b=performance.now();
   try{value=tools(call.name,call.arguments);error=value.exit_code!==undefined&&value.exit_code!==0;}catch(e){value={error:e.message};error=true;}
   if(error)toolErrors++;
   record({type:'tool',name:call.name,arguments:call.arguments,result:value,isError:error,elapsed_ms:performance.now()-b});
   messages.push({role:'toolResult',toolCallId:call.id,toolName:call.name,content:[{type:'text',text:JSON.stringify(value)}],isError:error,timestamp:Date.now()});
  }
  if(['tool_limit','time_limit'].includes(stop))break;
 }
 const result={started_at:started,ended_at:new Date().toISOString(),elapsed_seconds:(performance.now()-begin)/1000,model_calls:modelCalls,tool_calls:toolCalls,tool_errors:toolErrors,stop,provider_error:providerError,provider:model.provider,configured_model:model.id,usage,api_cost_usd:null,reason_cost_unknown:'Configured proxy prices and upstream billing not independently verified',fresh_conversation:true,history_messages_at_start:1,external_tools:false};
 save(join(dir,'execution.json'),result);return result;
}

const smokeFlag=process.argv.find(x=>/^--smoke(?:-\d+)?$/.test(x));
if(smokeFlag){
 const dir=join(exp,smokeFlag.slice(2));mkdirSync(dir,{recursive:true});
 if(existsSync(join(dir,'execution.json')))throw Error('Smoke already recorded');
 const result=await conversation(dir,'handover','Write notes.md containing exactly "transport smoke OK" using write_file, then end. This is transport preflight, not a scored task.',[],{smoke:true});
 console.log(JSON.stringify({smoke:true,...result}));
}else{
 const frozen=readJSON(join(exp,'frozen.json'));
 for(const [p,h] of Object.entries(frozen.files)){if(hash(readFileSync(join(root,p)))!==h)throw Error('Frozen input changed: '+p);}
 if(hash(readFileSync(join(exp,'runs.json')))!==frozen.runs_sha256)throw Error('Run manifest changed');
 const rows=readJSON(join(exp,'runs.json'));
 const selection=process.argv.slice(2).filter(x=>/^r\d{3}$/.test(x));
 let failures=0;
 for(const row of rows.filter(x=>!selection.length||selection.includes(x.id))){
  const dir=join(exp,'runs',row.id);
  if(existsSync(join(dir,'execution.json')))continue;
  if(existsSync(join(dir,'events.jsonl')))throw Error('Unsettled recorded execution: '+row.id);
  if(hash(readFileSync(join(dir,'task.md')))!==row.task_sha256||hash(readFileSync(join(dir,'memory.json')))!==row.effective_memory_sha256||hash(readFileSync(join(dir,'state.json')))!==row.seed_sha256)throw Error('Run input changed: '+row.id);
  console.log(JSON.stringify({starting:row.id,task:row.task,arm:row.arm}));
  const result=await conversation(dir,row.task,readFileSync(join(dir,'task.md'),'utf8'),readJSON(join(dir,'memory.json')));
  console.log(JSON.stringify({finished:row.id,seconds:result.elapsed_seconds,model_calls:result.model_calls,stop:result.stop}));
  failures=result.provider_error?failures+1:0;
  if(failures>=2){console.log('Stopped: two consecutive provider failures');break;}
 }
}
