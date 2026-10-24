"""Read only existing configured connections, never export or relocate credentials."""
import json,urllib.request,urllib.error
from pathlib import Path
from datetime import datetime,timezone
home=Path.home();cfg=json.loads((home/'.config/opencode/opencode.json').read_text());auth=json.loads((home/'.local/share/opencode/auth.json').read_text())
rows=[]
def probe(name,url,key=None):
 headers={'Accept':'application/json'}
 if key:headers['Authorization']='Bearer '+key
 result={'provider':name,'checked_at':datetime.now(timezone.utc).isoformat(),'read_only':True}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=12) as response:
   data=json.load(response);result['status']=response.status
   if isinstance(data,dict) and isinstance(data.get('data'),list):result['models']=[r.get('id') for r in data['data'] if isinstance(r,dict)]
   else:result['authenticated_read_succeeded']=True
 except urllib.error.HTTPError as e:result.update(status=e.code,error='HTTP '+str(e.code))
 except Exception as e:result.update(status=None,error=type(e).__name__)
 rows.append(result)
for name in ['lmstudio','openwebui']:
 p=cfg.get('provider',{}).get(name);key=auth.get(name,{}).get('key') or (p or {}).get('options',{}).get('apiKey')
 if p and p.get('options',{}).get('baseURL'):
  probe(name,p['options']['baseURL'].rstrip('/')+'/models',key)
if auth.get('openrouter',{}).get('type')=='api' and auth['openrouter'].get('key'):
 probe('openrouter','https://openrouter.ai/api/v1/key',auth['openrouter']['key'])
result={'existing_configured_providers':list(auth),'configured_custom_providers':list(cfg.get('provider',{})),'not_attempted':['zai (prior authentication denied; not retried)','OpenAI/GitHub OAuth (no token refresh or alternate credential use attempted)'],'probes':rows,'credential_values_output':False,'config_changed':False}
path=Path(__file__).resolve().parents[3]/'experiments/cross-system-20261019/connection-review/existing-connections.json';path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
