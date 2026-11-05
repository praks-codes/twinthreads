export function RoomCode({ code }: { code: string }) {
  return (
    <div className="room-code">
      <span className="room-code__label">Your room code</span>
      <span className="room-code__value">{code}</span>
    </div>
  );
}
