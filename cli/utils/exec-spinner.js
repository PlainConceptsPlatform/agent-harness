import chalk from 'chalk'
import ora from 'ora'

// ── Screen / step state ──────────────────────────────────────────────────────

const previousSteps = [];    // up to 2 completed steps, each is an array of lines
let currentStepLines = [];   // lines accumulated in the current step
let stepSpinner = null;      // ora spinner shown while step is working

export function appendLine(line) {
  currentStepLines.push(line);
}

export function stopSpinner() {
  if (stepSpinner) {
    stepSpinner.stop();
    stepSpinner = null;
  }
}

export function startSpinner(text = 'working...') {
  stopSpinner();
  stepSpinner = ora({ text: chalk.dim(text), color: 'red' }).start();
}

export function redraw() {
  if (process.stdout.isTTY) console.clear();

  // Show up to 2 previous steps dimmed
  for (const stepLines of previousSteps) {
    for (const line of stepLines) {
      process.stdout.write(`${chalk.dim(line)}\n`);
    }
    process.stdout.write('\n');
  }

  // Current step output
  for (const line of currentStepLines) {
    process.stdout.write(`${line}\n`);
  }
}

export function rotateStep() {
  previousSteps.push(currentStepLines);
  if (previousSteps.length > 2) previousSteps.shift();
  currentStepLines = [];
}
