# -*- coding: utf-8 -*-
import sys, os, re
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', errors='replace', buffering=1)
import fitz

grades = {
  'P1': r'c:\Users\MSI\Downloads\P1 revised Pupils Books  and Teachers Guides 2025-20260326\PB',
  'P2': r'c:\Users\MSI\Downloads\P2 revised Pupils books B and Teachers Guides  2025-20260326\PB',
  'P3': r'c:\Users\MSI\Downloads\P3 revised Pupils Books  and Teachers Guides 2025-20260326\PB',
  'P4': r'c:\Users\MSI\Downloads\P4 revised Pupils Books  and Teachers Guides  2025-20260326\PB',
  'P5': r'c:\Users\MSI\Downloads\P5 revised  Pupils Books  and Teachers Guides  2025-20260326\PB',
  'P6': r'c:\Users\MSI\Downloads\P6 revised Pupils Books and Teachers Guides 2025-20260326\PB',
}

unit_pat = re.compile(r'UNIT\s+\d+\s*[:\-]?\s*.{3,80}', re.IGNORECASE)
chapter_pat = re.compile(r'(?:Chapter|CHAPTER|Umutwe|UMUTWE)\s+\w+\s*[:\-]?\s*.{3,60}', re.IGNORECASE)

for grade, folder in grades.items():
    print(f'\n===== {grade} =====')
    for fname in sorted(os.listdir(folder)):
        if not fname.endswith('.pdf'):
            continue
        path = os.path.join(folder, fname)
        doc = fitz.open(path)
        # collect all unit lines from first 20 pages
        units = []
        for i in range(min(20, doc.page_count)):
            text = doc[i].get_text()
            for m in unit_pat.finditer(text):
                line = m.group(0).strip().replace('\n', ' ')[:100]
                if line not in units:
                    units.append(line)
            for m in chapter_pat.finditer(text):
                line = m.group(0).strip().replace('\n', ' ')[:100]
                if line not in units:
                    units.append(line)
        subject = fname.replace('.pdf','').replace('(1)','').replace('(2)','').strip()
        if units:
            print(f'\n  [{subject}]')
            for u in units[:30]:
                print(f'    - {u}')
        doc.close()
