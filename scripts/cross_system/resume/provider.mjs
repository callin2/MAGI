// Use the existing OpenCode OpenRouter connection in place, read-only. No key copies/config writes.
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function connect(){
 const sdk='/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/node_modules/@mariozechner/pi-ai/dist/index.js';
 const {getModel,completeSimple}=await import(pathToFileURL(sdk).href);
 const auth=JSON.parse(readFileSync(join(homedir(),'.local/share/opencode/auth.json'),'utf8'));
 if(auth.openrouter?.type!=='api'||!auth.openrouter.key)throw Error('Existing OpenRouter API credential unavailable; no auth changes permitted');
 const model=getModel('openrouter','openai/gpt-4.1-mini');if(!model)throw Error('Selected model absent from installed Pi inventory');
 return {model,complete:(context,options={})=>completeSimple(model,context,{...options,apiKey:auth.openrouter.key})};
}
export {publicMessage} from '../provider.mjs';
