import sys
from pathlib import Path

# figgen lives in scripts/; make "import figgen" work from anywhere pytest is run.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
