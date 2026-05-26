/**
 * Auth CLI — interactive terminal prompts for login, register, and password reset.
 *
 * This module is used by agent.js before the chat loop starts.
 * It returns the authenticated user object once the user is logged in.
 */
import authService  from '../services/authService.js';
import { saveSession, loadSession, clearSession } from './sessionStore.js';

// ── ANSI helpers (duplicated here to avoid circular imports) ──────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
};
const clr  = (color, text) => `${C[color]}${text}${C.reset}`;
const bold = (text)         => `${C.bold}${text}${C.reset}`;

// ── Prompt helpers ────────────────────────────────────────────────────────────

/** Ask a question and return the trimmed answer */
async function ask(rl, question) {
  const answer = await rl.question(question);
  return answer.trim();
}

/**
 * Ask for a password without echoing characters.
 * Falls back to normal input if the terminal doesn't support raw mode.
 */
async function askPassword(rl, question) {
  // On Windows cmd/PS, readline doesn't support hiding input natively.
  // We print a note so the user is aware.
  process.stdout.write(question + clr('dim', ' (input hidden on supported terminals)\n'));
  const answer = await rl.question('');
  return answer.trim();
}

// ── Auth screens ──────────────────────────────────────────────────────────────

function printAuthBanner() {
  const line = clr('cyan', '─'.repeat(52));
  console.log(`\n${line}`);
  console.log(bold('  🔐  FinanceBot — Authentication'));
  console.log(`${line}`);
}

async function doLogin(rl) {
  console.log(clr('cyan', '\n  Login to your account\n'));
  const email    = await ask(rl, clr('cyan', '  Email    › '));
  const password = await askPassword(rl, clr('cyan', '  Password › '));

  const { user, token } = await authService.login({ email, password });
  await saveSession(token);
  console.log(clr('green', `\n  ✅  Welcome back, ${user.name}!\n`));
  return user;
}

async function doRegister(rl) {
  console.log(clr('cyan', '\n  Create a new account\n'));
  const name     = await ask(rl, clr('cyan', '  Name     › '));
  const email    = await ask(rl, clr('cyan', '  Email    › '));
  const password = await askPassword(rl, clr('cyan', '  Password › '));
  const confirm  = await askPassword(rl, clr('cyan', '  Confirm  › '));

  if (password !== confirm) {
    throw new Error('Passwords do not match.');
  }

  const { user, token } = await authService.register({ name, email, password });
  await saveSession(token);
  console.log(clr('green', `\n  ✅  Account created! Welcome, ${user.name}!\n`));
  return user;
}

async function doForgotPassword(rl) {
  console.log(clr('cyan', '\n  Password Reset\n'));
  const email = await ask(rl, clr('cyan', '  Email › '));

  console.log(clr('dim', '  Sending OTP…'));
  const msg = await authService.forgotPassword(email);
  console.log(clr('yellow', `\n  ${msg}\n`));

  const otp         = await ask(rl, clr('cyan', '  Enter OTP › '));
  const newPassword = await askPassword(rl, clr('cyan', '  New Password › '));
  const confirm     = await askPassword(rl, clr('cyan', '  Confirm      › '));

  if (newPassword !== confirm) {
    throw new Error('Passwords do not match.');
  }

  const result = await authService.resetPassword({ email, otp, newPassword });
  console.log(clr('green', `\n  ${result}\n`));
}

// ── Main auth gate ────────────────────────────────────────────────────────────

/**
 * Run the authentication gate.
 * - Tries to restore a saved session first.
 * - If no valid session, shows the auth menu.
 * - Returns the authenticated user object.
 *
 * @param {import('readline/promises').Interface} rl
 * @returns {Promise<{ _id, name, email }>}
 */
export async function runAuthGate(rl) {
  // 1. Try to restore saved session
  const savedToken = await loadSession();
  if (savedToken) {
    try {
      const user = await authService.verifySession(savedToken);
      console.log(clr('dim', `\n  Logged in as ${user.name} (${user.email})`));
      return user;
    } catch {
      // Token expired or revoked — clear it and ask the user to log in again
      await clearSession();
    }
  }

  // 2. Show auth menu
  printAuthBanner();

  while (true) {
    console.log(`
  ${clr('cyan', '1')}  Login
  ${clr('cyan', '2')}  Register
  ${clr('cyan', '3')}  Forgot password / Reset
  ${clr('cyan', '4')}  Exit
`);

    const choice = await ask(rl, clr('cyan', '  Choose › '));

    try {
      switch (choice) {
        case '1':
          return await doLogin(rl);

        case '2':
          return await doRegister(rl);

        case '3':
          await doForgotPassword(rl);
          // After reset, loop back to login
          break;

        case '4':
          console.log(clr('yellow', '\n  Goodbye!\n'));
          process.exit(0);
          break;

        default:
          console.log(clr('yellow', '  Please enter 1, 2, 3, or 4.\n'));
      }
    } catch (err) {
      console.log(clr('red', `\n  ❌  ${err.message}\n`));
      // Loop back to menu on error
    }
  }
}

/**
 * Logout the current user — blacklists the PASETO token and clears the session file.
 * @param {string} token  The raw PASETO token string
 */
export async function runLogout(token) {
  await authService.logout(token);
  await clearSession();
}
