# NERDC textbook PDFs

Drop Nigerian curriculum pupil/student books here, then run:

```bash
node scripts/import-nerdc-textbooks.js
node scripts/import-nerdc-textbooks.js --dry-run
```

## Folder layout

```
data/nerdc-textbooks/
  P4/
    English-Studies.pdf
    Mathematics.pdf
  JSS1/
    English-Studies.pdf
    Intermediate-Science.pdf
  SS1/
    Biology.pdf
    Chemistry.pdf
```

Level folder = class name (`P1`–`P6`, `JSS1`–`JSS3`, `SS1`–`SS3`).

See `docs/NIGERIA-SOURCE-DOWNLOAD-GUIDE.md` for official NERDC sources and what to download.
