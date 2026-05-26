/**
 * Session store — persists the current user's PASETO token to a local file
 * so the user doesn't have to log in every time they start the terminal.
 *
 * Token is stored at: ~/.financebot_session  (user's home directory)
 * The file is only readable by the current OS user (mode 0o600).
 *
 * Cleanup 2: removed unused `chmod` import.
 */
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SESSION_FILE = join(homedir(), '.financebot_session');

export async function saveSession(token) {
  await writeFile(SESSION_FILE, token, { encoding: 'utf8', mode: 0o600 });
}

export async function loadSession() {
  try {
    const token = await readFile(SESSION_FILE, 'utf8');
    return token.trim() || null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  try {
    await unlink(SESSION_FILE);
  } catch {
    // File may not exist — that's fine
  }
}
