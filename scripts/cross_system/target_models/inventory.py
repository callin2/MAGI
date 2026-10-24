"""Read-only use of existing Codex account/model inventory; never refresh or copy auth."""
import json,urllib.request,urllib.error
from pathlib import Path
from datetime import datetime,timezone
home=Path.home();auth=json.loads((home/'.codex/auth.json').read_text());tokens=auth.get('tokens',{})
headers={'Authorization':'Bearer '+tokens['access_token'],'chatgpt-account-id':tokens['account_id'],'User-Agent':'codex_cli_rs/0.162.1','originator':'codex_cli_rs'}
url='https://chatgpt.com/backend-api/codex/models?client_version=0.162.1'
result={'checked_at':datetime.now(timezone.utc).isoformat(),'provider':'existing-codex-chatgpt','read_only':True,'auth_refreshed':False,'credentials_relocated':False}
try:
 with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=25) as response:
  d=json.load(response);result['status']=response.status
  result['models']=[{k:m.get(k) for k in ['slug','display_name','visibility','supported_in_api','default_reasoning_level','supported_reasoning_levels']} for m in d.get('models',[]) if any(m.get('slug','').endswith('-'+family) for family in ['luna','terra','sol'])]
except urllib.error.HTTPError as e:result.update(status=e.code,error='HTTP '+str(e.code))
except Exception as e:result.update(status=None,error=type(e).__name__)
p=Path(__file__).resolve().parents[3]/'experiments/cross-system-target-models-20261019/inventory.json';p.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
