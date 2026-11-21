import json, urllib.request, time, datetime
UA={"User-Agent":"okhttp/4.12.0","Accept":"application/json"}
def get(u,h={}):
    r=urllib.request.urlopen(urllib.request.Request(u,headers={**UA,**h}),timeout=30); return json.loads(r.read())
def ms(queries,tok):
    req=urllib.request.Request("https://meilisearch-prod.ffbb.app/multi-search",data=json.dumps({"queries":queries}).encode(),
        headers={**UA,"Authorization":"Bearer "+tok,"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(req,timeout=30).read())["results"]
cfg=get("https://api.ffbb.app/items/configuration")["data"]
kms,kdh=cfg["key_ms"],cfg["key_dh"]; print("tokens ok", bool(kms), bool(kdh))
o=ms([{"indexUid":"ffbbserver_organismes","q":"comite essonne","limit":10}],kms)[0]["hits"]
print("ORGANISMES:", [(h.get("id"),h.get("nom"),h.get("type"),h.get("code")) for h in o])
now=time.time(); a=int(now-21*86400); b=int(now+7*86400)
f=f"(date_rencontre_timestamp >= {a} AND date_rencontre_timestamp <= {b}) OR (date_rencontre_timestamp >= {a*1000} AND date_rencontre_timestamp <= {b*1000})"
r=ms([{"indexUid":"ffbbserver_rencontres","q":"","limit":0,"filter":[f],"facets":["organisateur.nom","organisateur.id"]}],kms)[0]
fd=r.get("facetDistribution",{}); print("TOTAL period", r.get("estimatedTotalHits"))
print("ORG ESSONNE facets:", {k:v for k,v in fd.get("organisateur.nom",{}).items() if "ESSON" in k.upper() or "91" in k}, "nb orgs", len(fd.get("organisateur.nom",{})))
for h in o:
    if "ESSONNE" in (h.get("nom") or "").upper():
        rr=ms([{"indexUid":"ffbbserver_rencontres","q":"","limit":2,"filter":[f,f'organisateur.id = "{h["id"]}"']}],kms)[0]
        print("BY ID",h["id"],"->",rr.get("estimatedTotalHits"))
        if rr["hits"]:
            x=rr["hits"][0]
            print("SAMPLE KEYS", sorted(x.keys()))
            for k in ["date_rencontre","date_rencontre_timestamp","horaire","nomEquipe1","nomEquipe2","resultatEquipe1","joue","numeroJournee","organisateur","idPoule","salle","competitionId","idOrganismeEquipe1","idEngagementEquipe1","_geo","sexe","niveau"]:
                print(" ",k,"=",json.dumps(x.get(k),ensure_ascii=False)[:400])
            pid=(x.get("idPoule") or {}).get("id")
            if pid:
                fields=["id","nom","classements.position","classements.points","classements.matchJoues","classements.gagnes","classements.perdus","classements.difference","classements.organisme_nom","classements.organisme.id","classements.organisme.nom","classements.organisme.logo.id","classements.idEngagement.nom","classements.idEngagement.id","classements.horsClassement"]
                u=f"https://api.ffbb.app/items/ffbbserver_poules/{pid}?"+"&".join("fields[]="+fl for fl in fields)+"&deep[classements][_limit]=100"
                try:
                    d=get(u,{"Authorization":"Bearer "+kdh})["data"]; print("POULE", d.get("nom"), json.dumps((d.get("classements") or [])[:2],ensure_ascii=False)[:800])
                except Exception as e: print("POULE ERR", e, getattr(e,'read',lambda:b'')()[:300])
            lg=(x.get("idOrganismeEquipe1") or {}).get("logo"); lid=lg.get("id") if isinstance(lg,dict) else lg
            if lid:
                for tok in [None,kdh]:
                    u=f"https://api.ffbb.app/assets/{lid}?width=120&height=120&fit=contain&format=png"+(f"&access_token={kdh}" if tok else "")
                    try: rq=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=20); print("LOGO", "tok" if tok else "no-tok", rq.status, rq.headers.get("content-type"))
                    except Exception as e: print("LOGO ERR", "tok" if tok else "no-tok", e)
        break
import ssl,socket
s=ssl.create_default_context().wrap_socket(socket.socket(),server_hostname="api.ffbb.app"); s.connect(("api.ffbb.app",443))
print("CERT issuer", dict(x[0] for x in s.getpeercert()["issuer"]))
