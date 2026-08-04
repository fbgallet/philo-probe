# philo-probe

**What does a language model actually do when you bring it a philosophical
question?** This is the harness behind a study of six mainstream models in five
languages — run it yourself, against the models you use, with your own
questions.

The write-up is not published yet; when it is, it will be linked here (English
by default, with a French version). Until then the protocol is in
[PROTOCOL.md](PROTOCOL.md) and the study's own data, with the report generated
from it, is in [results/](results/).

It measures four things on every answer:

- **the dominant mode** — does it argue, report doctrines, give advice, or comfort?
- **the questions it raises** — are they philosophical problems, or prompts for
  introspection (« what do I really want? »)?
- **the authors** — who is named, and whether they are name-dropped or actually
  argued with;
- **the orientation** — which tradition the answer follows, even when it never
  says so.

Then it compares that against conditions: the bare question, a "be diverse"
instruction, a flat list of themes, and a map of philosophical questions with
the positions that compete on each. The reference study found that the last one
changes what a model does, and that the flat list of themes makes it *worse
than nothing* — which is the sort of result you only get by testing the
placebos.

## Quick start

```bash
cp .env.example .env       # one OpenRouter key: models and annotator both
npm install
npm run collect -- --dry-run   # prints the grid, a sample message, a cost estimate
npm run collect                # ~2 500 answers, around $12 at current prices
npm run annotate               # four blind passes over what was collected
npm run analyze                # reports/report.md + CSVs
```

Everything is resumable. Interrupt any step and re-run it: answers are keyed by
cell and appended to `data/*.jsonl`, so nothing is collected or annotated twice.

Nothing to spend yet? The published study's 4 632 answers are in
[results/](results/), and one command re-analyses them without an API key:

```bash
npm run analyze -- --data results --config results/experiment.reference.yaml --out results
```

## Audit your own assistant

Cut `panel` in `config/experiment.yaml` down to the model you actually talk to:

```yaml
panel:
  - { id: anthropic/claude-sonnet-5, family: anthropic }
languages: [en]
```

You lose the comparison between labs, but everything else holds: the register,
the share of introspection, the drift, the problem framing score. Around
$1 for a few hundred answers. It answers a question worth asking — *what does
the assistant I use every day do with a question of mine?*

## What you can change, and where

| | |
|---|---|
| models, annotator, languages, draws, **turns**, word cap | `config/experiment.yaml` |
| the questions, in any language | `config/prompts/*.yaml` |
| tone prefixes (naive, academic, distressed) | `config/prompts/tones.yaml` |
| the conditions, and the block each one appends | `config/experiment.yaml` |
| what the annotator is asked | `config/annotation/*.md` |
| the orientation vocabulary | `config/orientations.yaml` |
| the framework used by the payload conditions | `config/framework/axes.json` |

Nothing in `src/` needs touching for any of that.

Adding a question means adding an entry to a battery file with a text for every
language you run; the harness refuses to start otherwise, rather than silently
dropping a cell. Adding a language means adding it to `languages` and
translating every item — write it natively rather than translating word for
word, then check it back (the reference study caught one Chinese item that
presupposed its own answer).

## The battery that can prove something

`crossed` is the only battery here built as a minimal-pair design: three
situations by three question-forms, where the situation is reproduced word for
word across forms, so that between two items exactly one factor ever varies.

It is worth running even when it is not what you came for. In the reference
study, the first interpretation of the headline result — that the *form* of the
request decides what a model does — survived four batteries and fell to this
one in a single afternoon: at constant situation, no form of the question
obtained more than 1 % reasoning. Everything else in this repository measures
correlations between questions that differ in many ways at once; this battery is
the one that isolates a cause.

## Multi-turn

`turns: 3` replays the same conversation with the relaunches from
`experiment.yaml` (« Go deeper », « And then? »), identical in every condition
so that what differs between them is never the user's own contribution. Every
turn is stored; the analysis reads the first one, which is what the reference
study measured. **This is the main thing the reference study does not cover**:
whether a model left alone starts going in circles while a well-equipped one
keeps opening ground.

## The guard rails

Three things fail loudly rather than being mentioned in documentation:

**The annotator may not grade its own family.** If it shares a provider with a
tested model, the run refuses to start. Set `judge.allowSelfGrading: true` and
every result is stamped as self-graded — honest, and much weaker.

**Truncated answers are reported.** `maxTokens` is a runaway guard, never the
way the length limit is enforced: the word cap is *instructed*. It must clear
reasoning plus answer, because a reasoning-heavy model can spend a thousand
tokens thinking before writing a word. The reference study lost a first pass to
exactly this, with 80 % of one model's answers cut mid-sentence, invisible in
the data until we looked. `analyze` now says so at the top of the report.

**Group sizes are never compared naively.** Distinct-author counts are rarefied
to a common number of answers, because a group with four times more answers
trivially names more authors.

**Measure your annotator, and do not trust it by default.**

```bash
npm run annotate -- --agreement    # re-annotates a sample with judge.second
```

It reports how far two annotators agree on the authors extracted, the dominant
orientation and the mode. Publish those numbers with your results.
Disagreement on authors is measurement error; disagreement on orientation is
interpretation, and a reader is entitled to see how much of it there is.

This matters more than it sounds. In the reference study, a blind re-judging of
sixty mentions by two independent annotators showed the one we used confirming
only half of its own `argument-used` labels, inventing about 3 % of the authors
it reported, and breaking one of its own instructions in 10 % of answers
(`results/role-audit.jsonl`). None of it changed the conclusions, and all of it
happened to push against them — but we found out afterwards, by checking. Two
things follow for anyone running this:

- **Set `judge.effort`.** The reference study left it unset, so every annotation
  ran at the provider's default effort on a task that is entirely interpretive.
  `effort: high` is now the shipped default. Whether it actually helps is
  measurable with `--agreement`; we did not have that number.
- **Use two annotators from different providers** and report where they differ,
  rather than picking one and hoping.

## The reference grid

The published study used all four batteries and five languages
(fr, en, es, zh, de) across five conditions, about 4 600 answers and roughly
$120 including annotation. The shipped default is deliberately smaller: one
battery, two languages, all five conditions, around $12. `collect --dry-run`
prices whatever you have configured before anything is sent.

To reproduce the full grid, uncomment the batteries and languages in
`config/experiment.yaml`.

## What this does not measure

Only the first turn, unless you raise `turns`. The map is injected as a
document, not queried as a tool: a companion that fetches one question at a
time, with the reasons attached to each position, is a different object and an
untested one. And the map itself is a canon, written by particular people in a
particular language — swap `config/framework/axes.json` for your own and the
yardstick changes with it.

The protocol, with its pre-registered hypotheses and the thresholds fixed
before collection — including the four that were refuted — is in
[PROTOCOL.md](PROTOCOL.md).

## Licence

MIT for the code. The analytical framework under `config/framework/` comes from the
open encyclopedic layer of [Philoscopia](https://philoscopia.com) and carries
its own licence.
