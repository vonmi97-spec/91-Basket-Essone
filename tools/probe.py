import urllib.request, re, sys
UA={"User-Agent":"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36","Accept":"text/html"}
B="https://competitions.ffbb.com"
def get(p):
    try:
        r=urllib.request.urlopen(urllib.request.Request(B+p,headers=UA),timeout=25); return r.status, r.read().decode("utf8","ignore")
    except urllib.error.HTTPError as e: return e.code, ""
s,h=get("/ligues/idf/comites/0091/competitions/prm")
print("PRM", s, sorted(set(x for x in re.findall(r'href="(/[^"#]{3,200})"',h) if "prm" in x or "0091" in x))[:30])
print("QS", sorted(set(re.findall(r'[?&](poule|phase|journee|tab)=[^"&]*',h)))[:10])
for p in ["/ligues/idf/comites/0091/competitions/prm/match/200000014670742","/ligues/idf/comites/0091/competitions/prm/classement","/ligues/idf/comites/0091/competitions/prm?poule=200000003055155","/competitions/prm/match/200000014670742"]:
    s,h=get(p); m=re.search(r"<title>(.*?)</title>",h); print("P",p,s,len(h), m.group(1)[:120] if m else "")
