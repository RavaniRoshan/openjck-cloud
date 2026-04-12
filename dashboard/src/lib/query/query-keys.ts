import { type QueryKey } from "@tanstack/react-query";

export const queryKeys = {
  sessions: () => ["sessions"] as QueryKey,
  session: (sessionId: string) => ["sessions", sessionId] as QueryKey,
  fleet: () => ["fleet"] as QueryKey,
  fleetDensity: () => ["fleet", "density"] as QueryKey,
};
