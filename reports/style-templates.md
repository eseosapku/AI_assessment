# Style templates

Built from the 23,309 extracted questions. Mapping was not used. An unassigned question still counts.

69 cells. 16 are Cambridge cells with 50 or more questions. 8 IGCSE cells are `derived: true`, copied from the matching O Level template, because the 32 files in `Cambridge\Igcse` are not readable PDFs (they start with null bytes, not `%PDF`). 45 REB cells are thin. They come from the handful of REB pages that had a text layer, split by the first word of the filename. They get replaced when the vision pass extracts the scans.

Cambridge cells that are not thin:

| cell | questions |
| --- | ---: |
| o_level / physics | 3,639 |
| as_and_a_level / biology | 2,999 |
| o_level / chemistry | 2,840 |
| o_level / biology | 2,365 |
| o_level / math | 2,071 |
| as_and_a_level / physics | 2,068 |
| as_and_a_level / chemistry | 1,741 |
| as_and_a_level / math | 1,223 |
| as_and_a_level / econ | 1,134 |
| as_and_a_level / compscience | 769 |
| o_level / economics | 1,058 |
| o_level / computerscience | 509 |
| o_level / geography | 397 |
| primary_checkpoint / science | 207 |
| primary_checkpoint / math | 154 |
| primary_checkpoint / english | 110 |

Files are under `systems/<system>/style/<level>/<subject>.json`.
