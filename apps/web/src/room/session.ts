export interface RoomSession {
  code: string;
  playerId: string;
  playerToken: string;
  displayName: string;
}

const KEY = "twinthreads.session";

// Storage can throw or be empty, for example in some private windows.
export function loadSession(): RoomSession | null {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? (JSON.parse(saved) as RoomSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: RoomSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // The room still works. It just won't survive a refresh.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
