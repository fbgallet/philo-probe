# philo-probe — results

4956 answers from 6 model(s) in 5 language(s), 
4956 annotated by `z-ai/glm-5.2`.

## Register, by condition

What the answer *is*: does it argue, report doctrines, advise, or comfort?

| condition | answers | philosophical | doctrinal | practical | therapeutic | problematisation |
|---|---|---|---|---|---|---|
| BARE | 3036 | 28 % | 15 % | 52 % | 5 % | 1.51 |
| LIST | 480 | 22 % | 19 % | 51 % | 8 % | 1.37 |
| NUDGE | 480 | 2 % | 69 % | 26 % | 3 % | 1.57 |
| MAP_CORE | 480 | 14 % | 26 % | 57 % | 4 % | 2.05 |
| MAP_FULL | 480 | 17 % | 23 % | 56 % | 4 % | 2.04 |

## Register, by kind of question

| question family | answers | philosophical | doctrinal | practical | therapeutic |
|---|---|---|---|---|---|
| panorama | 816 | 6 % | 11 % | 82 % | 1 % |
| lived | 816 | 12 % | 10 % | 52 % | 26 % |
| dilemma | 708 | 17 % | 22 % | 61 % | 0 % |
| meta | 708 | 0 % | 64 % | 36 % | 0 % |
| anchored | 1296 | 59 % | 14 % | 26 % | 0 % |
| framed | 288 | 22 % | 22 % | 51 % | 5 % |
| crossed | 324 | 1 % | 26 % | 74 % | 0 % |

## Authors, by condition

Distinct authors are rarefied to 480 answers per condition: comparing raw
counts across groups of different sizes measures the group size.

| condition | distinct authors (@480) | mentions/answer | top-10 share | no tradition |
|---|---|---|---|---|
| BARE | 157.1 | 1.8 | 46 % | 19 % |
| LIST | 105.0 | 1.8 | 54 % | 24 % |
| NUDGE | 259.0 | 8.8 | 41 % | 56 % |
| MAP_CORE | 80.0 | 1.7 | 60 % | 26 % |
| MAP_FULL | 95.0 | 1.7 | 58 % | 25 % |

## Where the raised questions land

Attractor basin declared before collection: LIFE_MEANING, FREEDOM, ESSENCE, SUFFERING_MEANING.
"unplaceable" is the share of raised questions that fit no axis at all: they
are usually introspection prompts rather than problems.

| condition | questions mapped | unplaceable | in basin (of placeable) | on the question's own axis |
|---|---|---|---|---|
| BARE | 12572 | 48 % | 11 % | 15 % |
| LIST | 3570 | 18 % | 11 % | — |
| NUDGE | 2521 | 27 % | 14 % | — |
| MAP_CORE | 2747 | 17 % | 20 % | — |
| MAP_FULL | 3030 | 16 % | 16 % | — |

## The models do not behave alike

| model | argues | advises | problematisation | words | favourite author |
|---|---|---|---|---|---|
| openai/gpt-5.6-terra | 19 % | 59 % | 1.54 | 337 | aristotle |
| anthropic/claude-sonnet-5 | 24 % | 54 % | 2.00 | 345 | kant |
| x-ai/grok-4.5 | 23 % | 52 % | 1.36 | 221 | aristotle |
| mistralai/mistral-medium-3-5 | 16 % | 48 % | 1.58 | 281 | kant |
| deepseek/deepseek-v4-pro | 32 % | 39 % | 1.87 | 340 | kant |
| google/gemini-3.6-flash | 19 % | 51 % | 1.25 | 318 | kant |

## Most-named authors

| author | mentions | in passing | position attributed | argument used |
|---|---|---|---|---|
| kant | 978 | 15 % | 68 % | 17 % |
| aristotle | 835 | 17 % | 79 % | 4 % |
| nietzsche | 612 | 20 % | 76 % | 5 % |
| descartes | 573 | 20 % | 67 % | 13 % |
| plato | 568 | 31 % | 64 % | 4 % |
| camus | 493 | 32 % | 65 % | 4 % |
| sartre | 467 | 29 % | 66 % | 6 % |
| epictetus | 374 | 40 % | 51 % | 9 % |
| epicurus | 363 | 16 % | 68 % | 16 % |
| hume | 300 | 24 % | 63 % | 13 % |
| socrates | 288 | 27 % | 63 % | 11 % |
| marcus-aurelius | 270 | 63 % | 34 % | 3 % |
| mill | 254 | 52 % | 46 % | 2 % |
| confucius | 222 | 24 % | 72 % | 4 % |
| rawls | 220 | 30 % | 63 % | 7 % |
| heidegger | 194 | 22 % | 74 % | 5 % |
| bentham | 184 | 60 % | 35 % | 5 % |
| arendt | 165 | 38 % | 58 % | 4 % |
| spinoza | 155 | 28 % | 64 % | 8 % |
| montaigne | 144 | 20 % | 73 % | 7 % |

## What is not measured here

- Only the first turn of each conversation, unless `turns` was raised.
- The map conditions inject the framework as a document. A companion that
  queries it on demand, with the reasons attached to each position, is a
  different and untested object.
- The annotator is a language model. Run `npm run annotate -- --agreement`
  and publish the figures alongside these.

