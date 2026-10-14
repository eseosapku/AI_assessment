"""Reading the dataset's manifest: one JSON row per image, with its family, qualification, year, subtopic, params,
labels and file paths. The dataset is data only: nothing in it is run.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterator

# Where the user shared it (2026-10-15); FIGGEN_DATASET overrides.
DEFAULT_ROOT = Path("G:/.shortcut-targets-by-id/1hj0Tn1T99ZkM3ZnMTuJJskn15sXY7THs/images")


def root() -> Path:
    return Path(os.environ.get("FIGGEN_DATASET", str(DEFAULT_ROOT)))


def available() -> bool:
    return (root() / "dataset" / "manifest.jsonl").exists()


def rows(families: set[str] | None = None, limit: int | None = None) -> Iterator[dict]:
    """The manifest's rows, of the given families only, at most `limit` a family."""
    seen: dict[str, int] = {}
    with open(root() / "dataset" / "manifest.jsonl", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            fam = r["family"]
            if families is not None and fam not in families:
                continue
            if limit is not None and seen.get(fam, 0) >= limit:
                continue
            seen[fam] = seen.get(fam, 0) + 1
            yield r


def band_of(row: dict) -> str:
    """IGCSE is Upper Secondary; AS and A2 are A Level."""
    return "UP" if row["qualification"].lower() == "igcse" else "AL"
