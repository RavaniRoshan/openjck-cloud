"use client";

import { QueryClient as ReactQueryClient, QueryClientProvider as TanStackProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

export function QueryClientProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new ReactQueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return <TanStackProvider client={queryClient}>{children}</TanStackProvider>;
}
