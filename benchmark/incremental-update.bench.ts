import { cpus, type as osType } from 'node:os';

import { bench, do_not_optimize, group, run } from 'mitata';

import type { ISpecDocuments } from '../src/core/model/ISpecDocuments';
import type { ISpecProgress } from '../src/core/model/ISpecProgress';
import type { ISpecSnapshot } from '../src/core/model/ISpecSnapshot';
import { SpecStatus } from '../src/core/model/SpecStatus';
import { SpecCardViewMapper } from '../src/core/status/SpecCardViewMapper';
import { SpecStatsCalculator } from '../src/core/status/SpecStatsCalculator';
import type { IBenchmarkEnvironment } from './types';

/** Unit of the serialised measurement value (mitata reports ns/iter). */
const LATENCY_UNIT = 'ns/iter';

/** Process exit code used when the suite throws. */
const FAILURE_EXIT_CODE = 1;

/** Spec counts simulating a small, a medium and a 500-spec workspace. */
const SMALL_SPEC_COUNT = 50;
const MEDIUM_SPEC_COUNT = 200;
const LARGE_SPEC_COUNT = 500;

/** Number of statuses cycled through so the aggregate has a realistic spread. */
const STATUS_CYCLE = [
  SpecStatus.Completed,
  SpecStatus.InProgress,
  SpecStatus.NotStarted,
  SpecStatus.Malformed,
  SpecStatus.FullyCompleted,
] as const;

/** Every generated spec exposes the same document-presence flags. */
const ALL_DOCUMENTS_PRESENT: ISpecDocuments = {
  tasks: true,
  requirements: true,
  design: true,
  notes: true,
};

/** Required leaf-task total used to synthesise a plausible progress ratio. */
const REQUIRED_TASK_TOTAL = 8;

/**
 * Build a plausible progress object for the spec at `index`.
 * @param index Zero-based spec index.
 * @returns An immutable progress value derived from the index.
 */
function makeProgress(index: number): ISpecProgress {
  const requiredDone = index % (REQUIRED_TASK_TOTAL + 1);
  return {
    requiredDone,
    requiredTotal: REQUIRED_TASK_TOTAL,
    optionalDone: 0,
    optionalTotal: 0,
    requiredRatio: requiredDone / REQUIRED_TASK_TOTAL,
    optionalRatio: 0,
  };
}

/**
 * Build an array of `count` synthetic spec snapshots with a realistic spread of
 * statuses and progress, standing in for a discovered workspace.
 * @param count Number of snapshots to generate.
 * @returns The generated immutable snapshots.
 */
function makeSnapshots(count: number): readonly ISpecSnapshot[] {
  const snapshots: ISpecSnapshot[] = [];
  for (let index = 0; index < count; index += 1) {
    const folderPath = `/workspace/.kiro/specs/spec-${index}`;
    snapshots.push({
      name: `spec-${index}`,
      folderPath,
      workspacePath: '/workspace',
      documents: ALL_DOCUMENTS_PRESENT,
      status: STATUS_CYCLE[index % STATUS_CYCLE.length],
      progress: makeProgress(index),
    });
  }
  return snapshots;
}

/** One benchmark size definition. */
interface IBenchmarkSize {
  /** Human label of the size bucket. */
  readonly label: string;
  /** Generated snapshots for this size. */
  readonly snapshots: readonly ISpecSnapshot[];
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
 * Benchmark entry point contrasting the OLD full fan-out (project every
 * snapshot to a card, then recompute the aggregate) with the NEW incremental
 * `specUpdated` path (project only the changed snapshot, then recompute the
 * aggregate) across 50/200/500 specs.
 *
 * OLD simulates the former full-render fan-out: it projects every snapshot to
 * a card and recomputes the aggregate stats on each edit, so it grows linearly
 * with the spec count. NEW simulates the `specUpdated` path: it projects only
 * the single changed snapshot, so it stays flat regardless of the spec count.
 * The real provider also recomputes stats on `specUpdated`, but that is a
 * single-field O(N) scan shared with OLD and is kept out of the NEW body here
 * to isolate the projection work that actually changed from O(N) to O(1).
 */
async function main(): Promise<void> {
  const mapper = new SpecCardViewMapper();
  const stats = new SpecStatsCalculator();

  const sizes: readonly IBenchmarkSize[] = [
    { label: `small (${SMALL_SPEC_COUNT} specs)`, snapshots: makeSnapshots(SMALL_SPEC_COUNT) },
    { label: `medium (${MEDIUM_SPEC_COUNT} specs)`, snapshots: makeSnapshots(MEDIUM_SPEC_COUNT) },
    { label: `large (${LARGE_SPEC_COUNT} specs)`, snapshots: makeSnapshots(LARGE_SPEC_COUNT) },
  ];

  const specCounts = sizes.map(({ label, snapshots }) => ({
    label,
    specCount: snapshots.length,
  }));
  // eslint-disable-next-line no-console
  console.table(specCounts);
  // eslint-disable-next-line no-console
  console.log(`Environment: ${JSON.stringify(captureEnvironment())}; unit: ${LATENCY_UNIT}`);

  group('OLD full fan-out (project all cards + stats)', () => {
    sizes.forEach(({ label, snapshots }) => {
      bench(label, () => {
        do_not_optimize(mapper.mapAll(snapshots));
        do_not_optimize(stats.calculate(snapshots));
      });
    });
  });

  group('NEW incremental specUpdated (one card)', () => {
    sizes.forEach(({ label, snapshots }) => {
      const [changed] = snapshots;
      bench(label, () => do_not_optimize(mapper.map(changed)));
    });
  });

  await run();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Benchmark run failed', error);
  process.exit(FAILURE_EXIT_CODE);
});
