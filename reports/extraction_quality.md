# Extraction quality

Read from `C:\Users\hp\Desktop\pastPapers` on 2026-10-27. IGCSE was skipped. Nothing was written to the database, and no figure was uploaded.

The text of each paper is in `data/past-paper-corpus/papers.jsonl`. A paper whose question numbers are not in order, or which has no text layer, is stored with its raw text and no guessed questions.

| | files | questions kept |
| --- | ---: | ---: |
| Read | 2,394 | |
| Structure found | 1,531 | 23,309 |
| Flagged `needs_review` | 863 | 0 |
| Unreadable | 0 | |

## Why papers were flagged

| reason | papers |
| --- | ---: |
| question numbers are not in order | 553 |
| no text layer | 181 |
| no question numbers found | 129 |

A flagged paper is not repaired. The 553 out-of-order papers still have their raw text in the corpus. Their questions were not split, because a wrong split would invent the structure.

## By folder

| folder | files | structured | flagged | no text layer | questions kept |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cambridge / As and Alevel | 1,112 | 785 | 327 | 0 | 9,934 |
| Cambridge / Olevel | 941 | 715 | 226 | 2 | 12,879 |
| Cambridge / primary_checkpoints | 42 | 27 | 15 | 0 | 471 |
| REB / P6 | 69 | 0 | 69 | 55 | 0 |
| REB / S3 | 126 | 0 | 126 | 95 | 0 |
| REB / S6 | 104 | 4 | 100 | 29 | 25 |

REB papers are almost all scans. The text layer is empty, so there is nothing to quote. They are flagged `no text layer`. No OCR text was invented.

## Not done in this pass

Figure crops were not taken and nothing was uploaded to S3. Cropping the diagrams and putting them under `figures/{system}/{question_id}/` is a separate pass. It must not write into the live figure library.

IGCSE was not read.
