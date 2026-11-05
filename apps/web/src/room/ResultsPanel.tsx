import type { RoomStatePayload } from "@twinthreads/engine";
import { Button } from "../components/Button.js";

interface ResultsPanelProps {
  state: RoomStatePayload;
  myPlayerId: string;
  onRematch: () => void;
}

/** Shared by every game: the game supplies the result, and this shows it. */
export function ResultsPanel({
  state,
  myPlayerId,
  onRematch,
}: ResultsPanelProps) {
  const { result, rematchVotes } = state;
  if (!result) return null;

  const nameOf = (playerId: string) =>
    state.players.find((player) => player.playerId === playerId)?.displayName ??
    "Player";
  const iVoted = rematchVotes.includes(myPlayerId);
  const partnerVoted = rematchVotes.some((id) => id !== myPlayerId);

  const headline =
    result.winner === null
      ? "It's a draw!"
      : result.winner === myPlayerId
        ? "You won!"
        : `${nameOf(result.winner)} won!`;

  return (
    <section className="results">
      <h2 className="results__headline">{headline}</h2>
      <ul className="results__scores">
        {Object.entries(result.scores).map(([playerId, score]) => (
          <li key={playerId}>
            {nameOf(playerId)}
            {playerId === myPlayerId ? " (you)" : ""}: {score}
          </li>
        ))}
      </ul>
      {iVoted ? (
        <p>Waiting for your partner to play again...</p>
      ) : (
        <>
          {partnerVoted && <p>Your partner wants to play again.</p>}
          <Button onClick={onRematch}>Play again</Button>
        </>
      )}
    </section>
  );
}
