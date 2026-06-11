import type { Server as SocketIO } from 'socket.io';

let io: SocketIO;

export function setIO(server: SocketIO): void {
  io = server;
}

export function getIO(): SocketIO {
  return io;
}
