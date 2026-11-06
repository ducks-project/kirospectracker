/**
 * Captured runtime environment for a benchmark run.
 */
export interface IBenchmarkEnvironment {
  /** Operating system name (`os.type()`). */
  readonly osName: string;
  /** CPU model string (`os.cpus()[0].model`). */
  readonly cpuModel: string;
  /** Node.js version (`process.version`). */
  readonly nodeVersion: string;
}

/**
 * One measured benchmark size.
 */
export interface IBenchmarkMeasurement {
  /** Human label of the size bucket (e.g. "small (~100 chars)"). */
  readonly label: string;
  /** Input size expressed as a UTF-16 character count. */
  readonly characterCount: number;
  /** Measured latency value. */
  readonly value: number;
  /** Unit of `value` (e.g. "ns/iter"). */
  readonly unit: string;
}
