import { create } from "zustand";

type SSEStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export const useSSEStore = create<{
  status: SSEStatus;
  setStatus: (status: SSEStatus) => void;
}>((set) => ({
  status: "connecting",
  setStatus: (status) => set({ status }),
}));
