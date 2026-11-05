import type { RoomStatePayload } from "@twinthreads/engine";

interface PlayerListProps {
  players: RoomStatePayload["players"];
  myPlayerId: string;
  slots?: number;
}

export function PlayerList({
  players,
  myPlayerId,
  slots = 2,
}: PlayerListProps) {
  const emptySlots = Math.max(slots - players.length, 0);
  return (
    <ul className="player-list">
      {players.map((player) => (
        <li
          key={player.playerId}
          className={
            player.connected && player.ready
              ? "player-list__item player-list__item--ready"
              : "player-list__item"
          }
        >
          <span>
            {player.displayName}
            {player.playerId === myPlayerId ? " (you)" : ""}
          </span>
          <span className="player-list__status">
            {!player.connected
              ? "Offline"
              : player.ready
                ? "✓ Ready"
                : "Connected"}
          </span>
        </li>
      ))}
      {Array.from({ length: emptySlots }, (_, index) => (
        <li key={index} className="player-list__item player-list__item--empty">
          Free slot
        </li>
      ))}
    </ul>
  );
}
