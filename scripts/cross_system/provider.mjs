// Read-only use of the user's existing Pi API-key configuration; no auth writes.
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function connect(){
 const sdk=process.env.PI_AI_PATH || '/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/node_modules/@mariozechner/pi-ai/dist/index.js';
 const {getModel,completeSimple}=await import(pathToFileURL(sdk).href);
 const settings=JSON.parse(readFileSync(join(homedir(),'.pi/agent/settings.json'),'utf8'));
 const provider=settings.defaultProvider, id=settings.defaultModel;
 const auth=JSON.parse(readFileSync(join(homedir(),'.pi/agent/auth.json'),'utf8'));
 if(auth[provider]?.type!=='api_key')throw Error('Existing API-key route required; no auth changes permitted');
 const model=getModel(provider,id);if(!model)throw Error('Configured model missing from installed Pi inventory');
 return {model,complete:(context,options={})=>completeSimple(model,context,{...options,apiKey:auth[provider].key})};
}
export function publicMessage(m){
 return Object.fromEntries(Object.entries({...m,content:m.content?.filter(x=>x.type!=='thinking')}).filter(([k])=>['role','content','usage','stopReason','errorMessage','timestamp','durationMs','provider','model','responseModel'].includes(k)));
}
