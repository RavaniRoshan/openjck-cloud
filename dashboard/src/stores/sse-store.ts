import { create } from "zustand";

type SSEStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

interface SSEState {
  status: SSEStatus;
  disconnectedAt: number | null;
  lastConnectedAt: number | null;
  retryToken: string | null;
  needsReconciliation: boolean;
  setStatus: (status: SSEStatus) => void;
  setDisconnectedAt: (timestamp: number | null) => void;
  setNeedsReconciliation: (needs: boolean) => void;
  requestRetry: () => void;
  consumeRetryToken: () => string | null;
  markReconciled: () => void;
}

export const useSSEStore = create<SSEState>((set, get) => ({
  status: "connecting",
  disconnectedAt: null,
  lastConnectedAt: null,
  retryToken: null,
  needsReconciliation: false,

  setStatus: (status) => {
    set((state) => {
      const updates: Partial<SSEState> = { status };

      if (status === "connected") {
        updates.lastConnectedAt = Date.now();
        updates.disconnectedAt = null;

        // Check if we need reconciliation (was disconnected for >30s)
        if (state.disconnectedAt && Date.now() - state.disconnectedAt > 30_000) {
          updates.needsReconciliation = true;
        }
      } else if (status === "reconnecting") {
        updates.disconnectedAt = null;
      }

      return updates;
    });
  },

  setDisconnectedAt: (timestamp) => set({ disconnectedAt: timestamp }),

  setNeedsReconciliation: (needs) => set({ needsReconciliation: needs }),

  requestRetry: () => set({
    status: "reconnecting",
    disconnectedAt: null,
    retryToken: crypto.randomUUID()
  }),

  consumeRetryToken: () => {
    const token = get().retryToken;
    set({ retryToken: null });
    return token;
  },

  markReconciled: () => set({ needsReconciliation: false }),
}));
