import type { ISpecConfig } from '../../core/model/ISpecConfig';
import type { ISpecConfigReader } from '../../core/ports/ISpecConfigReader';
import type { ISpecFileSystem } from '../ports/ISpecFileSystem';
import { parseSpecConfig } from '../../core/parsing/SpecConfigParser';
/** Name of the per-spec config file written by Kiro (undocumented format). */
const CONFIG_FILE_NAME = '.config.kiro';
/**
 * {@link ISpecConfigReader} reading `.config.kiro` through {@link ISpecFileSystem}
 * (no `vscode` import). Absent or unreadable files resolve to an empty config.
 */
export class KiroSpecConfigReader implements ISpecConfigReader {
  private readonly fileSystem: ISpecFileSystem;
  /**
   * Build the reader over the file-system port.
   * @param fileSystem The `vscode`-free file-system port.
   */
  public constructor(fileSystem: ISpecFileSystem) {
    this.fileSystem = fileSystem;
  }
  /**
   * Read and parse the config of a spec folder.
   * @param folderPath Absolute path of the spec folder.
   * @returns The tolerant config; never rejects.
   */
  public async read(folderPath: string): Promise<ISpecConfig> {
    const content = await this.fileSystem.readFile(
      this.fileSystem.join(folderPath, CONFIG_FILE_NAME),
    );
    return parseSpecConfig(content);
  }
}
