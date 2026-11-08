"""Compatibility entry point: keep one authoritative updater."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).parent / 'scripts' / 'update.py'), run_name='__main__')
