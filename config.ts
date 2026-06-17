import path from 'node:path';
import dotenv from 'dotenv';

type AppConfig = {
  server: {
    host: string;
    port: number;
    strictPort: boolean;
    allowedHosts: string[];
  };
  capture: {
    host: string;
  };
};

const defaultConfig: AppConfig = {
  server: {
    host: '0.0.0.0',
    port: 3010,
    strictPort: true,
    allowedHosts: ['mcp.krdp.ddns.net'],
  },
  capture: {
    host: '127.0.0.1',
  },
};

dotenv.config({ path: path.resolve('.env') });
const env = process.env;

export const appConfig = {
  server: {
    host: readString(env.ELVEN_BATTLE_HOST, defaultConfig.server.host),
    port: readNumber(env.ELVEN_BATTLE_PORT, defaultConfig.server.port),
    strictPort: readBoolean(env.ELVEN_BATTLE_STRICT_PORT, defaultConfig.server.strictPort),
    allowedHosts: readList(env.ELVEN_BATTLE_ALLOWED_HOSTS, defaultConfig.server.allowedHosts),
  },
  capture: {
    host: readString(env.ELVEN_BATTLE_CAPTURE_HOST, defaultConfig.capture.host),
  },
} satisfies AppConfig;

function readString(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false;
    default:
      return fallback;
  }
}

function readList(value: string | undefined, fallback: string[]): string[] {
  const items = value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return items && items.length > 0 ? items : fallback;
}
