import json, urllib.request, datetime
UA={"User-Agent":"okhttp/4.12.0","Accept":"application/json"}
cfg=json.loads(urllib.request.urlopen(urllib.request.Request("https://api.ffbb.app/items/configuration",headers=UA)).read())["data"]
def ms(q):
    req=urllib.request.Request("https://meilisearch-prod.ffbb.app/multi-search",data=json.dumps({"queries":q}).encode(),headers={**UA,"Authorization":"Bearer "+cfg["key_ms"],"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(req).read())["results"]
r=ms([{"indexUid":"ffbbserver_rencontres","q":"","limit":1000,"filter":['competitionId.id = "200000002897519"']}])[0]
print("comp total", r.get("estimatedTotalHits"))
for h in sorted(r["hits"],key=lambda h:h["date_rencontre"]): print(h["date_rencontre"][:10], h.get("numeroJournee"), h["idPoule"]["nom"], h.get("joue"))
r=ms([{"indexUid":"ffbbserver_rencontres","q":"","limit":3,"filter":['organisateur.id = "2114"'],"sort":["date_rencontre_timestamp:asc"]}])[0]
print("oldest essonne", [h["date_rencontre"] for h in r["hits"]], r.get("estimatedTotalHits"))
