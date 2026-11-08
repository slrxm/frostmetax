import importlib.util
import pathlib
import unittest
from unittest.mock import patch
import tempfile
import json

spec = importlib.util.spec_from_file_location('updater', pathlib.Path(__file__).parents[1] / 'scripts/update.py')
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)


class UpdateTests(unittest.TestCase):
    def test_same_snapshot_keeps_meaningful_trend(self):
        old = [{'hero': 'Axe', 'wr': 55.0, 'tr': 1.25}]
        got = u.aggregate([{'heroId': 2, 'matchCount': 200, 'winCount': 110}], {2: 'Axe'}, old)
        self.assertEqual(got[0]['tr'], 1.25)
        self.assertEqual(got[0]['matches'], 200)

    def test_empty_and_corrupt_counts_do_not_overwrite(self):
        for rows in [[], [{'heroId': 2, 'matchCount': 200, 'winCount': 210}]]:
            with self.assertRaises(ValueError):
                u.aggregate(rows, {2: 'Axe'}, [])

    def test_new_window_does_not_compare_week_to_day(self):
        got = u.aggregate([{'heroId': 2, 'matchCount': 200, 'winCount': 110}], {2: 'Axe'}, [{'hero': 'Axe', 'wr': 30}], False)
        self.assertEqual(got[0]['tr'], 0)

    def test_total_failure_preserves_file(self):
        with tempfile.TemporaryDirectory() as directory:
            out = pathlib.Path(directory) / 'data.json'
            original = json.dumps({'data': {'0|0': [{'hero': 'Axe', 'wr': 52, 'pr': 4}]}})
            out.write_text(original)
            def fake(query):
                if 'constants' in query:
                    return {'constants': {'heroes': [{'id': 2, 'displayName': 'Axe'}]}}
                return {'heroStats': {'winDay': []}}
            with patch.object(u, 'OUT', out), patch.object(u, 'gql', fake), patch.object(u.time, 'sleep'):
                with self.assertRaises(RuntimeError):
                    u.update()
            self.assertEqual(out.read_text(), original)

    def test_identical_daily_snapshot_preserves_data_timestamp(self):
        with tempfile.TemporaryDirectory() as directory:
            out = pathlib.Path(directory) / 'data.json'
            rows = [{'heroId': 2, 'matchCount': 200, 'winCount': 110}]
            data = {f'{b}|{p}': u.aggregate(rows, {2: 'Axe'}, []) for b in range(5) for p in range(5)}
            out.write_text(json.dumps({'data': data, 'sourceWindow': 'day', 'dataUpdatedAt': '2026-11-06T00:00:00Z'}))
            def fake(query):
                return {'constants': {'heroes': [{'id': 2, 'displayName': 'Axe'}]}} if 'constants' in query else {'heroStats': {'winDay': rows}}
            with patch.object(u, 'OUT', out), patch.object(u, 'STATUS', pathlib.Path(directory) / 'status.json'), patch.object(u, 'gql', fake), patch.object(u.time, 'sleep'):
                u.update()
            result = json.loads(out.read_text())
            self.assertTrue(result['unchanged'])
            self.assertEqual(result['dataUpdatedAt'], '2026-11-06T00:00:00Z')
            self.assertNotEqual(result['checkedAt'], result['dataUpdatedAt'])
