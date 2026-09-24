import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function emptyState() {
  return { users: [], sessions: [], kits: [] };
}

function normalizeEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error('Enter a valid email address');
  return normalized;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  if (typeof password !== 'string' || password.length < 8) throw new Error('Password must contain at least 8 characters');
  const derived = await scrypt(password, salt, 64);
  return { salt, hash: Buffer.from(derived).toString('hex') };
}

function publicUser(user) {
  return { id: user.id, email: user.email, created_at: user.created_at };
}

export function createFileStore(filePath) {
  let writeChain = Promise.resolve();

  async function readState() {
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8'));
      return { ...emptyState(), ...parsed };
    } catch (error) {
      if (error.code === 'ENOENT') return emptyState();
      throw new Error('Local data store could not be read');
    }
  }

  async function writeState(state) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, filePath);
  }

  async function read(reader) {
    await writeChain;
    return reader(await readState());
  }

  async function update(mutator) {
    let result;
    const pending = writeChain.catch(() => undefined).then(async () => {
      const state = await readState();
      result = await mutator(state);
      await writeState(state);
    });
    writeChain = pending.catch(() => undefined);
    await pending;
    return result;
  }

  return {
    async createUser({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      const passwordRecord = await passwordHash(password);
      return update((state) => {
        if (state.users.some((user) => user.email === normalizedEmail)) throw new Error('An account with this email already exists');
        const user = { id: randomUUID(), email: normalizedEmail, password: passwordRecord, created_at: new Date().toISOString() };
        state.users.push(user);
        return publicUser(user);
      });
    },

    async verifyUser({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      const user = await read((state) => state.users.find((item) => item.email === normalizedEmail));
      if (!user) throw new Error('Email or password is incorrect');
      const calculated = await passwordHash(password, user.password.salt);
      if (!timingSafeEqual(Buffer.from(calculated.hash, 'hex'), Buffer.from(user.password.hash, 'hex'))) {
        throw new Error('Email or password is incorrect');
      }
      return publicUser(user);
    },

    async createSession(userId) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      await update((state) => {
        state.sessions = state.sessions.filter((session) => new Date(session.expires_at) > new Date());
        state.sessions.push({ id: randomUUID(), token_hash: hashToken(token), user_id: userId, expires_at: expiresAt, created_at: new Date().toISOString() });
      });
      return { token, expires_at: expiresAt };
    },

    async getSessionUser(token) {
      if (!token) return null;
      return read((state) => {
        const session = state.sessions.find((item) => item.token_hash === hashToken(token) && new Date(item.expires_at) > new Date());
        if (!session) return null;
        const user = state.users.find((item) => item.id === session.user_id);
        return user ? publicUser(user) : null;
      });
    },

    async revokeSession(token) {
      if (!token) return;
      await update((state) => {
        state.sessions = state.sessions.filter((session) => session.token_hash !== hashToken(token));
      });
    },

    async saveKit(userId, kit) {
      const record = { id: randomUUID(), user_id: userId, kit, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await update((state) => state.kits.push(record));
      return record;
    },

    async listKits(userId) {
      return read((state) => state.kits
        .filter((kit) => kit.user_id === userId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map(({ id, kit, created_at, updated_at }) => ({ id, kit, created_at, updated_at })));
    },

    async findKitByFingerprint(userId, fingerprint) {
      return read((state) => state.kits
        .filter((item) => item.user_id === userId && item.kit?.source?.request_fingerprint === fingerprint)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] || null);
    },

    async updateKit(userId, kitId, kit) {
      return update((state) => {
        const record = state.kits.find((item) => item.id === kitId && item.user_id === userId);
        if (!record) throw new Error('Saved kit was not found');
        record.kit = kit;
        record.updated_at = new Date().toISOString();
        return { id: record.id, updated_at: record.updated_at };
      });
    }
  };
}

function requireSingle(rows, message) {
  const record = Array.isArray(rows) ? rows[0] : null;
  if (!record) throw new Error(message);
  return record;
}

function queryString(parameters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null) query.set(key, value);
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

export function createSupabaseStore({ url, serviceRoleKey, fetchImpl = fetch }) {
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for persistent storage');
  const apiBase = `${url.replace(/\/$/, '')}/rest/v1`;

  async function request(table, { method = 'GET', query, body, prefer = 'return=representation' } = {}) {
    const response = await fetchImpl(`${apiBase}/${table}${queryString(query)}`, {
      method,
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
        prefer
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) throw new Error('Persistent storage request failed');
    if (response.status === 204) return [];
    return response.json();
  }

  async function findUserByEmail(email) {
    const rows = await request('app_users', { query: { select: 'id,email,password,created_at', email: `eq.${email}`, limit: '1' } });
    return rows[0] || null;
  }

  return {
    async createUser({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      if (await findUserByEmail(normalizedEmail)) throw new Error('An account with this email already exists');
      const passwordRecord = await passwordHash(password);
      const user = requireSingle(await request('app_users', {
        method: 'POST',
        body: { id: randomUUID(), email: normalizedEmail, password: passwordRecord, created_at: new Date().toISOString() }
      }), 'Account could not be created');
      return publicUser(user);
    },

    async verifyUser({ email, password }) {
      const user = await findUserByEmail(normalizeEmail(email));
      if (!user) throw new Error('Email or password is incorrect');
      const calculated = await passwordHash(password, user.password.salt);
      if (!timingSafeEqual(Buffer.from(calculated.hash, 'hex'), Buffer.from(user.password.hash, 'hex'))) {
        throw new Error('Email or password is incorrect');
      }
      return publicUser(user);
    },

    async createSession(userId) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      await request('app_sessions', {
        method: 'POST',
        body: { id: randomUUID(), token_hash: hashToken(token), user_id: userId, expires_at: expiresAt, created_at: new Date().toISOString() }
      });
      return { token, expires_at: expiresAt };
    },

    async getSessionUser(token) {
      if (!token) return null;
      const sessions = await request('app_sessions', {
        query: { select: 'user_id', token_hash: `eq.${hashToken(token)}`, expires_at: `gt.${new Date().toISOString()}`, limit: '1' }
      });
      const session = sessions[0];
      if (!session) return null;
      const users = await request('app_users', { query: { select: 'id,email,created_at', id: `eq.${session.user_id}`, limit: '1' } });
      const user = users[0];
      return user ? publicUser(user) : null;
    },

    async revokeSession(token) {
      if (!token) return;
      await request('app_sessions', { method: 'DELETE', query: { token_hash: `eq.${hashToken(token)}` }, prefer: 'return=minimal' });
    },

    async saveKit(userId, kit) {
      const record = requireSingle(await request('interview_kits', {
        method: 'POST',
        body: { id: randomUUID(), user_id: userId, kit, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      }), 'Kit could not be saved');
      return record;
    },

    async listKits(userId) {
      return request('interview_kits', {
        query: { select: 'id,kit,created_at,updated_at', user_id: `eq.${userId}`, order: 'updated_at.desc' }
      });
    },

    async findKitByFingerprint(userId, fingerprint) {
      const kits = await request('interview_kits', {
        query: { select: 'id,kit,created_at,updated_at', user_id: `eq.${userId}`, order: 'updated_at.desc' }
      });
      return kits.find((item) => item.kit?.source?.request_fingerprint === fingerprint) || null;
    },

    async updateKit(userId, kitId, kit) {
      const record = requireSingle(await request('interview_kits', {
        method: 'PATCH',
        query: { id: `eq.${kitId}`, user_id: `eq.${userId}` },
        body: { kit, updated_at: new Date().toISOString() }
      }), 'Saved kit was not found');
      return { id: record.id, updated_at: record.updated_at };
    }
  };
}

const storePath = process.env.TRAO_STORE_PATH || path.join(process.cwd(), 'data', 'store.json');
export const store = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createSupabaseStore({ url: process.env.SUPABASE_URL, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY })
  : createFileStore(storePath);

export const sessionCookie = {
  name: 'trao_session',
  options: { httpOnly: true, sameSite: 'lax', secure: process.env.TRAO_COOKIE_SECURE === 'true', path: '/', maxAge: SESSION_TTL_MS / 1000 }
};
