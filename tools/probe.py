import urllib.request, re, sys
UA={"User-Agent":"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36","Accept":"text/html"}
B="https://competitions.ffbb.com"
def get(p):
    try:
        r=urllib.request.urlopen(urllib.request.Request(B+p,headers=UA),timeout=25); return r.status, r.read().decode("utf8","ignore")
    except urllib.error.HTTPError as e: return e.code, ""
    except Exception as e: return str(e), ""
s,h=get("/competitions/nm1"); print("NM1",s, sorted(set(re.findall(r'href="(/[^"#?]{3,160})"',h)))[:25])
for p in ["/ligues/idf/comites/0091","/ligues/idf/comites/0091/competitions","/ligues/idf/comites/0091/competitions/CODE","/competitions/CODE","/ligues/idf/comites/0091/clubs/CLUB","/ligues/idf/comites/0091/competitions/CODE/poules/POULE"]:
    p=p.replace("CODE",sys.argv[1].lower()).replace("CLUB",sys.argv[2].lower()).replace("POULE",sys.argv[3])
    s,h=get(p); print("P",p,s,len(h), sorted(set(x for x in re.findall(r'href="(/[^"#?]{3,160})"',h) if re.search(r'rencontre|poule|competitions/|equipes|match',x)))[:15])
