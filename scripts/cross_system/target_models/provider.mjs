// Existing Codex connection only. Never refresh/copy auth or infer a requested model ID.
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {publicMessage} from '../provider.mjs';
export {publicMessage};
const exp=new URL('../../../experiments/cross-system-target-models-20261019/',import.meta.url);
export async function connect(family){
 const selected=JSON.parse(readFileSync(new URL('selected-models.json',exp),'utf8'));
 const pick=selected.models.find(m=>m.family===family);if(!pick)throw Error('No explicitly selected exact ID for family');
 const inventory=JSON.parse(readFileSync(new URL('inventory.json',exp),'utf8'));
 if(!inventory.models.some(m=>m.slug===pick.id&&m.supported_in_api))throw Error('Selected ID absent from confirmed existing inventory');
 const sdk='/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/node_modules/@mariozechner/pi-ai/dist/index.js';
 const {getModel,completeSimple}=await import(pathToFileURL(sdk).href);
 // Template is an existing protocol adapter, never a requested/generated substitute model.
 const template=getModel('openai-codex','gpt-5.4');
 const model={...template,id:pick.id,name:pick.id,reasoning:true,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
 const auth=JSON.parse(readFileSync(join(homedir(),'.codex/auth.json'),'utf8'));
 if(auth.auth_mode!=='chatgpt'||!auth.tokens?.access_token)throw Error('Existing Codex auth unavailable; no refresh permitted');
 let current;
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=async (...args)=>{
  const response=await nativeFetch(...args);
  if(current&&String(args[0]).includes('/codex/responses')&&!response.ok){try{const d=await response.clone().json();current.response_error={code:d.error?.code||d.code||null,message:String(d.error?.message||d.detail||d.message||'').slice(0,500).replaceAll(auth.tokens.access_token,'[redacted]')};}catch{}}
  if(current&&String(args[0]).includes('/codex/responses')&&response.ok){
   const meta=current;const reader=response.clone().body.getReader();
   meta.capture=(async()=>{let buffer='';const decode=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decode.decode(value,{stream:true});let idx;while((idx=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,idx).trim();buffer=buffer.slice(idx+1);if(!line.startsWith('data: '))continue;try{const e=JSON.parse(line.slice(6));if(['response.created','response.completed','response.incomplete','response.failed'].includes(e.type)&&e.response){if(e.response.model&&!meta.response_models.includes(e.response.model))meta.response_models.push(e.response.model);if(e.response.usage)meta.raw_provider_usage=e.response.usage;meta.response_event_types.push(e.type);}}catch{}}}})().catch(e=>{meta.capture_error=e.name;});
  }
  return response;
 };
 return {model,complete:async(context,options={})=>{
  const controller=new AbortController();const meta={requested_model:model.id,response_models:[],response_event_types:[],http_statuses:[],raw_provider_usage:null};current=meta;
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal;
  const result=await completeSimple(model,context,{...options,apiKey:auth.tokens.access_token,reasoning:'medium',signal,
   onPayload:body=>{meta.request_payload={model:body.model,reasoning:body.reasoning?.effort,max_output_tokens:options.maxTokens};body.max_output_tokens=options.maxTokens;return body;},
   onResponse:r=>{meta.http_statuses.push(r.status);if(r.status>=400)controller.abort();},
  });
  if(meta.capture)await meta.capture;delete meta.capture;current=null;
  // The SDK model field is client assigned; raw response_models are server evidence.
  return {...result,transport_metadata:meta};
 }};
}
