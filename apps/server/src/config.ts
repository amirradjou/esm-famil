export type LlmProvider = 'none' | 'claude' | 'ollama';

export interface Config {
  port: number;
  host: string;
  corsOrigins: string[] | true;
  llmProvider: LlmProvider;
  claudeModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  /** Absolute path of the built web app to serve, or null in dev. */
  staticDir: string | null;
}

function parseProvider(v: string | undefined): LlmProvider {
  if (v === 'claude' || v === 'ollama') return v;
  return 'none';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const origins = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    // Vite dev server needs an explicit origin; in production the same origin serves both.
    corsOrigins: origins.length > 0 ? origins : true,
    llmProvider: parseProvider(env.LLM_PROVIDER),
    claudeModel: env.CLAUDE_MODEL ?? 'claude-opus-5',
    ollamaUrl: env.OLLAMA_URL ?? 'http://localhost:11434',
    ollamaModel: env.OLLAMA_MODEL ?? 'qwen2.5:7b',
    staticDir: env.STATIC_DIR ?? null,
  };
}
