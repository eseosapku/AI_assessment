# Response types

Follow-up check, same corpus. `graph_read` is 90 because only the phrases "from the graph", "read off", "determine the gradient", and "using the graph" set that tag. Zero parts tagged `numeric` contain those phrases, so that narrow set was not absorbed into `numeric`.

A wider check, across all 55,194 parts, looked for "from the graph", "using Fig.", "from the diagram", "Fig." plus a number, "from the figure", "the graph shows", and "shown in Fig.". 10,654 parts match. Every extracted question has an empty `figure_refs` list, so all 10,654 have no figure attached. Of those, 1,269 are tagged `numeric` and 8,279 `text`. A question that names a graph or a figure and ships without it is not answerable.

`extended_write` (319) is in scope. A student types an essay. Those parts are generated and mapped, and held from publishing until an essay marker exists. The unsupported list is only `freehand_draw`, `practical`, and `annotate_diagram`. Plot parts stay held for Phase 6b and are not served.

Tagged from the extracted questions. IGCSE was not in the corpus. No row in the curriculum database was written.

Papers read: 2394. Papers with no parsed questions: 863.
Questions tagged: 23309. Parts tagged: 55194.

## Parts

| response type | parts |
| --- | ---: |
| text | 38143 |
| numeric | 4888 |
| algebraic | 1878 |
| multiple_choice | 8694 |
| table_fill | 296 |
| graph_read | 90 |
| plot_points | 314 |
| plot_line | 342 |
| plot_read_off | 6 |
| freehand_draw | 132 |
| practical | 41 |
| annotate_diagram | 51 |
| extended_write | 319 |

A typed answer is `text`, `numeric`, `algebraic`, `multiple_choice`, `table_fill`, or `graph_read`. `graph_read` is a number read off a graph that is already printed. A plot the student has to draw is held, not served, until the plot marker exists.

## Questions

- fully usable: 22441
- partly usable: 841
- held for plotting only: 18
- not usable: 9

Parts kept out because they depend on a part that cannot be served: 92.

## By system, level, and subject folder

| group | questions | full | partial | held | none |
| --- | ---: | ---: | ---: | ---: | ---: |
| cambridge | Olevel | Physics | 3639 | 3463 | 170 | 2 | 4 |
| cambridge | As and Alevel | biology | 2999 | 2946 | 52 | 1 | 0 |
| cambridge | Olevel | chemistry | 2840 | 2818 | 22 | 0 | 0 |
| cambridge | Olevel | biology | 2365 | 2336 | 28 | 0 | 1 |
| cambridge | Olevel | Math | 2071 | 2000 | 68 | 3 | 0 |
| cambridge | As and Alevel | physics | 2068 | 1899 | 165 | 4 | 0 |
| cambridge | As and Alevel | chemistry | 1741 | 1663 | 75 | 3 | 0 |
| cambridge | As and Alevel | math | 1223 | 1219 | 3 | 1 | 0 |
| cambridge | As and Alevel | econ | 1134 | 1134 | 0 | 0 | 0 |
| cambridge | Olevel | Economics | 1058 | 830 | 227 | 0 | 1 |
| cambridge | As and Alevel | compscience | 769 | 759 | 10 | 0 | 0 |
| cambridge | Olevel | computerScience | 509 | 495 | 12 | 1 | 1 |
| cambridge | Olevel | Geography | 397 | 394 | 3 | 0 | 0 |
| cambridge | primary_checkpoints | science | 207 | 199 | 5 | 2 | 1 |
| cambridge | primary_checkpoints | math | 154 | 153 | 1 | 0 | 0 |
| cambridge | primary_checkpoints | English | 110 | 110 | 0 | 0 | 0 |
| reb | S6 |  | 25 | 23 | 0 | 1 | 1 |