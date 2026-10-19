// Diagnostic public-fs tracing only. This is not an adversarial sandbox.
import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
const workspace=process.env.MAGI_AUDIT_WORKSPACE,output=process.env.MAGI_AUDIT_OUTPUT,calls=[];const write=fs.writeFileSync.bind(fs);
function wrap(object,key,label){const original=object[key];if(typeof original!=='function')return;object[key]=function(...args){const stack=new Error().stack||'';if(workspace&&stack.includes(workspace)){let path;try{path=String(args[0])}catch{path='unprintable'}calls.push({api:label,path});}return original.apply(this,args);};}
for(const key of ['readFileSync','readFile','openSync','open','readSync','read','createReadStream','statSync','stat','readdirSync','readdir'])wrap(fs,key,'fs.'+key);
for(const key of ['readFile','open','stat','readdir'])wrap(fs.promises,key,'fs.promises.'+key);
syncBuiltinESMExports();process.on('exit',()=>{if(output)write(output,JSON.stringify({diagnostic:'public filesystem API calls with submitted-workspace frames; not all bypasses are covered',calls},null,2)+'\n');});
