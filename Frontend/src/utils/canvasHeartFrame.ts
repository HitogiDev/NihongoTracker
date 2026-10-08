import hearts from "../assets/avatar-frames/hearts.svg?raw";
import { resizeAvatarCanvas } from "./avatarCanvas";

interface Heart {
  matrix: DOMMatrix;
  center: DOMPoint;
  color: string;
  opacity: number;
  glow: boolean;
  beat: Animation;
  rise?: Animation;
}

function loadHearts() {
  const source = new DOMParser().parseFromString(hearts, "image/svg+xml");
  const svg = document.importNode(
    source.documentElement,
    true,
  ) as unknown as SVGSVGElement;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(svg.querySelector("style")?.textContent ?? "");
  const rules = Array.from(sheet.cssRules);
  const styleFor = (node: Element) => {
    const style = document.createElement("span").style;
    for (const rule of rules) {
      if (rule.type !== CSSRule.STYLE_RULE) continue;
      const css = rule as CSSStyleRule;
      if (node.matches(css.selectorText)) style.cssText += css.style.cssText;
    }
    style.cssText += node.getAttribute("style") ?? "";
    return style;
  };
  const motion = (node: Element, pulse: boolean) => {
    const style = styleFor(node);
    return new Animation(
      new KeyframeEffect(null, [], {
        duration: parseFloat(style.animationDuration) * (pulse ? 500 : 1000),
        delay: (parseFloat(style.animationDelay) || 0) * 1000,
        iterations: Infinity,
        direction: pulse ? "alternate" : "normal",
        easing: style.animationTimingFunction || "linear",
        fill: "both",
      }),
    );
  };
  svg.querySelector("style")?.remove();
  svg.setAttribute("width", "240");
  svg.setAttribute("height", "240");
  svg.style.cssText =
    "position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none";
  svg.setAttribute("aria-hidden", "true");
  document.body.append(svg);
  try {
    const path = new Path2D(
      svg.querySelector("#heart")?.getAttribute("d") ?? "",
    );
    const pulses = rules.find(
      (rule): rule is CSSKeyframesRule =>
        rule.type === CSSRule.KEYFRAMES_RULE &&
        (rule as CSSKeyframesRule).name === "beat",
    );
    const scales = Array.from(pulses?.cssRules ?? []).map((rule) =>
      Number(
        (rule as CSSKeyframeRule).style.transform.match(
          /scale\(([^)]+)\)/,
        )?.[1],
      ),
    );
    const rising = rules.find(
      (rule): rule is CSSKeyframesRule =>
        rule.type === CSSRule.KEYFRAMES_RULE &&
        (rule as CSSKeyframesRule).name === "rise",
    );
    const riseFrames = Array.from(rising?.cssRules ?? []) as CSSKeyframeRule[];
    const translations = riseFrames
      .filter((rule) => rule.style.transform)
      .map((rule) => {
        const coordinates = rule.style.transform.match(
          /translate\(([^,]+),([^)]+)\)/,
        );
        return {
          x: parseFloat(coordinates?.[1] ?? "0"),
          y: parseFloat(coordinates?.[2] ?? "0"),
        };
      });
    const riseOpacity = riseFrames
      .filter((rule) => rule.style.opacity)
      .map((rule) => ({
        offset: parseFloat(rule.keyText) / 100,
        value: Number(rule.style.opacity),
      }));
    const items: Heart[] = Array.from(
      svg.querySelectorAll<SVGGraphicsElement>(".beat"),
    ).map((node) => {
      const bounds = node.getBBox();
      const use = node.querySelector("use");
      const rise = node.closest(".rise");
      return {
        matrix: DOMMatrix.fromMatrix(node.getCTM() ?? {}),
        center: new DOMPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        ),
        color: node.closest("[fill]")?.getAttribute("fill") ?? "#e968b6",
        opacity: Number(use?.getAttribute("opacity") ?? 1),
        glow: Boolean(node.closest("[filter]")),
        beat: motion(node, true),
        rise: rise ? motion(rise, false) : undefined,
      };
    });
    const rings = Array.from(svg.querySelectorAll("circle")).map((node) => ({
      radius: Number(node.getAttribute("r")),
      width: Number(node.getAttribute("stroke-width")),
      color: node.getAttribute("stroke") ?? "",
      opacity: Number(node.getAttribute("opacity") ?? 1),
    }));
    return {
      path,
      items,
      rings,
      minimum: Math.min(...scales),
      maximum: Math.max(...scales),
      translations,
      riseOpacity,
    };
  } finally {
    svg.remove();
  }
}

export function mountCanvasHeartFrame(host: HTMLElement) {
  const art = loadHearts();
  const root = document.createElement("canvas");
  root.className = "avatar-frame-canvas";
  root.setAttribute("aria-hidden", "true");
  const ctx = root.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Avatar canvas unavailable");
  let request = 0;
  let elapsed = 0;
  let previous = 0;
  let playing = false;
  const progress = (animation: Animation) => {
    animation.currentTime = elapsed;
    return animation.effect?.getComputedTiming().progress ?? 0;
  };
  const draw = () => {
    const resolution = root.width / 240;
    ctx.setTransform(resolution, 0, 0, root.height / 240, 0, 0);
    ctx.clearRect(0, 0, 240, 240);
    for (const ring of art.rings) {
      ctx.globalAlpha = ring.opacity;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.width;
      ctx.beginPath();
      ctx.arc(120, 120, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const heart of art.items) {
      const scale =
        art.minimum + (art.maximum - art.minimum) * progress(heart.beat);
      const rise = heart.rise ? progress(heart.rise) : undefined;
      let opacity = 1;
      if (rise !== undefined) {
        const endIndex = art.riseOpacity.findIndex(
          (step) => step.offset >= rise,
        );
        const end = art.riseOpacity[Math.max(0, endIndex)];
        const start = art.riseOpacity[Math.max(0, endIndex - 1)];
        const fraction =
          end.offset === start.offset
            ? 0
            : (rise - start.offset) / (end.offset - start.offset);
        opacity = start.value + (end.value - start.value) * fraction;
      }
      ctx.save();
      const matrix = heart.matrix;
      ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
      if (rise !== undefined) {
        const [start, end] = art.translations;
        ctx.translate(
          start.x + (end.x - start.x) * rise,
          start.y + (end.y - start.y) * rise,
        );
      }
      ctx.translate(heart.center.x, heart.center.y);
      ctx.scale(scale, scale);
      ctx.translate(-heart.center.x, -heart.center.y);
      ctx.fillStyle = heart.color;
      ctx.globalAlpha = heart.opacity * opacity;
      if (heart.glow) {
        ctx.shadowColor = heart.color;
        ctx.shadowBlur = 2.2 * resolution;
      }
      ctx.fill(art.path);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };
  const tick = (now: number) => {
    if (!playing) return;
    elapsed += Math.min(now - previous, 100);
    previous = now;
    draw();
    request = requestAnimationFrame(tick);
  };
  const resize = () => {
    // Supersample small hearts before downscaling to avoid pixel shimmer during pulses.
    resizeAvatarCanvas(root, 2);
    draw();
  };
  const setPlaying = (value: boolean) => {
    if (playing === value) return;
    playing = value;
    cancelAnimationFrame(request);
    if (playing) {
      previous = performance.now();
      request = requestAnimationFrame(tick);
    }
  };
  const dispose = () => {
    setPlaying(false);
    for (const heart of art.items) {
      heart.beat.cancel();
      heart.rise?.cancel();
    }
    root.remove();
  };
  host.append(root);
  resize();
  return { root, animations: [] as Animation[], resize, setPlaying, dispose };
}
