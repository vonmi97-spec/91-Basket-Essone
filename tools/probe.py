import json, urllib.request
UA={"User-Agent":"okhttp/4.12.0","Accept":"application/json"}
cfg=json.loads(urllib.request.urlopen(urllib.request.Request("https://api.ffbb.app/items/configuration",headers=UA)).read())["data"]
def ms(q):
    req=urllib.request.Request("https://meilisearch-prod.ffbb.app/multi-search",data=json.dumps({"queries":q}).encode(),headers={**UA,"Authorization":"Bearer "+cfg["key_ms"],"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(req).read())["results"]
r=ms([{"indexUid":"ffbbserver_rencontres","q":"","limit":1000,"filter":['competitionId.id = "200000002897519"','idPoule.nom = "Poule A"']}])[0]
print("poule matches", r.get("estimatedTotalHits"), len(r["hits"]), "joues", sum(1 for h in r["hits"] if h.get("joue")))
print("sample", [(h["nomEquipe1"],h.get("resultatEquipe1"),h["nomEquipe2"],h.get("resultatEquipe2")) for h in r["hits"][:4]])
