import hearts from '../assets/avatar-frames/hearts.svg?raw';
import starlight from '../assets/avatar-frames/starlight.svg?raw';
import sigil from '../assets/avatar-frames/sigil.svg?raw';
import fireflies from '../assets/avatar-frames/fireflies.svg?raw';
import type { AvatarFrame } from '../types';

const sources = { hearts, starlight, sigil, fireflies };
type DecorativeFrame = keyof typeof sources;

interface MotionLayer {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  opacity: string;
  children: FrameLayer[];
}

interface ImageLayer {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type FrameLayer = MotionLayer | ImageLayer;
const cache = new Map<DecorativeFrame, FrameLayer[]>();
const namespace = 'http://www.w3.org/2000/svg';
const glowPadding = 40;

function cssMatrix(
  matrix: Pick<DOMMatrix, 'a' | 'b' | 'c' | 'd' | 'e' | 'f'>
): string {
  // Some browsers return SVGMatrix, which does not serialize as a CSS transform.
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
}

export function isDecorativeFrame(
  frame?: AvatarFrame | null
): frame is DecorativeFrame {
  return Boolean(frame && Object.prototype.hasOwnProperty.call(sources, frame));
}

function compileLayers(frame: DecorativeFrame): FrameLayer[] {
  const cached = cache.get(frame);
  if (cached) return cached;

  // Only bundled SVG assets enter this compiler.
  const source = new DOMParser().parseFromString(
    sources[frame],
    'image/svg+xml'
  );
  const svg = document.importNode(
    source.documentElement,
    true
  ) as unknown as SVGSVGElement;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(svg.querySelector('style')?.textContent ?? '');
  const rules = Array.from(sheet.cssRules);
  const keyframes = new Map(
    rules
      .filter(
        (rule): rule is CSSKeyframesRule => rule.type === CSSRule.KEYFRAMES_RULE
      )
      .map((rule) => [rule.name, rule])
  );
  svg.querySelector('style')?.remove();
  svg.setAttribute('width', '240');
  svg.setAttribute('height', '240');
  svg.style.cssText =
    'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none';
  svg.setAttribute('aria-hidden', 'true');
  document.body.append(svg);

  const animationStyle = (node: Element) => {
    const style = document.createElement('span').style;
    for (const rule of rules) {
      if (rule.type === CSSRule.STYLE_RULE) {
        const css = rule as CSSStyleRule;
        if (node.matches(css.selectorText)) style.cssText += css.style.cssText;
      }
    }
    style.cssText += node.getAttribute('style') ?? '';
    return style;
  };

  const hasMotion = (node: Element): boolean =>
    Boolean(animationStyle(node).animationName) ||
    Array.from(node.children).some(hasMotion);

  const imageLayer = (
    node: SVGGraphicsElement,
    ancestors: SVGGraphicsElement[]
  ): ImageLayer => {
    const bounds = node.getBBox();
    const matrix = node.getCTM() ?? new DOMMatrix();
    const corners = [
      new DOMPoint(bounds.x, bounds.y),
      new DOMPoint(bounds.x + bounds.width, bounds.y),
      new DOMPoint(bounds.x, bounds.y + bounds.height),
      new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height),
    ].map((point) => point.matrixTransform(matrix));
    // Keep the original viewport clipping and leave room for the baked glow.
    const x = Math.max(
      0,
      Math.floor(Math.min(...corners.map((point) => point.x)) - glowPadding)
    );
    const y = Math.max(
      0,
      Math.floor(Math.min(...corners.map((point) => point.y)) - glowPadding)
    );
    const width =
      Math.min(
        240,
        Math.ceil(Math.max(...corners.map((point) => point.x)) + glowPadding)
      ) - x;
    const height =
      Math.min(
        240,
        Math.ceil(Math.max(...corners.map((point) => point.y)) + glowPadding)
      ) - y;
    const image = document.createElementNS(namespace, 'svg');
    image.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    image.setAttribute('width', String(width));
    image.setAttribute('height', String(height));
    image.setAttribute('fill', 'none');
    const defs = svg.querySelector('defs');
    if (defs) image.append(defs.cloneNode(true));
    let parent: Element = image;
    for (const ancestor of ancestors) {
      const clone = ancestor.cloneNode(false) as Element;
      clone.removeAttribute('style');
      if (ancestor.hasAttribute('filter')) {
        // Preserve the filter region when a shared glow is split into images.
        const bounds = ancestor.getBBox();
        const extent = document.createElementNS(namespace, 'rect');
        extent.setAttribute('x', String(bounds.x));
        extent.setAttribute('y', String(bounds.y));
        extent.setAttribute('width', String(bounds.width));
        extent.setAttribute('height', String(bounds.height));
        extent.setAttribute('fill', 'transparent');
        extent.setAttribute('stroke', 'none');
        extent.setAttribute('opacity', '0');
        clone.append(extent);
      }
      if (
        animationStyle(ancestor).animationName &&
        Array.from(
          keyframes.get(animationStyle(ancestor).animationName)?.cssRules ?? []
        ).some((rule) => (rule as CSSKeyframeRule).style.opacity)
      ) {
        clone.removeAttribute('opacity');
      }
      parent.append(clone);
      parent = clone;
    }
    const clone = node.cloneNode(true) as Element;
    for (const element of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
      element.removeAttribute('style');
    }
    if (
      Array.from(
        keyframes.get(animationStyle(node).animationName)?.cssRules ?? []
      ).some((rule) => (rule as CSSKeyframeRule).style.opacity)
    )
      clone.removeAttribute('opacity');
    parent.append(clone);
    const markup = new XMLSerializer().serializeToString(image);
    return {
      url: `data:image/svg+xml,${encodeURIComponent(markup)}`,
      x,
      y,
      width,
      height,
    };
  };

  const compile = (
    node: SVGGraphicsElement,
    ancestors: SVGGraphicsElement[]
  ): FrameLayer[] => {
    const style = animationStyle(node);
    const motion = keyframes.get(style.animationName);
    const children = Array.from(node.children) as SVGGraphicsElement[];
    const layers = children.some(hasMotion)
      ? children.flatMap((child) => compile(child, [...ancestors, node]))
      : [imageLayer(node, ancestors)];
    if (!motion) return layers;

    const bounds = node.getBBox();
    const centered = style.transformBox === 'fill-box';
    const originX = centered
      ? bounds.x + bounds.width / 2
      : parseFloat(style.transformOrigin) || 0;
    const originY = centered
      ? bounds.y + bounds.height / 2
      : parseFloat(style.transformOrigin.split(' ')[1]) || 0;
    const matrix = node.getCTM() ?? new DOMMatrix();
    const prefix = `${cssMatrix(matrix)} translate(${originX}px, ${originY}px)`;
    const suffix = `translate(${-originX}px, ${-originY}px) ${cssMatrix(matrix.inverse())}`;
    const frames: Keyframe[] = Array.from(motion.cssRules)
      .flatMap((rule) => {
        const key = rule as CSSKeyframeRule;
        return key.keyText.split(',').map((offset) => ({
          offset:
            offset.trim() === 'from'
              ? 0
              : offset.trim() === 'to'
                ? 1
                : parseFloat(offset) / 100,
          easing: style.animationTimingFunction || 'linear',
          ...(key.style.transform
            ? { transform: `${prefix} ${key.style.transform} ${suffix}` }
            : {}),
          ...(key.style.opacity ? { opacity: key.style.opacity } : {}),
        }));
      })
      .sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));
    // A full orbit needs matching rotate functions so interpolation retains the turn.
    if (frames[0].offset !== 0 && style.animationName === 'orbit') {
      frames.unshift({
        offset: 0,
        transform: `${prefix} rotate(0deg) ${suffix}`,
      });
    }
    if (
      frames.some(
        (key) =>
          typeof key.transform === 'string' &&
          !CSS.supports('transform', key.transform)
      )
    ) {
      throw new Error('Invalid avatar frame transform');
    }
    return [
      {
        keyframes: frames,
        options: {
          duration: parseFloat(style.animationDuration) * 1000,
          delay: (parseFloat(style.animationDelay) || 0) * 1000,
          iterations: Infinity,
          easing: 'linear',
          direction:
            style.animationDirection === 'reverse' ? 'reverse' : 'normal',
        },
        opacity: frames.some((key) => key.opacity !== undefined)
          ? (node.getAttribute('opacity') ?? '1')
          : '1',
        children: layers,
      },
    ];
  };

  try {
    const layers = Array.from(svg.children)
      .filter((node) => node.tagName !== 'defs')
      .flatMap((node) => compile(node as SVGGraphicsElement, []));
    cache.set(frame, layers);
    return layers;
  } finally {
    svg.remove();
  }
}

export async function mountAvatarFrameLayers(
  host: HTMLElement,
  frame: DecorativeFrame
) {
  const animations: Animation[] = [];
  const images: HTMLImageElement[] = [];
  const root = document.createElement('span');
  root.className = 'avatar-frame-scene';
  const mount = (layers: FrameLayer[], parent: HTMLElement) => {
    for (const layer of layers) {
      if ('url' in layer) {
        const image = new Image();
        image.alt = '';
        image.draggable = false;
        image.src = layer.url;
        image.style.cssText = `position:absolute;left:${layer.x}px;top:${layer.y}px;width:${layer.width}px;height:${layer.height}px;max-width:none`;
        parent.append(image);
        images.push(image);
      } else {
        const element = document.createElement('span');
        element.className = 'avatar-frame-motion';
        element.style.opacity = layer.opacity;
        parent.append(element);
        const animation = element.animate(layer.keyframes, layer.options);
        animation.pause();
        animation.currentTime = 0;
        animations.push(animation);
        mount(layer.children, element);
      }
    }
  };
  try {
    mount(compileLayers(frame), root);
    await Promise.all(images.map((image) => image.decode()));
  } catch (error) {
    animations.forEach((animation) => animation.cancel());
    throw error;
  }
  host.append(root);
  return { root, animations };
}
