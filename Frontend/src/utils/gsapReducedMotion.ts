import gsap from 'gsap';

/**
 * Import this module for its side effect in each file that uses GSAP.
 * With `prefers-reduced-motion`, GSAP animations go to their end state at once.
 * The end states and `onComplete` callbacks stay the same, so screens need no second code path.
 */
const INSTANT_TIME_SCALE = 100;

if (typeof window !== 'undefined' && window.matchMedia) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () =>
    gsap.globalTimeline.timeScale(query.matches ? INSTANT_TIME_SCALE : 1);
  apply();
  query.addEventListener('change', apply);
}
