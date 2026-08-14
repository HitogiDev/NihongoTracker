export { StructuredContent, DICTIONARY_SCOPE_CLASS } from './StructuredContent';
export type { StructuredContentProps } from './StructuredContent';

export { renderStructuredContent } from './render';
export type { RenderOptions } from './render';

export { classifyHref } from './href';
export type { LinkPolicy } from './href';

export { scopeDictionaryCss } from './css';
export type { ScopeResult } from './css';

export { createDiagnostics, NULL_DIAGNOSTICS } from './diagnostics';
export type { DiagnosticsCollector, RenderDiagnostics } from './diagnostics';

export { useLookupHistory } from './history';
export type { LookupHistory } from './history';

export {
  SUPPORTED_TAGS,
  HOOK_CLASSES,
  CLASS_CLASSES,
  isSupportedTag,
} from './whitelist';
export type { SupportedTag } from './whitelist';

export type {
  Glossary,
  LookupRequest,
  StructuredContentElement,
  StructuredContentNode,
} from './types';
