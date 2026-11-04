"""Ежедневное обновление меты Dota 2 из STRATZ GraphQL -> data.json"""
import json, os, sys, time, pathlib, datetime, urllib.request, urllib.error

TOKEN = os.environ["STRATZ_TOKEN"]
URL = "https://api.stratz.com/graphql"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data.json"
MIN_GAMES = 100
RETRIES = 6
BRACKETS = [("HERALD,GUARDIAN", "Herald–Guardian"), ("CRUSADER,ARCHON", "Crusader–Archon"),
            ("LEGEND,ANCIENT", "Legend–Ancient"), ("DIVINE", "Divine"), ("IMMORTAL", "Immortal")]
POSITIONS = [("POSITION_1", "Pos 1 · Carry"), ("POSITION_2", "Pos 2 · Mid"), ("POSITION_3", "Pos 3 · Offlane"),
             ("POSITION_4", "Pos 4 · Soft Support"), ("POSITION_5", "Pos 5 · Hard Support")]


def gql(query):
    """Запрос к STRATZ с повторами при временных ошибках (403, 429, 5xx, сеть)."""
    body = json.dumps({"query": query}).encode()
    headers = {"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN,
               "User-Agent": "STRATZ_API"}
    last = ""
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(URL, body, headers)
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.load(r)
            if d.get("errors"):
                raise RuntimeError("STRATZ error: " + json.dumps(d["errors"])[:900] + "\nQUERY: " + query)
            return d["data"]
        except urllib.error.HTTPError as e:
            text = e.read().decode("utf-8", "replace")[:600]
            last = "HTTP %s: %s" % (e.code, text)
            if e.code not in (403, 429, 500, 502, 503, 504):
                raise RuntimeError(last + "\nQUERY: " + query)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = "network: %s" % e
        wait = min(5 * 2 ** attempt, 120)
        print("  попытка %d/%d не удалась (%s), жду %d c" % (attempt + 1, RETRIES, last[:120], wait), flush=True)
        time.sleep(wait)
    raise RuntimeError("Не удалось после %d попыток: %s" % (RETRIES, last))


# --- прошлые данные (для тренда и как запасной вариант) ---
prev_data, old_wr = {}, {}
if OUT.exists():
    try:
        prev = json.loads(OUT.read_text(encoding="utf-8"))
        if not prev.get("demo"):
            prev_data = prev.get("data", {})
            old_wr = {k: {x["hero"]: x["wr"] for x in v} for k, v in prev_data.items()}
    except Exception:
        pass

try:
    names = {h["id"]: h["displayName"] for h in gql("{constants{heroes{id displayName}}}")["constants"]["heroes"]}
except RuntimeError as e:
    sys.exit("Не получен список героев. Старые данные не тронуты.\n" + str(e))

data, ok, failed = {}, 0, []
for bi, (b, _) in enumerate(BRACKETS):
    for pi, (p, _) in enumerate(POSITIONS):
        key = f"{bi}|{pi}"
        try:
            rows = gql("{heroStats{winWeek(take:1,bracketIds:[%s],positionIds:[%s]){heroId matchCount winCount}}}"
                       % (b, p))["heroStats"]["winWeek"]
        except RuntimeError as e:
            print("ПРОПУСК", key, str(e)[:400], flush=True)
            failed.append(key)
            data[key] = prev_data.get(key, [])  # оставляем старые данные
            continue
        agg = {}
        for r in rows:
            a = agg.setdefault(r["heroId"], [0, 0])
            a[0] += r["matchCount"]
            a[1] += r["winCount"]
        total = sum(m for m, _ in agg.values()) or 1
        out = []
        for hid, (m, w) in agg.items():
            if m < MIN_GAMES or hid not in names:
                continue
            wr = w / m * 100
            prev_wr = old_wr.get(key, {}).get(names[hid])
            out.append({"hero": names[hid], "wr": round(wr, 2), "pr": round(m / total * 100, 2),
                        "tr": round(wr - prev_wr, 2) if prev_wr is not None else 0})
        data[key] = out
        ok += 1
        time.sleep(1)

if ok == 0:
    sys.exit("Ни один срез не загрузился. Старые данные не тронуты.")

OUT.write_text(json.dumps({"updated": datetime.date.today().isoformat(), "demo": False,
    "ranks": [r for _, r in BRACKETS], "roles": [r for _, r in POSITIONS], "data": data},
    ensure_ascii=False), encoding="utf-8")
print("OK: срезов %d из %d, строк %d, пропущено: %s" % (ok, len(BRACKETS) * len(POSITIONS),
      sum(len(v) for v in data.values()), failed or "нет"))
