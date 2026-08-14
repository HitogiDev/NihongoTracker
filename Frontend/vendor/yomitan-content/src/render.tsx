import { createElement, Fragment, type ReactNode } from 'react';

import { classifyHref } from './href';
import { NULL_DIAGNOSTICS, type DiagnosticsCollector } from './diagnostics';
import type { LookupRequest, StructuredContentElement, StructuredContentNode } from './types';
import {
  CLASS_CLASSES,
  HOOK_CLASSES,
  isSafeLanguage,
  isSafeToken,
  isSupportedTag,
  safeListStyleType,
  safeTitle,
} from './whitelist';

export interface RenderOptions {
  /** Fired when an internal dictionary cross-reference is activated. */
  onLookup?: (request: LookupRequest) => void;
  diagnostics?: DiagnosticsCollector;
  /** Extra classes for the root node, from the consumer. */
  className?: string;
}

interface Context {
  onLookup?: (request: LookupRequest) => void;
  diagnostics: DiagnosticsCollector;
}

/**
 * Render one structured-content tree to React elements.
 *
 * Every element is built with `createElement` from a whitelisted tag and a
 * whitelisted set of attributes. There is no `innerHTML` and no
 * `dangerouslySetInnerHTML` anywhere in this package, so nothing the dictionary
 * says can become markup — only text, or one of eight elements.
 */
export function renderStructuredContent(
  node: StructuredContentNode | undefined,
  options: RenderOptions = {}
): ReactNode {
  const context: Context = {
    onLookup: options.onLookup,
    diagnostics: options.diagnostics ?? NULL_DIAGNOSTICS,
  };
  return renderNode(node, context, 'root');
}

function renderNode(node: unknown, context: Context, key: string): ReactNode {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);

  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <Fragment key={`${key}.${index}`}>{renderNode(child, context, `${key}.${index}`)}</Fragment>
    ));
  }

  if (typeof node !== 'object') {
    context.diagnostics.skippedNode();
    return null;
  }

  return renderElement(node as StructuredContentElement, context, key);
}

function renderElement(element: StructuredContentElement, context: Context, key: string): ReactNode {
  const children = renderNode(element.content, context, `${key}>`);
  const tag = element.tag;

  // Unsupported tag — tables and images in this iteration. The element itself
  // goes, its contents stay, and the fact is counted.
  if (!isSupportedTag(tag)) {
    context.diagnostics.unsupportedTag(typeof tag === 'string' ? tag : '(missing)');
    return children;
  }

  if (tag === 'a') return renderLink(element, children, context, key);

  const props = baseProps(element, context);
  return createElement(tag, { ...props, key }, children);
}

/**
 * An `<a>` becomes one of two things and never a navigable link: a button that
 * asks for another lookup, or the text it was wrapping.
 */
function renderLink(
  element: StructuredContentElement,
  children: ReactNode,
  context: Context,
  key: string
): ReactNode {
  const policy = classifyHref(element.href);

  if (policy.kind === 'text' || !context.onLookup) {
    if (policy.kind === 'text') context.diagnostics.blockedLink(policy.reason);
    else context.diagnostics.blockedLink('no-handler');
    const props = baseProps(element, context);
    return createElement('span', { ...props, key }, children);
  }

  const { request } = policy;
  const onLookup = context.onLookup;
  const props = baseProps(element, context);
  return createElement(
    'button',
    {
      ...props,
      key,
      type: 'button',
      className: [props.className, 'link link-primary cursor-pointer text-start']
        .filter(Boolean)
        .join(' '),
      onClick: () => onLookup(request),
    },
    children
  );
}

interface BaseProps {
  className?: string;
  lang?: string;
  title?: string;
  style?: { listStyleType: string };
  'data-sc-content'?: string;
  'data-sc-class'?: string;
  'data-sc-code'?: string;
}

/**
 * The whitelist, applied. Anything not named here never reaches the DOM, and
 * anything named but malformed is dropped and counted.
 */
function baseProps(element: StructuredContentElement, context: Context): BaseProps {
  const props: BaseProps = {};
  const classes: string[] = [];

  const data = isRecord(element.data) ? element.data : undefined;

  const hook = data?.content;
  if (hook !== undefined) {
    if (isSafeToken(hook)) {
      props['data-sc-content'] = hook;
      // An empty entry means "known, styled by nothing of ours"; a missing one
      // is a hook this iteration does not cover, which is worth counting.
      if (hook in HOOK_CLASSES) {
        const styling = HOOK_CLASSES[hook];
        if (styling) classes.push(styling);
      } else {
        context.diagnostics.unstyledHook(hook);
      }
    } else {
      context.diagnostics.droppedAttribute('data.content');
    }
  }

  const styleClass = data?.class;
  if (styleClass !== undefined) {
    if (isSafeToken(styleClass)) {
      props['data-sc-class'] = styleClass;
      const styling = CLASS_CLASSES[styleClass];
      if (styling) classes.push(styling);
    } else {
      context.diagnostics.droppedAttribute('data.class');
    }
  }

  // Carried through because the dictionary stylesheet colours part-of-speech
  // badges by code; it is never used to build a class name of ours.
  const code = data?.code;
  if (code !== undefined) {
    if (isSafeToken(code)) props['data-sc-code'] = code;
    else context.diagnostics.droppedAttribute('data.code');
  }

  if (element.lang !== undefined) {
    if (isSafeLanguage(element.lang)) props.lang = element.lang;
    else context.diagnostics.droppedAttribute('lang');
  }

  if (element.title !== undefined) {
    const title = safeTitle(element.title);
    if (title) props.title = title;
    else context.diagnostics.droppedAttribute('title');
  }

  if (isRecord(element.style)) {
    for (const name of Object.keys(element.style)) {
      if (name !== 'listStyleType') {
        context.diagnostics.droppedAttribute(`style.${name}`);
      }
    }
    const listStyleType = safeListStyleType(element.style.listStyleType);
    if (listStyleType) props.style = { listStyleType };
    else if (element.style.listStyleType !== undefined) {
      context.diagnostics.droppedAttribute('style.listStyleType');
    }
  }

  if (classes.length > 0) props.className = classes.join(' ');
  return props;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
