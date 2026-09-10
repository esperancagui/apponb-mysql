"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { onAuthStateChanged, auth } from "@/app/lib/authClient";
import { getSocket } from "@/app/lib/socket";

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Wait for the auth client to restore session state before attempting connection
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || cancelled) return;
      getSocket()
        .then((s) => {
          if (!cancelled) setSocket(s);
        })
        .catch(() => {
          // Socket unavailable — will retry on next auth state change
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return socket;
}
