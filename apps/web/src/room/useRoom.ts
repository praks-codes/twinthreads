import type {
  ClientToServerEvents,
  RoomErrorPayload,
  RoomStatePayload,
  ServerToClientEvents,
} from "@twinthreads/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  clearSession,
  loadSession,
  saveSession,
  type RoomSession,
} from "./session.js";

type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const RECONNECT_DELAY_MS = 2000;
const REJOIN_RETRY_MS = 5000;

// In development the Vite dev server proxies to the server, so any device works.
const SERVER_URL = import.meta.env.DEV
  ? undefined
  : import.meta.env.VITE_SERVER_URL;

export function useRoom() {
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState(loadSession);
  const [state, setState] = useState<RoomStatePayload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const socketRef = useRef<RoomSocket | null>(null);
  const sessionRef = useRef(session);
  const pendingNameRef = useRef("");
  const rejoiningRef = useRef(false);
  const replacedRef = useRef(false);

  const updateSession = useCallback((next: RoomSession | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next) saveSession(next);
    else clearSession();
  }, []);

  useEffect(() => {
    const socket: RoomSocket = SERVER_URL ? io(SERVER_URL) : io();
    socketRef.current = socket;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (task: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        task();
      }, delay);
      timers.add(timer);
    };

    const rejoin = () => {
      const saved = sessionRef.current;
      if (!saved) return;
      rejoiningRef.current = true;
      socket.emit("room:join", {
        code: saved.code,
        displayName: saved.displayName,
        playerToken: saved.playerToken,
      });
    };

    const forgetRoom = (message: string) => {
      updateSession(null);
      setState(null);
      setNotice(message);
    };

    const onError = ({ code, message }: RoomErrorPayload) => {
      const wasRejoining = rejoiningRef.current;
      rejoiningRef.current = false;

      if (code === "ROOM_EXPIRED") return forgetRoom(message);
      if (code === "REPLACED") {
        // The other tab owns the saved session now, so leave it in storage.
        replacedRef.current = true;
        sessionRef.current = null;
        setSession(null);
        setState(null);
        setNotice(message);
        return;
      }
      if (wasRejoining && (code === "NOT_FOUND" || code === "BAD_TOKEN")) {
        return forgetRoom("That room is no longer available.");
      }
      if (wasRejoining && code === "RATE_LIMITED")
        later(rejoin, REJOIN_RETRY_MS);
      setNotice(message);
    };

    socket.on("connect", () => {
      setConnected(true);
      rejoin();
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      // Socket.IO doesn't retry after the server closes the connection itself.
      if (reason === "io server disconnect" && !replacedRef.current) {
        later(() => socket.connect(), RECONNECT_DELAY_MS);
      }
    });

    socket.on("room:joined", ({ code, playerId, playerToken }) => {
      rejoiningRef.current = false;
      const displayName =
        sessionRef.current?.playerId === playerId
          ? sessionRef.current.displayName
          : pendingNameRef.current;
      updateSession({ code, playerId, playerToken, displayName });
      setNotice(null);
    });

    socket.on("room:state", (next) => {
      if (sessionRef.current?.code === next.code) setState(next);
    });

    socket.on("room:error", onError);

    // A phone waking up should reconnect straight away, not on the next retry.
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        !socket.connected &&
        !replacedRef.current
      ) {
        socket.connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      timers.forEach(clearTimeout);
      socket.disconnect();
    };
  }, [updateSession]);

  const createRoom = useCallback((displayName: string) => {
    pendingNameRef.current = displayName.trim();
    setNotice(null);
    socketRef.current?.emit("room:create", { gameId: "court", displayName });
  }, []);

  const joinRoom = useCallback((code: string, displayName: string) => {
    pendingNameRef.current = displayName.trim();
    setNotice(null);
    socketRef.current?.emit("room:join", { code, displayName });
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("room:leave", {});
    updateSession(null);
    setState(null);
    setNotice(null);
  }, [updateSession]);

  return {
    connected,
    session,
    state,
    notice,
    createRoom,
    joinRoom,
    leaveRoom,
  };
}
