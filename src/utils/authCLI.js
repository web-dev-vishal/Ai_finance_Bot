/**
 * Auth CLI — interactive terminal prompts for login, register, and password reset.
 *
 * Password input features:
 *  - Characters are hidden (shown as *) by default
 *  - Press Tab to toggle show/hide password while typing
 *  - Press Backspace to delete characters
 *  - Press Enter to confirm
 */
import authService from '../services/authService.js';
import { saveSession, loadSession, clearSession } from './sessionStore.js';

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
};
const clr  = (color, text) => `${C[color]}${text}${C.reset}`;
const bold = (text)         => `${C.bold}${text}${C.reset}`;
const dim  = (text)         => `${C.dim}${text}${C.reset}`;

// ── Hidden password input ─────────────────────────────────────────────────────

/**
 * Read a password from stdin with:
 *  - Characters masked as  *  by default
 *  - Tab key toggles between  *  (hidden) and plain text (visible)
 *  - Backspace deletes the last character
 *  - Enter submits
 *
 * @param {string} label  e.g. "Password" or "Confirm "
 * @returns {Promise<string>}
 */
function readPassword(label) {
  return new Promise((resolve, reject) => {
    const stdin  = process.stdin;
    const stdout = process.stdout;

    let input   = '';
    let visible = false; // hidden by default

    // Render the current line from scratch
    function render() {
      const masked  = visible ? input : '*'.repeat(input.length);
      const eyeHint = dim(' [Tab: ' + (visible ? 'hide' : 'show') + ']');
      // \r moves to start of line, \x1b[2K clears the whole line
      stdout.write(`\r\x1b[2K${clr('cyan', `  ${label} › `)}${masked}${eyeHint}`);
    }

    // Switch stdin to raw mode so we get each keypress immediately
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    function cleanup() {
      stdin.setEncoding('utf8'); // restore
      if (stdin.isTTY) stdin.setRawMode(wasRaw || false);
      stdin.pause();
      stdin.removeListener('data', onData);
    }

    function onData(ch) {
      // Ctrl+C — exit gracefully
      if (ch === '\u0003') {
        cleanup();
        stdout.write('\n');
        console.log(clr('yellow', '\n  Interrupted.\n'));
        process.exit(0);
      }

      // Enter — submit
      if (ch === '\r' || ch === '\n') {
        cleanup();
        // Move to next line and clear the hint
        stdout.write(`\r\x1b[2K${clr('cyan', `  ${label} › `)}${'*'.repeat(input.length)}\n`);
        resolve(input);
        return;
      }

      // Tab — toggle show/hide
      if (ch === '\t') {
        visible = !visible;
        render();
        return;
      }

      // Backspace / Delete
      if (ch === '\u007f' || ch === '\b') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          render();
        }
        return;
      }

      // Ignore other control characters (arrows, function keys, etc.)
      if (ch < ' ' && ch !== '\t') return;

      // Regular printable character
      input += ch;
      render();
    }

    render(); // show initial prompt
    stdin.on('data', onData);
  });
}

// ── Plain text prompt ─────────────────────────────────────────────────────────

async function ask(rl, label) {
  const answer = await rl.question(clr('cyan', `  ${label} › `));
  return answer.trim();
}

// ── Divider ───────────────────────────────────────────────────────────────────
function divider() {
  console.log(clr('cyan', '  ' + '─'.repeat(48)));
}

// ── Auth banner & menu ────────────────────────────────────────────────────────

function printAuthBanner() {
  console.log('\n' + clr('cyan', '  ' + '═'.repeat(48)));
  console.log(clr('cyan', '  ║') + bold('   🔐  FinanceBot — Authentication          ') + clr('cyan', '║'));
  console.log(clr('cyan', '  ' + '═'.repeat(48)));
}

function printMenu() {
  console.log(`
  ${clr('cyan', '1')}  Login
  ${clr('cyan', '2')}  Register (new account)
  ${clr('cyan', '3')}  Forgot password / Reset
  ${clr('cyan', '4')}  Exit
`);
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function doLogin(rl) {
  console.log(clr('cyan', '\n  Login\n'));
  divider();

  const email    = await ask(rl, 'Email   ');
  const password = await readPassword('Password');

  divider();

  const { user, token } = await authService.login({ email, password });
  await saveSession(token);
  console.log(clr('green', `\n  ✅  Welcome back, ${user.name}!\n`));
  return user;
}

// ── Register ──────────────────────────────────────────────────────────────────
async function doRegister(rl) {
  console.log(clr('cyan', '\n  Create a new account\n'));
  divider();

  const name     = await ask(rl, 'Name    ');
  const email    = await ask(rl, 'Email   ');
  const password = await readPassword('Password');
  const confirm  = await readPassword('Confirm ');

  divider();

  if (password !== confirm) {
    throw new Error('Passwords do not match. Please try again.');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const { user, token } = await authService.register({ name, email, password });
  await saveSession(token);
  console.log(clr('green', `\n  ✅  Account created! Welcome, ${user.name}!\n`));
  return user;
}

// ── Forgot password ───────────────────────────────────────────────────────────
async function doForgotPassword(rl) {
  console.log(clr('cyan', '\n  Password Reset\n'));
  divider();

  const email = await ask(rl, 'Email   ');

  console.log(dim('\n  Sending OTP to your email…'));
  const msg = await authService.forgotPassword(email);
  console.log(clr('yellow', `\n  ${msg}\n`));

  divider();
  const otp         = await ask(rl, 'OTP     ');
  const newPassword = await readPassword('New Pass');
  const confirm     = await readPassword('Confirm ');
  divider();

  if (newPassword !== confirm) {
    throw new Error('Passwords do not match. Please try again.');
  }

  const result = await authService.resetPassword({ email, otp, newPassword });
  console.log(clr('green', `\n  ${result}\n`));
  console.log(dim('  You can now log in with your new password.\n'));
}

// ── Main auth gate ────────────────────────────────────────────────────────────

/**
 * Run the authentication gate.
 * - Tries to restore a saved session first (auto-login).
 * - If no valid session, shows the auth menu.
 * - Returns the authenticated user object.
 *
 * @param {import('readline/promises').Interface} rl
 * @returns {Promise<{ _id, name, email }>}
 */
export async function runAuthGate(rl) {
  // 1. Try to restore saved session — skip menu if still valid
  const savedToken = await loadSession();
  if (savedToken) {
    try {
      const user = await authService.verifySession(savedToken);
      console.log(dim(`\n  Auto-logged in as ${user.name} (${user.email})`));
      return user;
    } catch {
      // Session expired or revoked — clear and show menu
      await clearSession();
    }
  }

  // 2. Show auth menu
  printAuthBanner();

  while (true) {
    printMenu();

    const choice = (await rl.question(clr('cyan', '  Choose › '))).trim();

    try {
      switch (choice) {
        case '1':
          return await doLogin(rl);

        case '2':
          return await doRegister(rl);

        case '3':
          await doForgotPassword(rl);
          console.log(clr('yellow', '  Please log in with your new password.\n'));
          break;

        case '4':
          console.log(clr('yellow', '\n  Goodbye!\n'));
          process.exit(0);
          break;

        default:
          console.log(clr('yellow', '\n  Please enter 1, 2, 3, or 4.\n'));
      }
    } catch (err) {
      console.log(clr('red', `\n  ❌  ${err.message}\n`));

      // Helpful hint when account doesn't exist
      if (
        err.message.includes('No account found') ||
        err.message.includes('Invalid email or password')
      ) {
        console.log(
          clr('yellow', '  💡  No account yet? Choose ') +
          clr('cyan', '2') +
          clr('yellow', ' to Register.\n')
        );
      }
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
