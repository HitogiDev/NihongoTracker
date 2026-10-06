export function resizeAvatarCanvas(canvas: HTMLCanvasElement): void {
  const bounds = canvas.getBoundingClientRect();
  const density = (window.devicePixelRatio || 1) * (window.visualViewport?.scale ?? 1);
  const width = Math.max(1, Math.ceil(bounds.width * density));
  const height = Math.max(1, Math.ceil(bounds.height * density));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

export function observeAvatarCanvasResolution(resize: () => void): () => void {
  let density: MediaQueryList;
  const change = () => {
    density.removeEventListener('change', change);
    density = window.matchMedia(
      `(resolution: ${window.devicePixelRatio || 1}dppx)`
    );
    density.addEventListener('change', change);
    resize();
  };
  density = window.matchMedia(
    `(resolution: ${window.devicePixelRatio || 1}dppx)`
  );
  density.addEventListener('change', change);
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  return () => {
    density.removeEventListener('change', change);
    window.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('resize', resize);
  };
}
