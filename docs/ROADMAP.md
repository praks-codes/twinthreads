# Roadmap

The direction of TwinThreads: which games we build, in what order, and the milestones to get there. Update this file whenever the plan changes. Architecture and design decisions belong in [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Game lineup and build order

| Order  | Game                          | Type                                         | Engine needs                    |
| ------ | ----------------------------- | -------------------------------------------- | ------------------------------- |
| 1      | Relationship Court (flagship) | Turn-based, roles, timers, Game Master judge | Rounds, roles, timers, scoring  |
| 2      | Couple's Mystery              | Asymmetric information co-op                 | Per-player views (secret clues) |
| 3      | Love Kitchen: Chaos Mode      | Real-time co-op                              | Event streaming, Phaser         |
| 4      | Love Quest (themed packs)     | Shared decisions, resources                  | Branching state, content packs  |
| 5      | Trust Fall                    | Asymmetric information co-op                 | Per-player views                |
| 6      | Evil Couple Simulator         | Standalone comedic game                      | To be designed                  |
| Future | Our Little Monster            | Persistent shared pet                        | Accounts, database              |

## Milestones

| #   | Milestone                | Done when                                                                                                              | Status      |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------- |
| 0   | Repo and tooling         | Empty apps run locally and on a phone                                                                                  | Done        |
| 1   | Hello Room               | Two phones share a room code, see each other live, survive a refresh                                                   | Done        |
| 2   | Phase engine             | A fake test game runs through every phase                                                                              | Done        |
| 2a  | Design direction         | Mood, look and Court's screen-by-screen flow are agreed in a short design doc, with clickable mockups tried on a phone | Not started |
| 3   | Court v0                 | A couple can play three rounds start to finish, ugly UI is fine                                                        | Not started |
| 4   | Court polish             | Animations, sound, share card, 25 accusations, 12 defenses                                                             | Not started |
| 5   | Public pages and hosting | Court live on a real domain, SEO pages indexed                                                                         | Not started |
| 6   | Couple's Mystery         | Reuses the engine with minimal new platform code                                                                       | Not started |

Milestone specs: [Hello Room](hello-room.md) (done), [Phase engine](phase-engine.md) (done).

Still open from milestones 1 and 2: test on an Android phone and across different networks, once hosted at milestone 5.

To settle in Court's spec:

- **Lost turns while reconnecting:** timers keep running for about 75 seconds after a phone locks, until the game pauses. In Number Duel that can cost nearly two of the three rounds, which could feel unfair in Court.
- **Partner status on game screens:** Number Duel can show "Your partner is choosing..." under "Partner reconnecting...". Court's screens should take the connection status into account.

## Design plan

The owner designs TwinThreads, with Claude Code's help. No outside designer or illustrator is planned.

Every screen is designed for phones first, then adapted for tablets and laptops, because the two players may be on different devices.

| When            | Focus                           | Output                                                                                 |
| --------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| Milestone 1     | Design foundations              | Simple shared colours, fonts and spacing, so screens aren't restyled one by one later  |
| Milestone 2a    | Experience and visual direction | The design doc and mockups above                                                       |
| Milestone 3     | Is it fun?                      | Follows the agreed flow with simple visuals. "Ugly" means unpolished, not unconsidered |
| Milestone 4     | Beauty                          | Final visuals, animation, sound and the share card                                     |
| Each later game | Reuse                           | A shared look across games, with each game adding its own character                    |

### Mood by game

- **Relationship Court:** playful, silly and comedic.
- **Other games:** decided later.
