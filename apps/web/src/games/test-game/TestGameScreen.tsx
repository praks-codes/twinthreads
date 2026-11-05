import type { NumberDuelView } from "@twinthreads/test-game";
import { Button } from "../../components/Button.js";
import { Countdown } from "../../components/Countdown.js";
import type { GameScreenProps } from "../registry.js";
import "./test-game.css";

const CHOICES = [1, 2, 3, 4, 5];

const STAGE_TITLES: Record<string, string> = {
  PRIVATE_INPUT: "Pick a number",
  REVEAL: "Reveal",
  SCORE: "Score",
  NEXT_ROUND: "Next round coming up",
};

// A deliberately plain screen, for testing the phase engine in development.
export default function TestGameScreen({
  state,
  myPlayerId,
  paused,
  onAction,
}: GameScreenProps) {
  const game = state.game as NumberDuelView;
  const nameOf = (playerId: string) =>
    state.players.find((player) => player.playerId === playerId)?.displayName ??
    "Player";

  return (
    <section className="duel">
      <p className="duel__round">
        Number Duel: round {game.round} of {game.totalRounds}
      </p>
      <h2 className="duel__stage">{STAGE_TITLES[state.phase]}</h2>
      {state.deadline !== null && (
        <Countdown deadline={state.deadline} serverTime={state.serverTime} />
      )}

      {state.phase === "PRIVATE_INPUT" &&
        (game.myPick === null ? (
          <div className="duel__choices">
            {CHOICES.map((value) => (
              <Button
                key={value}
                disabled={paused}
                onClick={() => onAction("pick", { value })}
              >
                {value}
              </Button>
            ))}
          </div>
        ) : (
          <p>You picked {game.myPick}.</p>
        ))}

      {state.phase === "PRIVATE_INPUT" && (
        <p className="duel__partner">
          {game.partnerHasPicked
            ? "Your partner has picked."
            : "Your partner is choosing..."}
        </p>
      )}

      {state.phase === "REVEAL" && (
        <dl className="duel__reveal">
          <dt>Target</dt>
          <dd>{game.target}</dd>
          <dt>You</dt>
          <dd>{game.myPick ?? "No pick"}</dd>
          <dt>Partner</dt>
          <dd>{game.partnerPick ?? "No pick"}</dd>
        </dl>
      )}

      {state.phase !== "PRIVATE_INPUT" && (
        <ul className="duel__scores">
          {Object.entries(game.scores).map(([playerId, score]) => (
            <li key={playerId}>
              {nameOf(playerId)}
              {playerId === myPlayerId ? " (you)" : ""}: {score}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
