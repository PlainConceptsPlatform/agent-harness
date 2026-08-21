import fse from 'fs-extra'
import path from 'path'
import { parseModels } from './models-pricing.js'
import { modelsCacheDir } from './paths.js'

const CACHE_DIR = modelsCacheDir();
const CACHE_FILE = path.join(CACHE_DIR, 'models-cache.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MODELS_URL = 'https://models.dev/api.json';

async function loadCache() {
  try {
    if (!await fse.pathExists(CACHE_FILE)) return null;
    const cache = await fse.readJson(CACHE_FILE);
    if (!cache.timestamp || !cache.models) return null;
    const age = Date.now() - cache.timestamp;
    if (age > CACHE_TTL_MS) return null; // expired
    return cache.models;
  } catch {
    return null;
  }
}

async function saveCache(models) {
  try {
    await fse.ensureDir(CACHE_DIR);
    await fse.writeJson(CACHE_FILE, { timestamp: Date.now(), models });
  } catch {
    // cache write failure is non-fatal
  }
}

export async function fetchModels() {
  // 1. Try cache first (fresh)
  const cached = await loadCache();
  if (cached) return { models: cached, source: 'cache' };

  // 2. Try network
  try {
    const res = await fetch(MODELS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models = parseModels(data);
    await saveCache(models);
    return { models, source: 'network' };
  } catch {
    // 3. Network failed, fall back to stale cache if available
    try {
      if (await fse.pathExists(CACHE_FILE)) {
        const cache = await fse.readJson(CACHE_FILE);
        if (cache.models?.length) return { models: cache.models, source: 'stale-cache' };
      }
    } catch {
      // ignore
    }
    return { models: null, source: 'unavailable' };
  }
}
