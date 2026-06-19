# StudySquare motion ad — UI reference frames

Live screenshots from the app for the Zelios-style StudyLab ad.

## Files

| File | Screen |
|------|--------|
| `01-dashboard-studylab-cta.png` | Dashboard — Open StudyLab CTA |
| `02-studylab-hub.png` | StudyLab hub — persona + Gap Map entry |
| `03-gap-map.png` | Learning Gap Map canvas |
| `04-exam-prep.png` | Exam Prep (Nigeria / WAEC · JAMB) |
| `05-learnspace-workspace.png` | LearnSpace workspace (hero) |
| `06-learnspace-topic-input.png` | LearnSpace with chat input filled |

All captured at **1920×1080 @2x PNG**.

## Re-capture

```bash
npm run dev
node scripts/capture-motion-ad-screenshots.js
```

Requires a user in the database. Exam Prep needs `country: 'NG'` on the user record.

## Production doc

Full shot list, Figma spec, and shot mapping:  
`docs/STUDYSQUARE-STUDYLAB-MOTION-AD.md` → Part 4
