# Exam source PDFs (WAEC & JAMB)

Drop past-question PDFs here, then run:

```bash
node scripts/import-exam-papers.js
node scripts/import-exam-papers.js --dry-run
```

## Folder layout

```
data/exam-sources/
  waec/
    Biology/
      2019-may-june.pdf
      2020-may-june.pdf
      2021-nov-dec.pdf
    Chemistry/
      2018-may-june.pdf
    ...
  jamb/
    Biology/
      2020-utme.pdf
      2021-utme.pdf
    Use of English/
      2022-utme.pdf
    ...
```

## Filename rules

- `{year}-{diet}.pdf` where diet is `may-june`, `nov-dec`, or `utme`
- Subject = parent folder name (must match syllabus subject names closely)
- See `docs/NIGERIA-SOURCE-DOWNLOAD-GUIDE.md` for where to download official and free past papers
