# Milestone 3: Relationship Court

**Status:** done, and tested by the owner on real devices. More screens can come later. Still open: which AI model and host to use when public, plus testing on Android and across different networks at milestone 5.

## Goal

A couple can play three cases start to finish on their own phones, judged by a real AI, with a local model for testing and a simple switch to other providers.

This came from the [design direction](design-direction.md), which holds the full flow and theme.

## What each case includes

Setup (first case only), five turns, objections with an argument and a ruling, the judge deciding, wax seal, verdict, punishment, pardon or no mercy, and a shareable case card. Roles swap each case.

## Turns

Each case has at most 5 turns, shown on both screens along with how many each player has left:

1. The prosecutor accuses
2. The defendant defends
3. The prosecutor replies
4. The defendant replies
5. The judge cross-examines the defendant, using everything said in the case

Cross-examination always happens. A player can rest their case on a reply turn, which uses up that turn, and running out of time does the same.

## Rules from the first test

- **Judge:** both partners must agree before the game starts, and either changing their mind clears the other's approval. If time runs out on a disagreement, the Court picks one partner's choice and says so.
- **Objections:** only the side that didn't just speak can object, so a player can object to what the other side just said. An objection is the objector speaking, so it uses their next turn if it's up, and the turn then passes to their partner. The button warns about this first. After a ruling the game moves to the next step, so each statement can only be objected to once.
- **Court record:** both players can always read everything said so far, across all cases, on screen. The judge only uses the current case. Lawyer suggestions stay private until used.
- **Wax seal:** the verdict, score, moods and meter stay hidden until the seal breaks.
- **Your side:** your own avatar and your side of the meter are always on the left, on either device.

## Characters and reactions

- Players show neutral, happy, laughing, crying, annoyed, nervous, smug and in-love states, with a matching emoji. The AI picks them during the case.
- Either player can send a floating emoji at any time.
- The gummy audience behind the judge reacts, and shouts GASP!, BOOOHOOO!, AWWWW! or HAHAHA!, chosen by the AI. It never votes.

## How the judge talks

- Very simple, everyday words, short lines, and always kind, whichever personality is chosen.
- Every request includes everything said in the current case and the score, so replies don't depend on just the last thing said.
- Earlier cases are left out, so each case is judged on its own and the model doesn't mix them up.
- The AI is told who the accuser and the accused are, because "me" in an accusation means the accuser.
- The tone lives in `apps/server/src/ai/court-prompts.ts`, and each personality in `packages/games/court/src/content.ts`.

## While the AI works

Both phones show the judge thinking, with rotating lines. A full "deciding" screen plays before the verdict. Requests run on the server, and every one has a timeout and backup lines, so a game can't get stuck.

## Case card

Each case becomes an image with its whole conversation, the verdict, and the punishment or the pardon. It's as tall as the case needs. Share uses the phone's share sheet where there is one, and downloads otherwise.

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
- Objections that tell the judge to ignore its rules are always overruled, but this only catches common wording.
- `gemma3:4b` can get confused about who said what, guess someone's gender, give verdict lines that don't say who won, and lean towards Guilty. A stronger model is the next thing to try.
- Timers keep running during a reconnect, so a player whose phone locks can lose turns. This is still an open decision.
- The lobby and results screens are still the plain platform design.

## Testing on real devices

Same Wi-Fi, with Ollama running:

- [x] A full three-case game finishes, with roles swapping
- [x] The judge's replies respond to what was actually written
- [x] Waiting for the AI feels acceptable on your hardware
- [x] Every judge personality sounds different
- [x] Objections and cross-examination work on both phones
- [x] The judge uses simple words and is never mean
- [ ] Each case is judged on its own, without bringing up earlier cases
- [x] The case card saves or shares from a phone
- [x] Refreshing mid-case returns to the right place
