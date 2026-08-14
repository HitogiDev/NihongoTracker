/**
 * What the renderer met and could not render as itself.
 *
 * Nothing is ever dropped silently — an unsupported node still renders its
 * contents — but "rendered as a plain span" and "rendered as the table it is"
 * look identical on screen, so the difference is counted instead. This is how
 * the next iteration knows what is actually worth adding.
 */
export interface RenderDiagnostics {
  /** Tag name → how many nodes fell through to their children. */
  readonly unsupportedTags: Readonly<Record<string, number>>;
  /** `data-sc-content` values with no base style of ours. */
  readonly unstyledHooks: Readonly<Record<string, number>>;
  /** `<a href>` values refused, by reason. */
  readonly blockedLinks: Readonly<Record<string, number>>;
  /** Attributes rejected by the whitelist, by attribute name. */
  readonly droppedAttributes: Readonly<Record<string, number>>;
  /** Nodes that were neither a string, a number, an array nor an element. */
  readonly skippedNodes: number;
}

export interface DiagnosticsCollector {
  unsupportedTag(tag: string): void;
  unstyledHook(hook: string): void;
  blockedLink(reason: string): void;
  droppedAttribute(name: string): void;
  skippedNode(): void;
  snapshot(): RenderDiagnostics;
  /** True when everything in the tree was rendered as itself. */
  isClean(): boolean;
}

export function createDiagnostics(): DiagnosticsCollector {
  const unsupportedTags: Record<string, number> = {};
  const unstyledHooks: Record<string, number> = {};
  const blockedLinks: Record<string, number> = {};
  const droppedAttributes: Record<string, number> = {};
  let skippedNodes = 0;

  const bump = (into: Record<string, number>, key: string) => {
    into[key] = (into[key] ?? 0) + 1;
  };

  return {
    unsupportedTag: (tag) => bump(unsupportedTags, tag),
    unstyledHook: (hook) => bump(unstyledHooks, hook),
    blockedLink: (reason) => bump(blockedLinks, reason),
    droppedAttribute: (name) => bump(droppedAttributes, name),
    skippedNode: () => {
      skippedNodes += 1;
    },
    snapshot: () => ({
      unsupportedTags: { ...unsupportedTags },
      unstyledHooks: { ...unstyledHooks },
      blockedLinks: { ...blockedLinks },
      droppedAttributes: { ...droppedAttributes },
      skippedNodes,
    }),
    isClean: () =>
      Object.keys(unsupportedTags).length === 0 &&
      Object.keys(droppedAttributes).length === 0 &&
      skippedNodes === 0,
  };
}

/** A collector that counts nothing, for callers that do not care. */
export const NULL_DIAGNOSTICS: DiagnosticsCollector = {
  unsupportedTag: () => {},
  unstyledHook: () => {},
  blockedLink: () => {},
  droppedAttribute: () => {},
  skippedNode: () => {},
  snapshot: () => ({
    unsupportedTags: {},
    unstyledHooks: {},
    blockedLinks: {},
    droppedAttributes: {},
    skippedNodes: 0,
  }),
  isClean: () => true,
};
