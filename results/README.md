# Reference results

The raw data of the published study: 4 956 answers from six models in five
languages, with every annotation that was computed on them. Nothing is
summarised away — this is what the tables in the write-up were built from.

## Re-analyse it with the tool that produced it

```bash
npm run analyze -- --data results --config results/experiment.reference.yaml --out results
```

That command regenerates [report.md](report.md) and `conditions.csv` from
`runs.jsonl` and the annotation files. If you change how you want to read the
data, edit the analysis and re-run it: no API call, no key needed.

To re-collect rather than re-analyse, copy `experiment.reference.yaml` over
`config/experiment.yaml` — but read its header first, it costs around $120 and
the study ran in phases the file cannot express.

## Files

| file | rows | what it is |
|---|---|---|
| `runs.jsonl` | 4 956 | one answer per row, with the exact message sent (payload included), the model, the condition, the language, the draw, and `finishReason` |
| `extract.jsonl` | 4 986 | authors named and the use made of each, schools, works, questions raised |
| `orient.jsonl` | 4 986 | the orientation the answer follows, named or not, and its register |
| `map.jsonl` | 4 115 | each raised question placed on an axis, or "NONE" |
| `rubric.jsonl` | 4 948 | problematisation score, 0 to 4 |
| `item-audit.jsonl` | 68 | the questions judged **alone, with no answer in view**: which orientations each one invites |
| `role-audit.jsonl` | 60 | the annotator put to the test: sixty mentions, both roles mixed and unlabelled, re-judged by two independent annotators |
| `runs.retired.jsonl` | 881 | answers excluded, each with the reason |

Annotation files hold more rows than `runs.jsonl` because a sample was
annotated twice, by a second model, to measure how far two annotators agree.
Every row carries its `judge`.

`role-audit.jsonl` is the file that says how far the annotator can be trusted on
one specific label. Two independent judges agree with each other 85 % of the
time and confirm only half of the mentions it marked "argument-used", against
85 % of those it marked "position-attributed". That label is therefore about
twice too generous: the ratios between authors hold, the absolute values are a
ceiling. Every case is published with the verdict of each judge and the
fragment that decided it.

`runs.retired.jsonl` is the part most studies would delete. It holds the
answers from a model dropped before the study proper, and a first collection
pass in which a token ceiling shared with reasoning tokens cut 80 % of one
model's answers mid-sentence. Those rows were re-collected, not patched. A
study that quietly drops data cannot be checked.

## Reading the report

Two cautions, both of which matter for comparing these tables with the
write-up.

**The by-condition tables pool every battery.** "BARE, 31 % philosophical
argument" mixes open questions with the anchored battery, and those behave
completely differently. The contrast the study is about is in the *by kind of
question* table: 6 % on a panorama question, 12 % on a lived situation, **59 %
once the question is anchored on a defined theme**. Always read the breakdown
before the aggregate.

**The five conditions were only compared in French and English.** The bare
condition also carries the anchored and five-language material, which is why it
has 3 036 answers against 480 for each of the others. Distinct-author counts
are rarefied to a common sample size for this reason; register percentages are
proportions and comparable as they stand.

## One naming difference

The data field is still called `register` in `orient.jsonl`, while the prose
says "dominant mode". "Register" is a false friend in English — it reads as a
level of language rather than a kind of discourse — but renaming the field would
break the published files and the analysis code for no gain. The field and the
term mean the same thing.

## One wording difference

The annotation prompts under `config/annotation/` were reworded after collection
to drop a French calque ("referential" → "framework"), with no change of
meaning or of what the annotator is asked to do. The data here was produced with
the earlier wording. We mention it because the prompts are the instrument, and
an instrument that has been touched should say so.

## Provenance

Collected 2026-07-28 to 2026-07-31 through OpenRouter. Every row carries its
date and the provider that served it. Models are updated without notice: these
are dated measurements, and re-running them is the point of this repository.
