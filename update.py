"""Ежедневное обновление меты Dota 2 из STRATZ GraphQL -> data.json"""
import json, os, time, pathlib, datetime, urllib.request

TOKEN = os.environ["STRATZ_TOKEN"]
URL = "https://api.stratz.com/graphql"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data.json"
MIN_GAMES = 100
BRACKETS = [("HERALD_GUARDIAN", "Herald–Guardian"), ("CRUSADER_ARCHON", "Crusader–Archon"),
            ("LEGEND_ANCIENT", "Legend–Ancient"), ("DIVINE_IMMORTAL", "Divine–Immortal")]
POSITIONS = [("POSITION_1", "Pos 1 · Carry"), ("POSITION_2", "Pos 2 · Mid"), ("POSITION_3", "Pos 3 · Offlane"),
             ("POSITION_4", "Pos 4 · Soft Support"), ("POSITION_5", "Pos 5 · Hard Support")]

def gql(query):
    req = urllib.request.Request(URL, json.dumps({"query": query}).encode(), {
        "Content-Type": "application/json", "Authorization": "Bearer " + TOKEN, "User-Agent": "STRATZ_API"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    if d.get("errors"):
        raise SystemExit("STRATZ error: " + json.dumps(d["errors"])[:900])
    return d["data"]

names = {h["id"]: h["displayName"] for h in gql("{constants{heroes{id displayName}}}")["constants"]["heroes"]}

old = {}
if OUT.exists():
    try:
        prev = json.loads(OUT.read_text(encoding="utf-8"))
        if not prev.get("demo"):
            old = {k: {x["hero"]: x["wr"] for x in v} for k, v in prev["data"].items()}
    except Exception:
        pass

data = {}
for bi, (b, _) in enumerate(BRACKETS):
    for pi, (p, _) in enumerate(POSITIONS):
        rows = gql("{heroStats{winWeek(take:1,bracketIds:[%s],positionIds:[%s]){heroId matchCount winCount}}}"
                   % (b, p))["heroStats"]["winWeek"]
        agg = {}
        for r in rows:
            a = agg.setdefault(r["heroId"], [0, 0]); a[0] += r["matchCount"]; a[1] += r["winCount"]
        total = sum(m for m, _ in agg.values()) or 1
        key, out = f"{bi}|{pi}", []
        for hid, (m, w) in agg.items():
            if m < MIN_GAMES or hid not in names:
                continue
            wr = w / m * 100
            prev_wr = old.get(key, {}).get(names[hid])
            out.append({"hero": names[hid], "wr": round(wr, 2), "pr": round(m / total * 100, 2),
                        "tr": round(wr - prev_wr, 2) if prev_wr is not None else 0})
        data[key] = out
        time.sleep(1)  # бережём лимиты API

OUT.write_text(json.dumps({"updated": datetime.date.today().isoformat(), "demo": False,
    "ranks": [r for _, r in BRACKETS], "roles": [r for _, r in POSITIONS], "data": data},
    ensure_ascii=False), encoding="utf-8")
print("OK:", sum(len(v) for v in data.values()), "строк")
