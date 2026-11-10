import type { ISpecAgentGateway } from '../../core/ports/ISpecAgentGateway';
import type { ITranslator } from '../../core/ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../../core/i18n/IdentityTranslator';
import type { IAgentDiagnosticSink } from '../ports/IAgentDiagnosticSink';
import type { IAgentErrorReporter } from '../ports/IAgentErrorReporter';
import type { IAgentNotifier } from '../ports/IAgentNotifier';
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
 * @param notifier The success/affordance channel passed to the Kiro adapter.
 * @param diagnostics The observability sink passed to the Kiro adapter.
 * @param fallback The Null-Object fallback (already wired over the honest MVP).
 * @param enabled Whether the agent integration is enabled (the setting).
 * @param translator The translator for the toasts (English by default).
 * @returns The selected gateway.
 */
export async function createSpecAgentGateway(
  commands: ICommandGateway,
  reporter: IAgentErrorReporter,
  notifier: IAgentNotifier,
  diagnostics: IAgentDiagnosticSink,
  fallback: UnavailableAgentGateway,
  enabled: boolean,
  translator: ITranslator = IDENTITY_TRANSLATOR,
): Promise<ISpecAgentGateway> {
  if (!enabled) {
    return fallback;
  }
  const ids = await commands.getCommands();
  if (KiroChatAgentGateway.isSupported(ids)) {
    return new KiroChatAgentGateway(commands, reporter, notifier, diagnostics, translator);
  }
  return fallback;
}
