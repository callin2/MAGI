import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {connect,publicMessage} from './provider.mjs';
const family=process.argv[2];if(!['luna','terra','sol'].includes(family))throw Error('Explicit family required');
const exp=new URL('../../../experiments/cross-system-target-models-20261019/',import.meta.url);const out=new URL('smoke-'+family+'.json',exp);
if(existsSync(out))throw Error('Recorded preflight exists; no overwrite');
const runtime=await connect(family);const start=Date.now();
const response=await runtime.complete({systemPrompt:'Transport preflight only. Call acknowledge with text transport smoke OK.',messages:[{role:'user',content:'Acknowledge the transport preflight.',timestamp:Date.now()}],tools:[{name:'acknowledge',description:'Acknowledge transport',parameters:{type:'object',properties:{text:{type:'string'}},required:['text'],additionalProperties:false}}]},{maxTokens:256,signal:AbortSignal.timeout(60000)});
const result={family,provider:runtime.model.provider,requested_model:runtime.model.id,elapsed_seconds:(Date.now()-start)/1000,response:publicMessage(response),transport:response.transport_metadata};writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
