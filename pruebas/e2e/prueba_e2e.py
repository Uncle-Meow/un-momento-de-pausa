"""Lanzador de compatibilidad. El recorrido actualizado está en recorrido.mjs (Node 24+)."""
from pathlib import Path
import subprocess
import os
import sys

if len(sys.argv) > 1:
    os.environ["PAUSA_QADIR"] = str(Path(sys.argv[1]).resolve())
raise SystemExit(subprocess.call(["node", str(Path(__file__).with_name("recorrido.mjs"))]))
