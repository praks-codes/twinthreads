import { HomeScreen } from "./room/HomeScreen.js";
import { RoomScreen } from "./room/RoomScreen.js";
import { useRoom } from "./room/useRoom.js";

export function App() {
  const room = useRoom();

  if (!room.session) {
    return (
      <HomeScreen
        connected={room.connected}
        notice={room.notice}
        onCreate={room.createRoom}
        onJoin={room.joinRoom}
      />
    );
  }

  return (
    <RoomScreen
      connected={room.connected}
      notice={room.notice}
      state={room.state}
      code={room.session.code}
      myPlayerId={room.session.playerId}
      onLeave={room.leaveRoom}
      onReady={room.setReady}
      onAction={room.sendAction}
      onRematch={room.rematch}
    />
  );
}
