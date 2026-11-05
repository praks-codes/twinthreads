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

| #   | Milestone                | Done when                                                            | Status      |
| --- | ------------------------ | -------------------------------------------------------------------- | ----------- |
| 0   | Repo and tooling         | Empty apps run locally and on a phone                                | Done        |
| 1   | Hello Room               | Two phones share a room code, see each other live, survive a refresh | Next        |
| 2   | Phase engine             | A fake test game runs through every phase                            | Not started |
| 3   | Court v0                 | A couple can play three rounds start to finish, ugly UI is fine      | Not started |
| 4   | Court polish             | Animations, sound, share card, 25 accusations, 12 defenses           | Not started |
| 5   | Public pages and hosting | Court live on a real domain, SEO pages indexed                       | Not started |
| 6   | Couple's Mystery         | Reuses the engine with minimal new platform code                     | Not started |
