import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@esm-famil/shared';
import { loadConfig } from './config.js';
import { RoomManager } from './rooms.js';
import { attachSocketHandlers } from './socket.js';
import { buildPipeline } from './validation/index.js';

const config = loadConfig();
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
const log = (msg: string, err?: unknown) => (err ? app.log.error({ err }, msg) : app.log.warn(msg));

await app.register(cors, { origin: config.corsOrigins });

app.get('/healthz', async () => ({ ok: true, rooms: rooms.size, llm: pipeline.capabilities.llm }));

// In production the server also serves the built web app (see Dockerfile).
const here = dirname(fileURLToPath(import.meta.url));
const staticDir = config.staticDir ?? join(here, '..', '..', 'web', 'dist');
if (existsSync(staticDir)) {
  await app.register(fastifyStatic, { root: staticDir });
  app.setNotFoundHandler((_req, reply) => reply.sendFile('index.html'));
  app.log.info(`serving web app from ${staticDir}`);
}

const pipeline = buildPipeline(config, log);
const rooms = new RoomManager({ pipeline, log }, config.maxRooms);
rooms.startSweeper();
void pipeline.warmUp();

const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
  cors: { origin: config.corsOrigins },
  // A whole answer sheet is well under a kilobyte; anything bigger is not a player.
  maxHttpBufferSize: 16 * 1024,
});
attachSocketHandlers(io, rooms, log);

app.addHook('onClose', async () => {
  rooms.stopSweeper();
  pipeline.learned?.flush();
  await io.close();
});

await app.listen({ port: config.port, host: config.host });
const llm = pipeline.capabilities.llm;
app.log.info(
  `fact-checker: word database${llm.available ? ` + ${llm.provider} judge (${llm.model})` : ' only (no LLM judge configured)'}`,
);
