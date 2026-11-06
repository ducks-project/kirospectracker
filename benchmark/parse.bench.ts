import { cpus, type as osType } from 'node:os';

import { bench, group, run } from 'mitata';

import { TasksMarkdownParser } from '../src/core/parsing/TasksMarkdownParser';
import type { IBenchmarkEnvironment, IBenchmarkMeasurement } from './types';

/** Line separator used to assemble the synthetic documents. */
const LINE_FEED = '\n';

/** Unit of the serialised measurement value (mitata reports ns/iter). */
const LATENCY_UNIT = 'ns/iter';

/** Process exit code used when the suite throws. */
const FAILURE_EXIT_CODE = 1;

/**
 * Line counts for the small/medium/large synthetic `tasks.md` bodies, each at
 * least ten times larger than the previous one.
 */
const SMALL_TASK_COUNT = 5;
const MEDIUM_TASK_COUNT = 250;
const LARGE_TASK_COUNT = 2_500;

/** One benchmark size definition. */
interface IBenchmarkSize {
  /** Human label of the size bucket. */
  readonly label: string;
  /** Generated `tasks.md` body for this size. */
  readonly text: string;
}

/**
 * Build a synthetic `tasks.md` body of `taskCount` tasks, mixing done, pending,
 * optional and requirement-annotated lines so the parser has real work to do.
 * @param taskCount Number of top-level tasks to generate.
 * @returns A single string representing the document body.
 */
function makeTasks(taskCount: number): string {
  const lines: string[] = ['# Implementation Plan', ''];
  for (let index = 1; index <= taskCount; index += 1) {
    const mark = 0 === index % 2 ? 'x' : ' ';
    const optional = 0 === index % 5 ? '*' : '';
    lines.push(`- [${mark}]${optional} ${index}. Task number ${index} with some descriptive text`);
    lines.push(`  - _Requirements: ${index}.1, ${index}.2_`);
  }
  return lines.join(LINE_FEED);
}

/**
 * Capture the current runtime environment for the report.
 * @returns The OS name, CPU model, and Node.js version.
 */
function captureEnvironment(): IBenchmarkEnvironment {
  const [firstCpu] = cpus();
  return {
    osName: osType(),
    cpuModel: firstCpu.model,
    nodeVersion: process.version,
  };
}

/**
 * Benchmark entry point measuring the cost of parsing a `tasks.md` across
 * representative sizes. Non-blocking: it reports numbers and exits zero.
 */
async function main(): Promise<void> {
  const parser = new TasksMarkdownParser();

  const sizes: readonly IBenchmarkSize[] = [
    { label: 'small (~5 tasks)', text: makeTasks(SMALL_TASK_COUNT) },
    { label: 'medium (~250 tasks)', text: makeTasks(MEDIUM_TASK_COUNT) },
    { label: 'large (~2500 tasks)', text: makeTasks(LARGE_TASK_COUNT) },
  ];

  const characterCounts: ReadonlyArray<Pick<IBenchmarkMeasurement, 'label' | 'characterCount'>> =
    sizes.map(({ label, text }) => ({ label, characterCount: text.length }));
  // eslint-disable-next-line no-console
  console.table(characterCounts);
  // eslint-disable-next-line no-console
  console.log(`Environment: ${JSON.stringify(captureEnvironment())}; unit: ${LATENCY_UNIT}`);

  group('TasksMarkdownParser.parse', () => {
    sizes.forEach(({ label, text }) => {
      bench(label, () => parser.parse(text));
    });
  });

  await run();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Benchmark run failed', error);
  process.exit(FAILURE_EXIT_CODE);
});
