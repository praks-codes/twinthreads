import type { RoomStatePayload, RoomStatus } from "@twinthreads/engine";
import { Suspense, useState } from "react";
import { Button } from "../components/Button.js";
import { ConnectionBanner } from "../components/ConnectionBanner.js";
import { PlayerList } from "../components/PlayerList.js";
import { RoomCode } from "../components/RoomCode.js";
import { gameScreens } from "../games/registry.js";
import { ResultsPanel } from "./ResultsPanel.js";

const STATUS_MESSAGES: Record<RoomStatus, string> = {
  waiting: "Waiting for your partner...",
  active: "You're both here!",
  reconnecting: "Partner reconnecting...",
  paused: "Your partner hasn't come back yet, so the room is paused.",
  partner_left: "Your partner left. They can rejoin with the code above.",
};

interface RoomScreenProps {
  connected: boolean;
  notice: string | null;
  state: RoomStatePayload | null;
  code: string;
  myPlayerId: string;
  onLeave: () => void;
  onReady: (ready: boolean) => void;
  onAction: (type: string, payload: unknown) => void;
  onRematch: () => void;
}

export function RoomScreen({
  connected,
  notice,
  state,
  code,
  myPlayerId,
  onLeave,
  onReady,
  onAction,
  onRematch,
}: RoomScreenProps) {
  const [confirming, setConfirming] = useState(false);

  const phase = state?.phase ?? "LOBBY";
  const inLobby = phase === "LOBBY";
  const finished = phase === "RESULTS" || phase === "REMATCH";

  const status = !connected
    ? "You're offline. Reconnecting..."
    : !state
      ? "Rejoining your room..."
      : state.status === "active" && !inLobby
        ? null
        : STATUS_MESSAGES[state.status];

  const me = state?.players.find((player) => player.playerId === myPlayerId);
  const GameScreen = state ? gameScreens[state.gameId] : undefined;

  return (
    <main className="page page--room">
      <header className="page__header">
        <h1 className="page__title">TwinThreads</h1>
      </header>

      {inLobby && <RoomCode code={code} />}
      <ConnectionBanner message={status} />
      <ConnectionBanner message={notice} tone="error" />

      {state && inLobby && (
        <>
          <PlayerList players={state.players} myPlayerId={myPlayerId} />
          {state.players.length === 2 && (
            <div className="ready">
              <Button
                variant={me?.ready ? "secondary" : "primary"}
                disabled={!connected}
                onClick={() => onReady(!me?.ready)}
              >
                {me?.ready ? "Not ready yet" : "Ready"}
              </Button>
            </div>
          )}
        </>
      )}

      {state && !inLobby && !finished && (
        <Suspense fallback={<p className="page__subtitle">Loading game...</p>}>
          {GameScreen ? (
            <GameScreen
              state={state}
              myPlayerId={myPlayerId}
              paused={state.status === "paused" || !connected}
              onAction={onAction}
            />
          ) : (
            <p className="page__subtitle">This game isn't available.</p>
          )}
        </Suspense>
      )}

      {state && finished && (
        <ResultsPanel
          state={state}
          myPlayerId={myPlayerId}
          onRematch={onRematch}
        />
      )}

      <div className="leave">
        {confirming ? (
          <div className="confirm">
            <p>{inLobby ? "Leave this room?" : "Leave and end this game?"}</p>
            <div className="confirm__buttons">
              <Button onClick={onLeave}>Leave</Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Stay
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Leave room
          </Button>
        )}
      </div>
    </main>
  );
}
