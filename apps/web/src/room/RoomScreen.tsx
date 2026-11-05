import type { RoomStatePayload, RoomStatus } from "@twinthreads/engine";
import { useState } from "react";
import { Button } from "../components/Button.js";
import { ConnectionBanner } from "../components/ConnectionBanner.js";
import { PlayerList } from "../components/PlayerList.js";
import { RoomCode } from "../components/RoomCode.js";

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
}

export function RoomScreen({
  connected,
  notice,
  state,
  code,
  myPlayerId,
  onLeave,
}: RoomScreenProps) {
  const [confirming, setConfirming] = useState(false);

  const status = !connected
    ? "You're offline. Reconnecting..."
    : state
      ? STATUS_MESSAGES[state.status]
      : "Rejoining your room...";

  return (
    <main className="page page--room">
      <header className="page__header">
        <h1 className="page__title">TwinThreads</h1>
      </header>

      <RoomCode code={code} />
      <ConnectionBanner message={status} />
      <ConnectionBanner message={notice} tone="error" />

      {state && <PlayerList players={state.players} myPlayerId={myPlayerId} />}

      <div className="leave">
        {confirming ? (
          <div className="confirm">
            <p>Leave this room?</p>
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
