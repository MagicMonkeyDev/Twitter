import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { WebSocketServer } from 'ws';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket.io',
  serveClient: false,
  pingInterval: 10000,
  pingTimeout: 5000,
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? 'https://solmates.club'
      : 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket'],
  allowUpgrades: false
  }
});

// Middleware to verify Supabase token
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return next(new Error('Invalid token'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

// WebSocket heartbeat
const HEARTBEAT_INTERVAL = 25000;
const CLIENT_TIMEOUT = 30000;

// Keep track of connected sockets
const connectedSockets = new Map(); // socketId -> lastHeartbeat

const waitingUsers = new Set();
const connectedPairs = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  connectedSockets.set(socket.id, Date.now());

  // Setup heartbeat
  const heartbeat = setInterval(() => {
    socket.emit('ping');
  }, HEARTBEAT_INTERVAL);

  socket.on('pong', () => {
    connectedSockets.set(socket.id, Date.now());
  });

  socket.on('ready', () => {
    if (waitingUsers.has(socket.id)) return;

    if (waitingUsers.size > 0) {
      const peer = Array.from(waitingUsers)[0];
      waitingUsers.delete(peer);
      
      connectedPairs.set(socket.id, peer);
      connectedPairs.set(peer, socket.id);

      io.to(socket.id).emit('matched', { initiator: true });
      io.to(peer).emit('matched', { initiator: false });
    } else {
      waitingUsers.add(socket.id);
    }
  });

  socket.on('signal', ({ signal }) => {
    const peer = connectedPairs.get(socket.id);
    if (peer) {
      io.to(peer).emit('signal', { signal });
    }
  });

  socket.on('next', () => {
    const currentPeer = connectedPairs.get(socket.id);
    if (currentPeer) {
      io.to(currentPeer).emit('peer-left');
      connectedPairs.delete(socket.id);
      connectedPairs.delete(currentPeer);
    }

    if (waitingUsers.size > 0) {
      const newPeer = Array.from(waitingUsers)[0];
      waitingUsers.delete(newPeer);
      
      connectedPairs.set(socket.id, newPeer);
      connectedPairs.set(newPeer, socket.id);

      io.to(socket.id).emit('matched', { initiator: true });
      io.to(newPeer).emit('matched', { initiator: false });
    } else {
      waitingUsers.add(socket.id);
    }
  });

  socket.on('chat-message', ({ message }) => {
    const peer = connectedPairs.get(socket.id);
    if (peer) {
      io.to(peer).emit('chat-message', { message });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    waitingUsers.delete(socket.id);
    connectedSockets.delete(socket.id);
    clearInterval(heartbeat);
    
    const peer = connectedPairs.get(socket.id);
    if (peer) {
      io.to(peer).emit('peer-left');
      connectedPairs.delete(socket.id);
      connectedPairs.delete(peer);
    }
  });
});

// Client timeout checker
setInterval(() => {
  const now = Date.now();
  for (const [socketId, lastBeat] of connectedSockets.entries()) {
    if (now - lastBeat > CLIENT_TIMEOUT) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        console.log('Client timeout, disconnecting:', socketId);
        socket.disconnect(true);
      }
      connectedSockets.delete(socketId);
    }
  }
}, 10000);
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});