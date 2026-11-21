import json, urllib.request, time
UA={"User-Agent":"okhttp/4.12.0","Accept":"application/json"}
cfg=json.loads(urllib.request.urlopen(urllib.request.Request("https://api.ffbb.app/items/configuration",headers=UA)).read())["data"]
def ms(q):
    req=urllib.request.Request("https://meilisearch-prod.ffbb.app/multi-search",data=json.dumps({"queries":q}).encode(),headers={**UA,"Authorization":"Bearer "+cfg["key_ms"],"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(req).read())["results"]
keep=["id","date","date_rencontre","date_rencontre_timestamp","horaire","nomEquipe1","nomEquipe2","resultatEquipe1","resultatEquipe2","joue","numeroJournee","competitionId","idPoule","salle","idOrganismeEquipe1","idOrganismeEquipe2","_geo","organisateur"]
allh=[]; off=0
while True:
    r=ms([{"indexUid":"ffbbserver_rencontres","q":"","limit":500,"offset":off,"filter":['organisateur.id = "2114"']}])[0]
    h=r["hits"]; allh+=h
    if len(h)<500: break
    off+=500
out=[]
for h in allh:
    x={k:h.get(k) for k in keep}
    c=x.get("competitionId") or {}
    x["competitionId"]={k:c.get(k) for k in ["id","nom","code","sexe","categorie"]}
    s=x.get("salle") or {}
    x["salle"]={"libelle":s.get("libelle"),"adresse":s.get("adresse"),"cartographie":{k:(s.get("cartographie") or {}).get(k) for k in ["ville","codePostal"]}}
    for k in ["idOrganismeEquipe1","idOrganismeEquipe2"]:
        o=x.get(k) or {}; x[k]={"id":o.get("id"),"nom":o.get("nom"),"code":o.get("code")}
    out.append(x)
json.dump(out,open("snapshot.json","w"),ensure_ascii=False,separators=(",",":"))
print("N",len(out))
