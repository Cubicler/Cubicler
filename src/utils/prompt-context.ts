/**
 * Utilities to augment prompts with invocation context
 * so the agent knows whether it's handling messages or webhooks.
 */

export type InvocationType = 'message' | 'webhook';

export interface WebhookContextDetails {
  identifier?: string;
  name?: string;
  triggeredAt?: string;
}

export interface InvocationContext {
  type: InvocationType;
  webhook?: WebhookContextDetails;
}

/**
 * Append a short invocation context section to the prompt.
 * Keeps the base prompt intact and adds a concise header.
 */
export function withInvocationContext(basePrompt: string, context: InvocationContext): string {
  const sections: string[] = [];

  // Ensure the base prompt is trimmed but preserved
  if (basePrompt && basePrompt.trim().length > 0) {
    sections.push(basePrompt.trim());
  }

  const header = '## Invocation Context';

  if (context.type === 'message') {
    const lines: string[] = [
      `${header}`,
      '',
      'You are handling a direct message dispatch.',
      '',
      `- Source: messages array (user inputs)`,
      `- Guidance: Use the \`messages\` array for context and respond accordingly.`,
      `- Note: Webhook-specific \`trigger\` is not set for this invocation.`,
    ];
    sections.push(lines.join('\n'));
  } else if (context.type === 'webhook') {
    const details = context.webhook || {};
    const lines: string[] = [
      `${header}`,
      '',
      'You are handling a webhook-triggered invocation.',
      '',
      `- Identifier: ${details.identifier ?? 'n/a'}`,
      `- Name: ${details.name ?? 'n/a'}`,
      `- Triggered At: ${details.triggeredAt ?? 'n/a'}`,
      '- Guidance: Use the `trigger` object, especially `trigger.payload`, as the event source.',
      '- Note: Message `messages` may be absent for webhook-only invocations.',
    ];
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}
