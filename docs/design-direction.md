# Milestone 2a: Design direction

**Status:** draft for review. Nothing here is decided until the [decisions](#decisions-for-the-owner) are answered.

## Goal

Agree Relationship Court's mood, look and screen-by-screen flow before building it in milestone 3.

Mockups: [Relationship Court design directions](https://claude.ai/artifact/7z2xommhEuryxCpAnz9hfj). The link is private to the owner's Claude account, and the prototype opens with its Play button.

## Mood

Playful, silly and comedic. The joke is that a tiny household crime is treated as a serious court case.

- **Tease, never wound.** Cards are about milk, duvets and being late, and never about money, family, bodies or anything a couple might really fight about.
- **Pompous judge, petty crimes.** The comedy comes from the gap between the two.
- **Losing is funny too.** A verdict should make both players laugh, including the guilty one.

## The three directions

All three use the same case and copy, so only the look differs.

| Direction             | Idea                                                                               | Looks like                                                         | Risk                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1. The Daily Gavel    | Your petty crime is front-page tabloid news                                        | Newsprint, red masthead, black type, a rubber stamp                | Funniest headlines, but needs new headline jokes for every card, and feels less warm |
| 2. Sofa Court Live    | A trashy daytime TV court show, filmed on your sofa                                | Cobalt, yellow and pink, thick outlines, on-air graphics, a ticker | Highest energy, but tiring over several rounds and busiest on a small phone          |
| 3. The Stitched Court | A homemade court, sewn from felt, run by a plush dog in a wig called Judge Biscuit | Plum quilt, felt patches, visible stitches                         | Could feel too cute if the jokes stop being sharp                                    |

**Recommendation: 3, The Stitched Court.**

- It's the only one that grows out of the name TwinThreads.
- A plush judge keeps accusations affectionate, which protects "tease, never wound".
- It suits a couple, and a stitched verdict would make a share card people want to keep.
- It can be built without an illustrator: patches and stitches are CSS, and the judge is simple vector shapes with three moods.

## Screen flow

The prototype follows this flow in Direction 3. Rules here are working assumptions, and milestone 3's spec settles them.

| Screen             | Phase           | Prosecutor sees                    | Defendant sees                     | Moves on when                 |
| ------------------ | --------------- | ---------------------------------- | ---------------------------------- | ----------------------------- |
| Lobby              | `LOBBY`         | Room code, both names, Ready       | The same                           | Both ready                    |
| Case opens         | `NEXT_ROUND`    | "You're the prosecutor"            | "You're the defendant"             | Short timer                   |
| File an accusation | `PRIVATE_INPUT` | 3 accusation cards                 | A waiting screen, with the judge   | Picked, or the timer runs out |
| Mount a defense    | `PRIVATE_INPUT` | A waiting screen, with the judge   | The accusation and 3 defense cards | Picked, or the timer runs out |
| The reveal         | `REVEAL`        | Accusation and defense turned over | The same                           | Short timer                   |
| The verdict        | `SCORE`         | Guilty or not guilty, and sentence | The same                           | Short timer                   |
| Swap seats         | `NEXT_ROUND`    | Roles swap for the next case       | The same                           | Short timer                   |
| Final verdict      | `RESULTS`       | Winner, title and Appeal button    | The same                           | Both tap Appeal, or leave     |

Two accusation-then-defense turns inside one round must be checked against the phase engine in milestone 3's spec. A game could also keep this step inside a single `PRIVATE_INPUT`.

In the prototype, tapping moves things along where the real game would use timers, and it only plays two of the three cases.

## Moments outside the normal flow

| Moment                   | What the player sees                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| Partner's phone drops    | The partner line changes to "Sam has gone quiet", and never says "choosing" while they're offline |
| Timer runs out on a pick | The Court picks a card, and the player is told                                                    |
| Room is paused           | Platform banner in the game's theme, and the judge sleeps                                         |
| Partner leaves           | The game ends and the platform's "Your partner left" message shows                                |

## Devices

Designed for phones first.

- **Phone:** one column, with the main button at the bottom in thumb reach.
- **Tablet and laptop:** the judge and the accusation sit on the left, and choices sit on the right. See the laptop frame in the mockups.
- **Mixed devices:** the two players can be on different screen sizes, so nothing can depend on both seeing the same layout.
- **Tap targets:** at least 44px, with cards and main buttons much larger.

## Decisions for the owner

| #   | Question                                                                       | Recommendation                                                                         |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 1   | Which direction?                                                               | 3, The Stitched Court                                                                  |
| 2   | Is the judge a plush dog called Judge Biscuit?                                 | Yes, as a starting point. The owner may have a better character or name                |
| 3   | Does the defendant see the accusation before choosing a defense?               | Yes. A defense can then answer the charge, which is a choice rather than a blind guess |
| 4   | How does the judge decide? (`ARCHITECTURE.md` section 15)                      | Open. Options to explore in milestone 3's spec                                         |
| 5   | Are sentences playful real-life forfeits, such as "buy the next carton"?       | Yes, as jokes with no way to enforce them                                              |
| 6   | Do Court's timers keep running while a partner is reconnecting? (`ROADMAP.md`) | Settle in milestone 3's spec, together with the pick timer                             |

## Out of scope

- Final copy. All card text here is a sample
- Final animation, sound and the share card (milestone 4)
- Any game code

## Done when

- The owner has chosen a direction and answered the decisions above
- The owner has tried the prototype on a phone
- This document is updated to record the final choice
