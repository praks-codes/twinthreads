import { useEffect, useState } from "react";

const TICK_MS = 250;

interface CountdownProps {
  deadline: number;
  /** The server's clock when this deadline was sent. Corrects for clock differences. */
  serverTime: number;
}

export function Countdown({ deadline, serverTime }: CountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const clockOffset = serverTime - Date.now();
    const update = () => {
      const left = deadline - (Date.now() + clockOffset);
      setSecondsLeft(Math.max(Math.ceil(left / 1000), 0));
    };
    update();
    const interval = setInterval(update, TICK_MS);
    return () => clearInterval(interval);
  }, [deadline, serverTime]);

  if (secondsLeft === null) return null;
  return (
    <p className="countdown" role="timer">
      {secondsLeft}s
    </p>
  );
}
