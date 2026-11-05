import { useState, type FormEvent } from "react";
import { Button } from "../components/Button.js";
import { ConnectionBanner } from "../components/ConnectionBanner.js";
import { TextField } from "../components/TextField.js";

const CODE_LENGTH = 6;

interface HomeScreenProps {
  connected: boolean;
  notice: string | null;
  onCreate: (displayName: string) => void;
  onJoin: (code: string, displayName: string) => void;
}

export function HomeScreen({
  connected,
  notice,
  onCreate,
  onJoin,
}: HomeScreenProps) {
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [code, setCode] = useState("");

  const submitCreate = (event: FormEvent) => {
    event.preventDefault();
    onCreate(createName);
  };

  const submitJoin = (event: FormEvent) => {
    event.preventDefault();
    onJoin(code, joinName);
  };

  return (
    <main className="page page--home">
      <header className="page__header">
        <h1 className="page__title">TwinThreads</h1>
        <p className="page__subtitle">Two-player games for couples</p>
      </header>

      <ConnectionBanner message={notice} tone="error" />
      <ConnectionBanner message={connected ? null : "Connecting..."} />

      <div className="actions">
        <form className="panel" onSubmit={submitCreate}>
          <h2 className="panel__title">Start a room</h2>
          <div className="stack">
            <TextField
              label="Your name"
              name="create-name"
              value={createName}
              maxLength={24}
              autoComplete="off"
              onChange={(event) => setCreateName(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={!connected || !createName.trim()}>
            Create room
          </Button>
        </form>

        <form className="panel" onSubmit={submitJoin}>
          <h2 className="panel__title">Join your partner</h2>
          <div className="stack">
            <TextField
              label="Your name"
              name="join-name"
              value={joinName}
              maxLength={24}
              autoComplete="off"
              onChange={(event) => setJoinName(event.target.value)}
            />
            <TextField
              label="Room code"
              name="room-code"
              value={code}
              maxLength={CODE_LENGTH}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={
              !connected || !joinName.trim() || code.length !== CODE_LENGTH
            }
          >
            Join room
          </Button>
        </form>
      </div>
    </main>
  );
}
