import json, urllib.request, time
UA={"User-Agent":"okhttp/4.12.0","Accept":"application/json"}
cfg=json.loads(urllib.request.urlopen(urllib.request.Request("https://api.ffbb.app/items/configuration",headers=UA)).read())["data"]
def ms(q):
    req=urllib.request.Request("https://meilisearch-prod.ffbb.app/multi-search",data=json.dumps({"queries":q}).encode(),headers={**UA,"Authorization":"Bearer "+cfg["key_ms"],"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(req).read())["results"]
now=int(time.time()*1000)
r=ms([{"indexUid":"ffbbserver_rencontres","q":"","limit":200,"filter":['organisateur.id = "2114"',f"date_rencontre_timestamp >= {now-3*3600*1000} AND date_rencontre_timestamp <= {now}"]}])[0]
print("EN COURS/RECENTS", r.get("estimatedTotalHits"))
for h in r["hits"][:6]:
    print(h["date_rencontre"], h["nomEquipe1"], h.get("resultatEquipe1"), "-", h.get("resultatEquipe2"), h["nomEquipe2"], "joue=",h.get("joue"), "gsId=", json.dumps(h.get("gsId"))[:200])
    print("   keys extra:", [k for k in h if any(w in k.lower() for w in ["live","score","statut","status","etat","gs","emarque","valid","forfait"])])
# national live check: any rencontre with gsId currently
r=ms([{"indexUid":"ffbbserver_rencontres","q":"","limit":3,"filter":['gsId.matchStatus EXISTS',f"date_rencontre_timestamp >= {now-3*3600*1000} AND date_rencontre_timestamp <= {now}"],"facets":["gsId.matchStatus","gsId.currentStatus","niveau"]}])[0]
print("GS NATIONAL", r.get("estimatedTotalHits"), r.get("facetDistribution"))
for h in r["hits"][:2]: print("  ", h["nomEquipe1"], h["nomEquipe2"], json.dumps(h.get("gsId"))[:600])
for u in ["https://api.ffbb.app/json/lives.json","https://api.ffbb.app/items/ffbbserver_lives"]:
    try: x=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=20); print("URL",u,x.status, x.read()[:300])
    except Exception as e: print("URL",u,"ERR",e)
