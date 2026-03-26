# -*- coding: utf-8 -*-
import sys, os, re
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', errors='replace', buffering=1)
import fitz

FOLDER = r'c:\Users\MSI\AI_Assessment\senior class'

unit_pat = re.compile(r'(?:UNIT|Unit)\s+\d+[\.\:]?\s*.{3,80}', re.IGNORECASE)
chapter_pat = re.compile(r'(?:Chapter|CHAPTER)\s+\w+[\.\:]?\s*.{3,60}', re.IGNORECASE)
topic_pat = re.compile(r'(?:Topic|TOPIC)\s+\d+[\.\:]?\s*.{3,60}', re.IGNORECASE)

files = sorted(f for f in os.listdir(FOLDER) if f.endswith('.pdf'))

for fname in files:
    path = os.path.join(FOLDER, fname)
    doc = fitz.open(path)
    units = []
    seen = set()
    for i in range(min(20, doc.page_count)):
        text = doc[i].get_text()
        for pat in (unit_pat, chapter_pat, topic_pat):
            for m in pat.finditer(text):
                line = m.group(0).strip().replace('\n', ' ')
                line = re.sub(r'\s+', ' ', line)[:100]
                # Remove page number artifacts
                line = re.sub(r'[\.\s]+\d+\s*$', '', line).strip()
                if len(line) > 6 and line not in seen:
                    seen.add(line)
                    units.append(line)
    print(f'\n[{fname} — {doc.page_count}p]')
    for u in units[:35]:
        print(f'  - {u}')
    doc.close()
