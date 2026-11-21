import json, urllib.request
UA={"User-Agent":"okhttp/4.12.0","Accept":"application/json"}
def get(u,h={}):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers={**UA,**h}),timeout=30); return r.status, r.read()
    except urllib.error.HTTPError as e: return e.code, e.read()[:200]
s,b=get("https://api.ffbb.app/json/lives.json"); print("LIVES", s, len(b)); 
try:
    j=json.loads(b); print("type", type(j).__name__, (len(j) if hasattr(j,'__len__') else ''))
    items=j if isinstance(j,list) else j.get("data") or j
    if isinstance(items,list) and items: print("SAMPLE", json.dumps(items[0],ensure_ascii=False)[:1500])
    else: print(str(j)[:500])
except Exception as e: print("parse", e, b[:300])
cfg=json.loads(get("https://api.ffbb.app/items/configuration")[1])["data"]
req=urllib.request.Request("https://meilisearch-prod.ffbb.app/multi-search",data=json.dumps({"queries":[{"indexUid":"ffbbserver_rencontres","q":"","limit":3,"filter":['organisateur.id = "2114"','gsId.matchStatus EXISTS'],"facets":["gsId.matchStatus","gsId.currentStatus"]}]}).encode(),headers={**UA,"Authorization":"Bearer "+cfg["key_ms"],"Content-Type":"application/json"},method="POST")
try:
    r=json.loads(urllib.request.urlopen(req).read())["results"][0]
    print("GS facets", r.get("facetDistribution"), r.get("estimatedTotalHits"))
    for h in r["hits"][:2]: print("GSID", json.dumps(h.get("gsId"),ensure_ascii=False)[:800], h.get("id"))
except urllib.error.HTTPError as e: print("MS ERR", e.read()[:300])
