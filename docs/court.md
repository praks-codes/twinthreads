# Milestone 3: Relationship Court

**Status:** first AI version, being tested by the owner. More screens are planned.

## Goal

A couple can play three cases start to finish on their own phones, judged by a real AI, with a local model for testing and a simple switch to other providers.

This came from the [design direction](design-direction.md), which holds the full flow and theme.

## What each case includes

Setup (first case only), accusation, defense, hearing, objections with an argument and a ruling, cross-examination, the judge deciding, wax seal, verdict, punishment, pardon or no mercy, and a shareable case card. Roles swap each case.

## Rules from the first test

- **Judge and cross-examination:** both partners must agree before the game starts, and either changing their mind clears the other's approval. If time runs out on a disagreement, the Court picks one partner's choice and says so.
- **Objections:** only the side that didn't just speak can object, so the prosecutor objects at the hearing and after cross-examination. After a ruling the game moves to the next step, so each statement can only be objected to once.
- **Court record:** both players can always read everything said so far, across all cases. Lawyer suggestions stay private until used.
- **Wax seal:** the verdict, score, moods and meter stay hidden until the seal breaks.

- **Your side:** your own avatar and your side of the meter are always on the left, on either device.

## Characters and reactions

- Players show neutral, happy, laughing, crying, annoyed, nervous, smug and in-love states, with a matching emoji. The AI picks them during the case.
- Either player can send a floating emoji at any time.
- The gummy audience behind the judge reacts, and shouts GASP!, BOOOHOOO!, AWWWW! or HAHAHA!, chosen by the AI. It never votes.

## How the judge talks

- Very simple, everyday words, short lines, and always kind, whichever personality is chosen.
- Every request includes the whole game so far, including earlier cases and the score, so replies can't depend on just the last thing said.
- The tone lives in `apps/server/src/ai/court-prompts.ts`, and each personality in `packages/games/court/src/content.ts`.

## While the AI works

Both phones show the judge thinking, with rotating lines. A full "deciding" screen plays before the verdict. Requests run on the server, and every one has a timeout and backup lines, so a game can't get stuck.

## AI settings

Set these in `apps/server/.env`. All are optional.

| Variable             | Default     | Purpose                                                      |
| -------------------- | ----------- | ------------------------------------------------------------ |
| `AI_PROVIDER`        | `ollama`    | `ollama`, `openai-compatible`, or `none` to use backup lines |
| `AI_MODEL`           | `gemma3:4b` | The model's name for that provider                           |
| `AI_BASE_URL`        | Ollama's    | Required for `openai-compatible`                             |
| `AI_API_KEY`         | None        | Sent as a bearer token to `openai-compatible` providers      |
| `AI_TIMEOUT_SECONDS` | `45`        | How long to wait before using backup lines                   |

To add a provider with a different API, add one function in `apps/server/src/ai/provider.ts`.

## How it fits together

- `packages/games/court`: pure rules and backup text. Validates everything the AI returns.
- `apps/server/src/ai`: prompts, providers and the runner. Logs never include what players wrote.
- `apps/web/src/games/court`: the screens, characters, theme and share card.

## Known limits

- Fonts load from Google Fonts, and need to be self-hosted before going public.
- The serious-topic word check is basic, and small models may miss cases too.
- A small model may be fooled by "ignore your instructions" text. Its effect is limited, because one ruling can only move the meter a little.
- Timers keep running during a reconnect, which is still an open decision.
- The lobby and results screens are still the plain platform design.

## Testing on real devices

Same Wi-Fi, with Ollama running:

- [ ] A full three-case game finishes, with roles swapping
- [ ] The judge's replies respond to what was actually written
- [ ] Waiting for the AI feels acceptable on your hardware
- [ ] Every judge personality sounds different
- [ ] Objections and cross-examination work on both phones
- [ ] The judge uses simple words and is never mean
- [ ] Later replies refer to what happened earlier
- [ ] The case card saves or shares from a phone
- [ ] Refreshing mid-case returns to the right place
