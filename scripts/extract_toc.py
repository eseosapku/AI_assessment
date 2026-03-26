# -*- coding: utf-8 -*-
import sys, os
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

for grade, folder in grades.items():
    print(f'\n===== {grade} =====')
    for fname in sorted(os.listdir(folder)):
        if not fname.endswith('.pdf'):
            continue
        path = os.path.join(folder, fname)
        doc = fitz.open(path)
        print(f'\n-- {fname} ({doc.page_count}p) --')
        for i in range(min(12, doc.page_count)):
            text = doc[i].get_text().strip()
            upper = text.upper()
            if 'UNIT' in upper or 'TABLE' in upper or 'CONTENT' in upper or 'CHAPTER' in upper:
                print(text[:1200])
                break
        doc.close()
