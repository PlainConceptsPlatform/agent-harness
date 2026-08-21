import chalk from 'chalk'
import { execa } from 'execa'
import ora from 'ora'
import { appendLine, redraw, rotateStep, startSpinner, stopSpinner } from './exec-spinner.js'
import { MARKERS } from './terminal.js';

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a shell command with a spinner.
 * Returns { success, stdout, stderr }
 */
export async function run(command, args = [], { label, cwd = process.cwd() } = {}) {
  const spinner = ora(label ?? `${command} ${args.join(' ')}`).start();
  try {
    const result = await execa(command, args, { cwd, reject: false });
    if (result.exitCode === 0) {
      spinner.succeed();
    } else {
      spinner.fail();
    }
    return { success: result.exitCode === 0, stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    spinner.fail();
    return { success: false, stdout: '', stderr: err.message };
  }
}

/**
 * Check if a command is available on PATH.
 * Returns true/false.
 */
export async function commandExists(command) {
  try {
    const result = await execa(command, ['--version'], { reject: false });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Print a section header, clears screen, shows previous step dimmed, starts new step.
 */
export function header(text) {
  rotateStep();

  const line1 = '';
  const line2 = chalk.bold.hex('#fe3d57')(`━━ ${text}`);
  const line3 = '';

  appendLine(line1);
  appendLine(line2);
  appendLine(line3);

  redraw();

  startSpinner('working...');
}

/**
 * Restart the step spinner after prompts or logs.
 */
export function loading(text = 'working...') {
  startSpinner(text);
}

/**
 * Print a success line.
 */
export function success(text) {
  stopSpinner();
  const line = chalk.green(`${MARKERS.OK_PREFIX}${text}`);
  appendLine(line);
  console.log(line);
}

/**
 * Print a warning line.
 */
export function warn(text) {
  stopSpinner();
  const line = chalk.yellow(`${MARKERS.WARN_PREFIX}${text}`);
  appendLine(line);
  console.log(line);
}

/**
 * Print an error line.
 */
export function error(text) {
  stopSpinner();
  const line = chalk.red(`${MARKERS.ERROR_PREFIX}${text}`);
  appendLine(line);
  console.log(line);
}

/**
 * Print an info line.
 */
export function info(text) {
  stopSpinner();
  const line = chalk.dim(`${MARKERS.EMPTY}${text}`);
  appendLine(line);
  console.log(line);
}

/**
 * Print an action prompt line (white bold, requires user interaction).
 */
export function prompt(text) {
  stopSpinner();
  const line = chalk.bold(`${MARKERS.EMPTY}${text}`);
  appendLine(line);
  console.log(line);
}

/**
 * Print a code block.
 */
export function code(lines) {
  stopSpinner();
  appendLine('');
  console.log();
  for (const line of lines) {
    const formatted = chalk.bgGray.white(
      `${MARKERS.EMPTY}${line}${MARKERS.EMPTY}`,
    );
    appendLine(formatted);
    console.log(formatted);
  }
  appendLine('');
  console.log();
}
