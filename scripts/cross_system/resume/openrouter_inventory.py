import json,urllib.request
from pathlib import Path
home=Path.home();auth=json.loads((home/'.local/share/opencode/auth.json').read_text())
req=urllib.request.Request('https://openrouter.ai/api/v1/models',headers={'Authorization':'Bearer '+auth['openrouter']['key']})
with urllib.request.urlopen(req,timeout=20) as response:data=json.load(response)
ids=['openai/gpt-4.1-mini','openai/gpt-5-mini','openai/gpt-5.4-mini']
selected=[{k:r.get(k) for k in ['id','name','context_length','supported_parameters']} for r in data['data'] if r.get('id') in ids]
result={'provider':'openrouter','models':selected,'credential_relocated':False}
p=Path(__file__).resolve().parents[3]/'experiments/cross-system-20261019/connection-review/openrouter-models.json';p.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
