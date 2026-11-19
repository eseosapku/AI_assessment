# Parse Chrome --dump-dom HTML and list visible copy plus control names.
import sys
from html.parser import HTMLParser
from pathlib import Path

SKIP_TAGS = {"script", "style", "noscript", "template"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.stack = []
        self.text_parts = []
        self.controls = []
        self.current = None
        self.labels = []  # (for_id, text)
        self.label_stack = []
        self.html_lang = None
        self.title_parts = []
        self.in_title = False
        self.svgs = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        ad = {k.lower(): (v if v is not None else "") for k, v in attrs}
        if tag == "html" and "lang" in ad:
            self.html_lang = ad["lang"]
        if tag in SKIP_TAGS:
            self.skip += 1
            self.stack.append(tag)
            return
        if self.skip:
            self.stack.append(tag)
            return
        if tag == "title":
            self.in_title = True
        if tag == "svg":
            self.svgs += 1
        if tag == "label":
            self.label_stack.append({"for": ad.get("for", ""), "text": []})
        if tag in {"button", "a", "input", "textarea", "select"}:
            if self.current and self.current["tag"] in VOID:
                self._flush_current()
            self.current = {
                "tag": tag,
                "attrs": ad,
                "text": [],
                "depth": len(self.stack),
            }
            if tag in VOID:
                self.stack.append(tag)
                self._flush_current()
                return
        self.stack.append(tag)
        if tag == "br":
            self.text_parts.append("\n")
            if self.current:
                self.current["text"].append(" ")
            if self.label_stack:
                self.label_stack[-1]["text"].append(" ")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self.stack:
            # pop until matching, tolerating junk
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i] == tag:
                    del self.stack[i:]
                    break
        if tag in SKIP_TAGS and self.skip:
            self.skip -= 1
            return
        if self.skip:
            return
        if tag == "title":
            self.in_title = False
        if tag == "label" and self.label_stack:
            lab = self.label_stack.pop()
            text = " ".join("".join(lab["text"]).split())
            self.labels.append((lab["for"], text))
        if self.current and tag == self.current["tag"] and len(self.stack) <= self.current["depth"]:
            self._flush_current()
        if tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "section", "header", "footer", "tr"}:
            self.text_parts.append("\n")

    def _flush_current(self):
        if not self.current:
            return
        text = " ".join("".join(self.current["text"]).split())
        ad = self.current["attrs"]
        self.controls.append(
            {
                "tag": self.current["tag"],
                "type": ad.get("type", ""),
                "id": ad.get("id", ""),
                "name": ad.get("name", ""),
                "text": text,
                "aria": ad.get("aria-label", ""),
                "aria_labelledby": ad.get("aria-labelledby", ""),
                "title": ad.get("title", ""),
                "placeholder": ad.get("placeholder", ""),
                "alt": ad.get("alt", ""),
                "href": ad.get("href", ""),
                "role": ad.get("role", ""),
                "hidden": ad.get("aria-hidden", ""),
                "value": ad.get("value", "") if self.current["tag"] != "input" or ad.get("type") in {"button", "submit", "reset"} else "",
            }
        )
        self.current = None

    def handle_data(self, data):
        if self.skip:
            return
        if self.in_title:
            self.title_parts.append(data)
        if data.strip():
            self.text_parts.append(data)
            if self.current:
                self.current["text"].append(data)
            if self.label_stack:
                self.label_stack[-1]["text"].append(data)


def main(path):
    raw = Path(path).read_text(encoding="utf-8", errors="replace")
    # Chrome dump-dom may prefix a blank or BOM
    p = Extractor()
    p.feed(raw)
    print("FILE", path)
    print("LANG", p.html_lang)
    print("TITLE", " ".join("".join(p.title_parts).split()))
    print("SVG_COUNT", p.svgs)
    print("\n=== VISIBLE TEXT ===")
    text = "".join(p.text_parts)
    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    # de-dupe consecutive
    out = []
    for ln in lines:
        if not out or out[-1] != ln:
            out.append(ln)
    print("\n".join(out))
    print("\n=== LABELS ===")
    for fid, text in p.labels:
        print(f"for={fid!r} text={text!r}")
    print("\n=== CONTROLS ===")
    label_by_for = {}
    for fid, text in p.labels:
        if fid:
            label_by_for[fid] = text
    for c in p.controls:
        linked = label_by_for.get(c["id"], "") if c["id"] else ""
        acc = c["aria"] or c["text"] or c["title"] or c["alt"] or c["value"] or linked or ""
        flag = ""
        if c["tag"] in {"button", "a"} and not acc and not c["aria_labelledby"]:
            flag = " ** NO_ACCESSIBLE_NAME **"
        if c["tag"] in {"input", "textarea", "select"} and c["type"] not in {"hidden", "submit", "button", "reset"}:
            if not (c["aria"] or c["title"] or linked or c["aria_labelledby"]):
                flag = " ** NO_LABEL **"
                if c["placeholder"]:
                    flag += " PLACEHOLDER_ONLY"
        print(
            f"{c['tag']} type={c['type']!r} id={c['id']!r} name={c['name']!r} "
            f"text={c['text']!r} aria={c['aria']!r} title={c['title']!r} "
            f"placeholder={c['placeholder']!r} alt={c['alt']!r} href={c['href']!r} "
            f"labelledby={c['aria_labelledby']!r} linked_label={linked!r}{flag}"
        )


if __name__ == "__main__":
    for path in sys.argv[1:]:
        main(path)
        print("\n" + ("#" * 80) + "\n")
