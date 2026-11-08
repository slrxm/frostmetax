"""Fetch daily STRATZ snapshots; never replace valid statistics with empty data."""
import datetime as dt
import hashlib
import json
import os
import pathlib
import time
import urllib.error
import urllib.request

OUT = pathlib.Path(__file__).resolve().parent.parent / 'data.json'
STATUS = OUT.with_name('meta-status.json')
BRACKETS = [('HERALD,GUARDIAN', 'Herald–Guardian'), ('CRUSADER,ARCHON', 'Crusader–Archon'),
            ('LEGEND,ANCIENT', 'Legend–Ancient'), ('DIVINE', 'Divine'), ('IMMORTAL', 'Immortal')]
POSITIONS = [('POSITION_1', 'Pos 1 · Carry'), ('POSITION_2', 'Pos 2 · Mid'), ('POSITION_3', 'Pos 3 · Offlane'),
             ('POSITION_4', 'Pos 4 · Soft Support'), ('POSITION_5', 'Pos 5 · Hard Support')]


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def gql(query):
    token = os.getenv('STRATZ_TOKEN')
    if not token:
        raise RuntimeError('STRATZ_TOKEN is missing; previous data retained')
    for attempt in range(4):
        try:
            req = urllib.request.Request('https://api.stratz.com/graphql', json.dumps({'query': query}).encode(),
                {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'User-Agent': 'STRATZ_API'})
            with urllib.request.urlopen(req, timeout=40) as response:
                result = json.load(response)
            if result.get('errors'):
                raise RuntimeError('STRATZ GraphQL: ' + json.dumps(result['errors'])[:800])
            if not result.get('data'):
                raise RuntimeError('STRATZ returned no data')
            return result['data']
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise RuntimeError(f'STRATZ HTTP {error.code}') from error
            delay = min(int(error.headers.get('Retry-After', 5 * 2 ** attempt)), 60)
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == 3:
                raise RuntimeError('STRATZ network failure') from error
            delay = 5 * 2 ** attempt
        time.sleep(delay)
    raise RuntimeError('STRATZ unavailable')


def aggregate(rows, names, old, same_window=True):
    totals = {}
    for row in rows:
        matches, wins = row['matchCount'], row['winCount']
        if matches < 0 or wins < 0 or wins > matches:
            raise ValueError('Invalid STRATZ counts')
        target = totals.setdefault(row['heroId'], [0, 0])
        target[0] += matches
        target[1] += wins
    total = sum(v[0] for v in totals.values())
    previous = {x['hero']: x for x in old}
    result = []
    for hid, (matches, wins) in sorted(totals.items()):
        if matches < 100 or hid not in names:
            continue
        wr = round(wins / matches * 100, 2)
        before = previous.get(names[hid]) if same_window else None
        # Keep the last meaningful trend if a polling run returns the same snapshot.
        trend = before.get('tr', 0) if before and before['wr'] == wr else round(wr - before['wr'], 2) if before else 0
        result.append({'heroId': hid, 'hero': names[hid], 'wr': wr,
                       'pr': round(matches / total * 100, 2), 'tr': trend, 'matches': matches})
    if not result:
        raise ValueError('Empty or undersized snapshot; previous slice retained')
    return result


def fingerprint(data):
    values = {k: [{f: x.get(f) for f in ('hero', 'wr', 'pr', 'matches')} for x in v] for k, v in data.items()}
    return hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()


def atomic_write(path, data):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    temp.replace(path)


def update():
    prev = json.loads(OUT.read_text()) if OUT.exists() else {}
    previous = prev.get('data', {}) if not prev.get('demo') else {}
    names = {h['id']: h['displayName'] for h in gql('{constants{heroes{id displayName}}}')['constants']['heroes']}
    data, failed, slice_updates = {}, [], dict(prev.get('sliceUpdatedAt', {}))
    slice_windows = dict(prev.get('sliceWindow', {}))
    checked = now()
    for bi, (bracket, _) in enumerate(BRACKETS):
        for pi, (position, _) in enumerate(POSITIONS):
            key = f'{bi}|{pi}'
            try:
                # winDay returns the latest daily snapshot. Weekly aggregates can stay fixed for days.
                query = '{heroStats{winDay(take:1,bracketIds:[%s],positionIds:[%s]){heroId matchCount winCount}}}' % (bracket, position)
                rows = gql(query)['heroStats']['winDay']
                data[key] = aggregate(rows, names, previous.get(key, []), slice_windows.get(key, prev.get('sourceWindow')) == 'day')
                slice_updates[key] = checked
                slice_windows[key] = 'day'
            except (RuntimeError, ValueError, KeyError, TypeError) as error:
                print(f'Slice {key} failed: {error}', flush=True)
                failed.append(key)
                data[key] = previous.get(key, [])
            time.sleep(.3)
    if len(failed) == len(BRACKETS) * len(POSITIONS):
        raise RuntimeError('All slices failed; previous data retained')
    unchanged = fingerprint(data) == fingerprint(previous)
    changed_at = (prev.get('dataUpdatedAt') or prev.get('updated')) if unchanged else checked
    result = {'updated': changed_at, 'dataUpdatedAt': changed_at, 'checkedAt': checked,
              'source': 'STRATZ', 'sourceWindow': 'day', 'unchanged': unchanged, 'failedSlices': failed,
              'sliceWindow': slice_windows, 'sliceUpdatedAt': slice_updates, 'demo': False, 'ranks': [x[1] for x in BRACKETS],
              'roles': [x[1] for x in POSITIONS], 'data': data}
    atomic_write(OUT, result)
    atomic_write(STATUS, {'checkedAt': checked, 'ok': not failed, 'failedSlices': failed, 'unchanged': unchanged})
    print(f'Updated {25-len(failed)}/25 slices; unchanged={unchanged}', flush=True)
    if failed:
        raise RuntimeError('Partial update; see failedSlices in data.json')


if __name__ == '__main__':
    try:
        update()
    except Exception as error:
        # Status remains visible even if authentication or the entire upstream API failed.
        atomic_write(STATUS, {'checkedAt': now(), 'ok': False, 'error': str(error)[:500]})
        raise
