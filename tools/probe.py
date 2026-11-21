import json, urllib.request, urllib.parse
UA={"User-Agent":"okhttp/4.12.0","Accept":"application/json"}
def get(u,h={}):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers={**UA,**h}),timeout=30); return r.status, r.read()[:700]
    except urllib.error.HTTPError as e: return e.code, e.read()[:200]
cfg=json.loads(get("https://api.ffbb.app/items/configuration")[1] if False else urllib.request.urlopen(urllib.request.Request("https://api.ffbb.app/items/configuration",headers=UA)).read())["data"]
dh=cfg["key_dh"]; A={"Authorization":"Bearer "+dh}
pid="200000003055155"; B="https://api.ffbb.app/items/ffbbserver_poules/"+pid
tests={
 "no fields auth": (B,A),
 "no fields noauth": (B,{}),
 "fields id,nom": (B+"?fields[]=id&fields[]=nom",A),
 "fields classements.*": (B+"?fields[]=id&fields[]=classements.*",A),
 "fields encoded": (B+"?"+urllib.parse.urlencode([("fields[]","id"),("fields[]","classements.position"),("fields[]","classements.points"),("fields[]","classements.organisme_nom")]),A),
 "deep encoded": (B+"?"+urllib.parse.urlencode([("fields[]","id"),("fields[]","classements.position"),("deep[classements][_limit]","100")]),A),
 "access_token qs": (B+"?fields[]=id&fields[]=classements.position&access_token="+dh,{}),
 "classements collection": ("https://api.ffbb.app/items/ffbbserver_classements?limit=2&filter[idPoule][_eq]="+pid,A),
 "UA browser": (B+"?fields[]=id&fields[]=classements.position",{**A,"User-Agent":"Mozilla/5.0"}),
}
for k,(u,h) in tests.items():
    s,b=get(u,h); print(k,"->",s,b[:300])
