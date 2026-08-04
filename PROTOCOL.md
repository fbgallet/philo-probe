# Protocol

Written before any answer was collected, so that the criteria could not be
chosen after seeing the data. Thresholds are stated as they were fixed, and the
outcome of each hypothesis is recorded next to it — including the four that
were refuted. A study whose hypotheses all succeed has usually chosen them
late.

Everything below maps onto `config/experiment.yaml`, so you can change a factor
and know exactly which claim you are re-testing.

---

## 1. Two claims, kept apart

**C1 — what these systems do.** Asked philosophical questions, do current
models converge on a narrow set of authors and framings, and in what register
do they answer?

**C2 — what a map of problems changes.** Does giving the model a list of
philosophical questions, each with the positions that compete on it, change what
it does, beyond what a generic instruction achieves?

They are separated because one can hold while the other fails, and because the
authors of the reference study build such a map and are therefore an interested
party on C2. Hence the two placebo conditions (§4), the blind annotation (§6),
and the raw data published with the results.

## 2. Pre-registered hypotheses, and what happened

| # | Hypothesis | Threshold | Outcome |
|---|---|---|---|
| H1 | Mentions concentrate | top-10 authors hold ≥ 50 % of mentions, per language | **met** (51–60 %) |
| H2 | Model families converge | mean pairwise overlap of top-15 author sets ≥ 0.50 | **missed** (0.30–0.39) |
| H3 | Discovery saturates | answers 41–50 add < 1 unseen author each | **met** (0.11–0.23) |
| H4 | The canon is language-relative | fr/en top-15 overlap < 0.70 | **refuted in substance** (see below) |
| H5 | The map adds authors | map > diversity instruction, at equal sample size | **refuted** |
| H6 | The map adds structure | map > flat theme list on the problem framing rubric | **met** (1.90–2.19 vs 1.29–1.44) |

**H4 deserves its own line.** The threshold was technically met between some
language pairs (0.67) and missed between others (0.76). But 0.67 on top-15 sets
means twelve shared names out of fifteen: the substance contradicts the
hypothesis. Asked in Chinese, the models answer Plato, Socrates, Kant,
Aristotle, with Zhuangzi ninth. Asked in German, Kant leads and nothing else
moves: no Hegel, no Schopenhauer, no Heidegger in the top fifteen, and Greek
figures still ahead of German ones. Language adds a national tint of about five
points; it never changes the canon. **We recorded H4 as refuted**, and the
threshold as badly calibrated by us.

**H5 was the wrong yardstick, and we said so before computing the
replacement.** It counts named authors, which is the right measure for
describing a groove and the wrong one for judging a map: an answer can name
fewer thinkers while opening a wider field. H5 stands as measured and refuted —
at equal sample size, a single sentence asking for diversity raises distinct
authors by 47 % (fr) to 104 % (en), while the map cuts them by a third. Three
replacements were declared before being computed:

| # | Replacement hypothesis | Outcome |
|---|---|---|
| H5a | The map reduces drift into the attractor basin (`framework.attractors`) | **not validated** (basin share stable, 19–26 % of placeable questions) |
| H5b | The map reduces the share of raised questions that fit no axis at all | **met**, decisively (43 % → 15 %, against 17 % for the theme list and 28 % for the instruction) |
| H5c | The map widens the spread of orientations followed | **not validated** (spread narrower than the bare question) |

The publishable claim is therefore narrow and testable: **the map does not
broaden the canon, it changes the nature of the questions raised.** And the
diversity instruction is a trap — 57 % of its answers follow no tradition at
all, naming many authors while deploying almost no argument (3 % of mentions).

### The follow-up control that overturned our first reading

The items of the `crossed` battery were written and audited before the first
results were analysed, but they were only collected afterwards, in response to
an objection: an external review of the whole study pointed out that our
comparison between "a specialist's question" and "a bereaved person's question"
varied theme, abstraction, person and affect all at once, so it could not
support a claim about the *form* of the request.

The crossed battery holds the situation constant word for word and varies only
the form. On 324 answers, no form exceeds 1 % reasoning, and asking explicitly
"what is the right thing to do, and why?" produces 99 % practical advice and the
lowest problem framing score in the study. **Our first explanation was wrong**:
what decides is not how the request is phrased but whether a determinate problem
is in the question at all.

This is a post-hoc control and is labelled as such everywhere. It is reported
because it contradicts the authors, which is the only kind of post-hoc analysis
that needs no defence.

## 3. Factors

**Panel** (`panel`): one model per provider, mid-tier rather than flagship,
because the object is what an ordinary user meets. `family` is the unit for H2.

**Languages** (`languages`): each version authored natively, then
back-translated by a third model asked to flag any drift in meaning. One
Chinese item was rewritten at that stage because it presupposed that there was
something to clarify, where the other versions left the question open.

**Question batteries** (`batteries`):

- `open` — eight questions as an ordinary user puts them, in four families
  (panorama, lived situation, dilemma, meta). Tone variants on two of them.
- `anchored` — twelve themes chosen away from the attractor basin, each asked
  by three kinds of user (curious layperson, student with an essay subject,
  specialist). `anchorAxis` is what makes thematic drift measurable.
- `framed` — the open questions with one sentence announcing that a
  philosophical treatment is expected. Separates "the question has a
  philosophical form" from "the user asked for philosophy".
- `crossed` — three situations × three question-forms, built by concatenation so
  only one factor differs between two items. **Run as a follow-up control, not
  as part of the pre-registered set** (§9a).

**Draws** (`draws`): independent samples per cell at temperature 1, in a fresh
conversation each time. Repetition across draws is a measurement, not noise.

**Turns** (`turns`): 1 in the reference study. This is its main limitation.

## 4. Conditions

Identical except for one block appended after the question, with the same
length instruction everywhere — without it, the best-supplied condition wins by
answering longer.

1. **BARE** — the bare question. What a user gets today.
2. **NUDGE** — one sentence asking for the widest range of traditions, periods
   and regions. *The fair placebo: if a sentence closes the gap, a map is
   pointless.*
3. **LIST** — the same themes as the map, stripped of their questions and
   positions. *The second placebo.* It also controls for an obvious objection:
   conditions 2 to 5 all signal that philosophy is expected and condition 1 does
   not, so any difference between LIST and the maps cannot come from that
   signal.
4. **MAP_CORE** — the nodal questions with their competing positions.
5. **MAP_FULL** — the whole map, same format.

LIST is the condition that decides the interpretation. It opens as many
distinct problems as the full map and obtains **the worst problem framing
score of the study, below the bare question**. So the effect comes neither from
context length, nor from the number of themes, nor from signalling philosophy:
it comes from articulating each theme into a question with positions that
compete.

**Not tested:** a condition where the model queries the framework through
tools, one question at a time, with the reasons attached to each position. The
reference study measures a floor, not a companion.

## 5. Neutrality rules for the questions

Fixed before the items were written:

- No question names a philosopher, a school, a period or a region. A single
  proper noun primes the answer and destroys the measurement.
- No question asks for breadth — that belongs to the NUDGE condition.
- Every language is authored natively and back-translated for checking.
- The same length instruction applies in every condition.

Questions are not neutral all the same, and the reference study measured its
own bias rather than denying it: each item was submitted alone, with no answer
attached, to two annotators in two languages, who were asked which orientations
it invites. The item that draws 88 % existentialist answers is judged loaded by
all four verdicts; the item judged open by all four draws 7 %. That audit is
published with the data, so a reader can see which part of the results comes
from our formulations.

## 6. Annotation

Four independent passes, because asking one call both to record what is written
and to infer what tradition it follows lets the second contaminate the first:

1. **extract** — authors named, with the use made of each (mentioned in
   passing, position attributed, argument actually deployed), schools, works,
   and the questions the answer raises.
2. **orient** — the orientation the answer follows in substance, named or not,
   from a closed vocabulary; plus its dominant mode.
3. **map** — each raised question placed on an axis, **with an explicit "none"
   option**. Without that escape every question is forced into a box and
   coverage is inflated; the none-rate is itself a result.
4. **rubric** — problem framing, 0 to 4: does the answer state a question and
   give at least two incompatible defensible positions with reasons?

The annotator receives the text and nothing else, in an order unrelated to the
grid: it never learns which model, which condition or which draw produced what
it reads. It must come from outside the tested panel — the harness refuses to
start otherwise.

Two annotators were run against each other on a sample (`--agreement`):
identical author sets on 30 answers out of 30, identical mode on 30 out of
30, same dominant orientation on 25 out of 30. Thirty answers were also checked
by hand.

## 7. Metrics

**Dominant mode** — the share of answers that argue, report doctrines, advise or
comfort. The reference study's central result: 0 to 3 % argument on open
first-person questions, 65 to 85 % on an anchored theme.

**Concentration and saturation** — top-k mention share, and the rarefaction
curve of distinct authors against cumulative answers. Counts are **always**
rarefied to a common sample size before groups are compared.

**Use versus citation** — the share of mentions where an argument is actually
deployed. In the reference study this separates Kant (25 %) from Camus (3 %)
and Marcus Aurelius (1 %).

**Unplaceable share** — raised questions that fit no axis. High values mean the
answer is inviting introspection rather than opening a problem.

**Basin drift** — the share of placeable questions landing on the axes declared
in `framework.attractors` before collection.

**Orientation spread** — how many distinct orientations appear over a
condition's answers, and the share of answers following no tradition at all.

## 8. Controls run on the data itself

**Response caching.** If providers returned cached answers, repeated draws
would be artificially similar and every repetition metric would be false. Zero
strictly identical answers across 6 725 pairs of draws of the same cell.

**Truncation.** The first collection pass lost 80 % of one model's answers to a
token ceiling shared with its reasoning tokens, cut mid-sentence and invisible
in the data. Those rows were retired and re-collected. `finish_reason` is now
stored on every row and reported at the top of every report.

**Group sizes.** Distinct-author counts are meaningless across groups of
different sizes; rarefaction is applied everywhere.

**The annotator itself.** Three of its behaviours were questioned after the fact
and tested rather than argued about. All three are published with the data, and
all three happen to push against the study's own conclusions rather than for
them, which is the only reason they could be left standing.

- *The `argument-used` role is roughly twice too generous.* Sixty mentions,
  both roles mixed and unlabelled, were re-judged by two annotators independent
  of the one used for the study. Those two agree with each other 85 % of the
  time and confirm only half of the `argument-used` labels, against 85 % of the
  `position-attributed` ones. The disputed cases are always the same kind:
  a bibliography entry with a summary of doctrine, a parenthetical tag, a name
  cited as authority. **Direction of the error:** real argumentation is rarer
  than reported, which sharpens rather than softens the finding that these
  systems cite thinkers instead of reasoning with them. The ratios between
  authors survive, since the bias applies to all of them. See
  `results/role-audit.jsonl`.
- *About 3 % of the authors it extracts do not appear in the answer at all*
  (5.5 % among the mentions it marks as argued), measured mechanically on the
  French and English answers and confirmed by hand on a random sample.
  **Direction:** spurious names inflate diversity, so the concentration of the
  canon is slightly understated, not overstated.
- *It breaks one of its own instructions in 9.8 % of answers*, combining a
  last-resort orientation (eclectic, therapeutic, checklist) with a substantive
  one where the prompt requires the last-resort categories to stand alone.
  **Direction:** the analysis counts an answer as following no tradition only
  when *every* orientation is last-resort, so those cases are counted as having
  a tradition. The "no tradition" share is therefore understated.

None of this touches the dominant mode, the unmapped share, the problem framing
score or any comparison between conditions, which do not depend on the author
extraction.

## 9. Limits

**One turn per conversation.** Results hold for the "one question, one answer"
use, and say nothing about what happens after five exchanges. This cuts both
ways: a model left alone might start repeating itself, which would worsen the
picture; a well-equipped one only deploys its resources over time, which makes
every figure here unfavourable to it. Raising `turns` is the first thing to do
with this repo.

**The map is tested as a document, not as a tool.** Injected whole, reduced to
the labels of its positions, without the descriptions, the stakes or the
arguments a real companion fetches question by question.

**Our questions orient the answers in part**, and the audit measures it.

**The framework is itself a canon**, written by particular people in a
particular language. A question it ignores counts as "unmapped", which can
overstate the introspection share. Swap `config/framework/axes.json` and the
yardstick changes with it.

**The annotator is a language model.** Its categories are judgements. A panel
of three, or human double-annotation on a larger sample, would be stronger.

**These are dated measurements.** Models are updated without notice. Every row
carries its date and the provider that served it, which is one more reason to
publish the protocol: the study is built to be re-run.
