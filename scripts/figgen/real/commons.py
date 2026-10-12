"""Wikimedia Commons: search for files and read their licence, author and size (spec 5.3, step 1)."""
from __future__ import annotations

import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "StudySquareFigureLibrary/0.1 (https://www.studysquare.org)"
FIELDS = "LicenseShortName|LicenseUrl|Artist|Credit|ImageDescription|AttributionRequired|Restrictions|UsageTerms"


def search_url(term: str, limit: int = 25) -> str:
    params = {
        "action": "query", "format": "json", "formatversion": "2", "generator": "search",
        "gsrsearch": f"{term} filetype:bitmap|drawing", "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo|categories", "cllimit": "max", "clshow": "!hidden",
        "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "1280", "iiextmetadatafilter": FIELDS,
    }
    return API + "?" + urllib.parse.urlencode(params)


def plain(text) -> str:
    """One of Wikimedia's HTML fields as plain text."""
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", str(text or ""))).split())


def parse_search(data: dict, term: str) -> list[dict]:
    out = []
    for page in (data.get("query") or {}).get("pages", []):
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata") or {}

        def value(key: str) -> str:
            return plain((meta.get(key) or {}).get("value", ""))

        out.append({
            "pageid": page["pageid"], "title": page["title"], "term": term,
            "width": int(info.get("width") or 0), "height": int(info.get("height") or 0), "mime": info.get("mime", ""),
            "thumb": info.get("thumburl") or info.get("url", ""), "page": info.get("descriptionurl", ""),
            "licence": value("LicenseShortName"), "licence_url": value("LicenseUrl"), "author": value("Artist")[:160],
            "description": value("ImageDescription")[:500], "restrictions": value("Restrictions"),
            "categories": [c["title"].removeprefix("Category:") for c in page.get("categories", [])],
        })
    return out


class Fetcher:
    """One request at a time, at least `gap` seconds apart, backing off when Wikimedia is busy."""

    def __init__(self, gap: float = 0.25):
        self.gap, self.last = gap, 0.0

    def _get(self, url: str) -> bytes:
        for attempt in range(4):
            wait = self.last + self.gap - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=60) as res:
                    return res.read()
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                    time.sleep(2 * 2 ** attempt)
                    continue
                raise
            except (TimeoutError, urllib.error.URLError, ConnectionError):
                # A slow or dropped connection is retried like a busy server.
                if attempt < 3:
                    time.sleep(2 * 2 ** attempt)
                    continue
                raise
            finally:
                self.last = time.monotonic()
        raise RuntimeError(f"Gave up on {url}")

    def json(self, url: str) -> dict:
        return json.loads(self._get(url))

    def bytes(self, url: str) -> bytes:
        return self._get(url)
