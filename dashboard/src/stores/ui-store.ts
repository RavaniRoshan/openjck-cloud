import { create } from "zustand";

export const useUIStore = create<{
  // Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Session drawer
  activeSessionId: string | null;
  sessionDrawerOpen: boolean;
  openSession: (id: string) => void;
  closeSession: () => void;

  // Fleet
  fleetDensity: "compact" | "comfortable" | "spacious";
  fleetTimeWindow: "1h" | "6h" | "24h" | "7d";
  setFleetDensity: (density: "compact" | "comfortable" | "spacious") => void;
  setFleetTimeWindow: (window: "1h" | "6h" | "24h" | "7d") => void;
}>((set) => ({
  // Sidebar
  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  // Session drawer
  activeSessionId: null,
  sessionDrawerOpen: false,
  openSession: (activeSessionId) => set({ activeSessionId, sessionDrawerOpen: true }),
  closeSession: () => set({ sessionDrawerOpen: false, activeSessionId: null }),

  // Fleet
  fleetDensity: "comfortable",
  fleetTimeWindow: "24h",
  setFleetDensity: (fleetDensity) => set({ fleetDensity }),
  setFleetTimeWindow: (fleetTimeWindow) => set({ fleetTimeWindow }),
}));
