import type { RoomStatePayload } from "@twinthreads/engine";
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface GameScreenProps {
  state: RoomStatePayload;
  myPlayerId: string;
  paused: boolean;
  onAction: (type: string, payload: unknown) => void;
}

type GameScreen = LazyExoticComponent<ComponentType<GameScreenProps>>;

// Each screen loads only when its game starts, so games never download each other.
// The test game isn't included in production builds.
export const gameScreens: Record<string, GameScreen> = import.meta.env.DEV
  ? {
      "test-game": lazy(() => import("./test-game/TestGameScreen.js")),
    }
  : {};
