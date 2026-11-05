import { useEffect, useState } from "react";

const healthUrl = import.meta.env.DEV
  ? "/health"
  : `${import.meta.env.VITE_SERVER_URL}/health`;

export function App() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    fetch(healthUrl)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ status: string; rooms: number }>;
      })
      .then((health) => setStatus(`${health.status} (${health.rooms} rooms)`))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1>TwinThreads</h1>
      <p>Server status: {status}</p>
    </main>
  );
}
