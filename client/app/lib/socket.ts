import { io, Socket } from "socket.io-client";
import { auth } from "@/app/lib/firebase";

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const token = await user.getIdToken();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  socket = io(apiUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 10,
  });

  // Refresh the Firebase token before each reconnect attempt so the server
  // doesn't reject the connection after the token expires (~1h).
  socket.on("reconnect_attempt", async () => {
    try {
      const fresh = await user.getIdToken(true);
      socket!.auth = { token: fresh };
    } catch {}
  });

  return new Promise<Socket>((resolve, reject) => {
    socket!.once("connect", () => resolve(socket!));
    socket!.once("connect_error", (err) => {
      socket = null;
      reject(err);
    });
  });
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
