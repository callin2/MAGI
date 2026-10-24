import {writeFileSync,existsSync} from 'node:fs';
import {connect,publicMessage} from './provider.mjs';
const out=new URL('../../../experiments/cross-system-20261019/connection-review/openrouter-smoke.json',import.meta.url);
if(existsSync(out))throw Error('Recorded preflight exists; never overwrite');
const runtime=await connect();const start=Date.now();
const response=await runtime.complete({systemPrompt:'Transport preflight only. Call acknowledge with text transport smoke OK.',messages:[{role:'user',content:'Acknowledge the transport preflight.',timestamp:Date.now()}],tools:[{name:'acknowledge',description:'Acknowledge transport',parameters:{type:'object',properties:{text:{type:'string'}},required:['text'],additionalProperties:false}}]},{maxTokens:256,signal:AbortSignal.timeout(60000)});
const row={provider:runtime.model.provider,model:runtime.model.id,elapsed_seconds:(Date.now()-start)/1000,response:publicMessage(response)};
writeFileSync(out,JSON.stringify(row,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(row));
