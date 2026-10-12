import io

from PIL import Image
from pictures import picture

from figgen.real.commons import parse_search, search_url
from figgen.real.hashing import MIN_DISTANCE, dhash, distance
from figgen.real.rules import licence_ok, reject_reason


def candidate(**over):
    c = {"pageid": 1, "title": "File:Onion cells.jpg", "term": "onion cells", "width": 2000, "height": 1500,
         "mime": "image/jpeg", "thumb": "https://upload.wikimedia.org/x.jpg", "page": "https://commons.wikimedia.org/wiki/File:x",
         "licence": "CC BY-SA 4.0", "licence_url": "https://creativecommons.org/licenses/by-sa/4.0", "author": "A. Botanist",
         "description": "Onion epidermis", "restrictions": "", "categories": ["Onion cells", "Light microscopy micrographs"]}
    c.update(over)
    return c


def test_licences_on_the_whitelist():
    for name in ("CC BY 4.0", "CC BY-SA 3.0", "CC BY-SA 2.0 de", "CC0", "Public domain", "PD-US", "cc-by-sa-3.0"):
        assert licence_ok(name), name
    for name in ("CC BY-NC 4.0", "CC BY-ND 2.0", "GFDL", "Attribution", "", "Fair use"):
        assert not licence_ok(name), name


def test_reject_reason_keeps_a_good_file():
    assert reject_reason(candidate()) is None


def test_reject_reason_turns_away_what_cannot_be_used():
    assert reject_reason(candidate(licence="CC BY-NC 2.0")).startswith("licence")
    assert reject_reason(candidate(width=800, height=500)).startswith("too small")
    assert reject_reason(candidate(author="")) == "no author to credit"
    assert reject_reason(candidate(author="", licence="Public domain")) is None
    assert reject_reason(candidate(categories=["Portraits of scientists"])).startswith("category")
    assert reject_reason(candidate(categories=["Logos of universities"])).startswith("category")
    assert reject_reason(candidate(categories=["Specimens in museums"])) is None  # "men" inside a word is not people
    assert reject_reason(candidate(title="File:Plant cell structure-zh.jpg")) == "a translated copy"
    assert reject_reason(candidate(title="File:Onion cells x400 red.jpg")) is None
    assert reject_reason(candidate(title="File:Plant cell-en.jpg")) is None
    assert reject_reason(candidate(mime="image/gif")).startswith("file type")
    assert reject_reason(candidate(restrictions="trademarked")).startswith("restricted")


def test_dhash_matches_a_resized_copy_and_parts_different_images():
    a = picture(1)
    assert distance(dhash(a), dhash(a.resize((320, 240)))) < MIN_DISTANCE
    assert distance(dhash(a), dhash(picture(2))) >= MIN_DISTANCE


def test_dhash_matches_a_recompressed_copy():
    a = picture(3)
    buf = io.BytesIO()
    a.save(buf, "JPEG", quality=60)
    assert distance(dhash(a), dhash(Image.open(io.BytesIO(buf.getvalue())))) < MIN_DISTANCE


def test_search_url_asks_for_licence_size_and_categories():
    url = search_url("animal cell micrograph", 20)
    for part in ("generator=search", "filetype%3Abitmap", "gsrlimit=20", "extmetadata", "iiurlwidth=1280", "categories"):
        assert part in url


def test_parse_search_reads_licence_author_and_size():
    data = {"query": {"pages": [{
        "pageid": 42, "title": "File:Hydra micrograph.jpg",
        "imageinfo": [{"width": 2576, "height": 1932, "mime": "image/jpeg", "thumburl": "https://upload.wikimedia.org/t/1280px-h.jpg",
                       "url": "https://upload.wikimedia.org/h.jpg", "descriptionurl": "https://commons.wikimedia.org/wiki/File:Hydra_micrograph.jpg",
                       "extmetadata": {"LicenseShortName": {"value": "CC BY 4.0"}, "LicenseUrl": {"value": "https://creativecommons.org/licenses/by/4.0"},
                                       "Artist": {"value": '<a href="//commons.wikimedia.org/wiki/User:K">K&amp;ulawik</a>'},
                                       "ImageDescription": {"value": "Section of <i>Hydra</i>"}, "Restrictions": {"value": ""}}}],
        "categories": [{"title": "Category:Cells"}, {"title": "Category:Light microscopy micrographs"}]}]}}
    (c,) = parse_search(data, "cells")
    assert (c["pageid"], c["width"], c["height"], c["licence"]) == (42, 2576, 1932, "CC BY 4.0")
    assert c["author"] == "K&ulawik" and c["description"] == "Section of Hydra"
    assert c["thumb"].endswith("1280px-h.jpg") and c["page"].endswith("File:Hydra_micrograph.jpg")
    assert c["categories"] == ["Cells", "Light microscopy micrographs"] and c["term"] == "cells"


def test_parse_search_survives_an_empty_reply():
    assert parse_search({}, "x") == []


def test_reject_reason_keeps_a_vector_diagram():
    svg = candidate(mime="image/svg+xml", width=649, height=475, title="File:Plant cell structure-en.svg")
    assert reject_reason(svg) is None  # vector: any size renders sharp
    assert reject_reason(candidate(mime="image/svg+xml", title="File:Plant cell structure-zh.svg")) == "a translated copy"


def test_search_url_finds_diagrams_too():
    assert "filetype%3Abitmap%7Cdrawing" in search_url("plant cell diagram")


def test_reject_reason_catches_a_language_code_after_a_space():
    # "Animal cell structure tr.svg" carried Turkish labels past the rule.
    assert reject_reason(candidate(mime="image/svg+xml", title="File:Animal cell structure tr.svg")) == "a translated copy"
    assert reject_reason(candidate(title="File:Plant cell structure it.png")) == "a translated copy"
    assert reject_reason(candidate(title="File:Onion cells x400 red.jpg")) is None


def test_fetcher_retries_a_timeout(monkeypatch):
    # A read timeout from Wikimedia crashed a run; it is now retried like a busy server.
    import urllib.request
    from figgen.real import commons
    calls = []

    class Reply:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return b'{"ok": true}'

    def urlopen(req, timeout):
        calls.append(req.full_url)
        if len(calls) == 1:
            raise TimeoutError("The read operation timed out")
        return Reply()

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(commons.time, "sleep", lambda s: None)
    assert commons.Fetcher(gap=0).json("https://example.org/x") == {"ok": True}
    assert len(calls) == 2


def test_reject_reason_turns_away_scanned_book_pages():
    # The user (2026-10-12): no scanned pages of old books or catalogues, however good the drawing.
    for title in ("File:Chemical Supplies Apparatus Chemicals Books - DPLA - 4b1c.jpg",
                  "File:A manual of the anatomy of the vertebrated animals (Page 453) BHL33406999.jpg",
                  "File:Image from page 174 of \"On safari\" (1908).jpg",
                  "File:Cucurbita hand pollination page 78 of \"Luther Burbank\".jpg"):
        assert reject_reason(candidate(title=title)) == "a scanned book page", title
    assert reject_reason(candidate(categories=["Internet Archive book images"])) == "a scanned book page"
    assert reject_reason(candidate(title="File:Front page of a leaf.jpg")) is None
