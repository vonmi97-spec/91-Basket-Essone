import urllib.request, re
UA={"User-Agent":"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36","Accept":"text/html"}
for u in ["https://www.ffbb.com/","https://competitions.ffbb.com/","https://www.ffbb.com/competitions","https://www.ffbb.com/ligues/idf/comites/0091/competitions","https://www.ffbb.com/competitions/dmu13-2"]:
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=20); h=r.read().decode("utf8","ignore")
        print("URL",u,r.status,r.geturl(),len(h))
        hrefs=sorted(set(re.findall(r'href="(/[^"#?]{3,120})"',h)))
        print("  HREFS", [x for x in hrefs if re.search(r'compet|poule|rencontre|club|resultat|ligue|comite|match',x)][:40])
        print("  NEXT", re.findall(r'"(/[a-z\-]+/\[[^"]+)"',h)[:20])
    except Exception as e: print("URL",u,"ERR",e)
