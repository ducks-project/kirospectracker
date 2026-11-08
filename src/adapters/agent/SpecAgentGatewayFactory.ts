import type { ISpecAgentGateway } from '../../core/ports/ISpecAgentGateway';
import type { IAgentErrorReporter } from '../ports/IAgentErrorReporter';
import type { ICommandGateway } from '../ports/ICommandGateway';
import { KiroChatAgentGateway } from './KiroChatAgentGateway';
import { UnavailableAgentGateway } from './UnavailableAgentGateway';

/**
 * Factory building the right {@link ISpecAgentGateway} at activation by
 * capability detection, honoring the disable setting.
 *
 * When the integration is disabled, it always binds the Null-Object fallback
 * regardless of capability. Otherwise it probes the command surface once: a
 * usable Kiro (or generic chat) surface yields the best-effort
 * {@link KiroChatAgentGateway}; otherwise the Null-Object fallback. Selection is
 * the single adapter decision in the composition root (Dependency Inversion).
 * @param commands The thin command/clipboard gateway (probed once).
 * @param reporter The error channel passed to the Kiro adapter.
 * @param fallback The Null-Object fallback (already wired over the honest MVP).
 * @param enabled Whether the agent integration is enabled (the setting).
 * @returns The selected gateway.
 */
export async function createSpecAgentGateway(
  commands: ICommandGateway,
  reporter: IAgentErrorReporter,
  fallback: UnavailableAgentGateway,
  enabled: boolean,
): Promise<ISpecAgentGateway> {
  if (!enabled) {
    return fallback;
  }
  const ids = await commands.getCommands();
  if (KiroChatAgentGateway.isSupported(ids)) {
    return new KiroChatAgentGateway(commands, reporter);
  }
  return fallback;
}
