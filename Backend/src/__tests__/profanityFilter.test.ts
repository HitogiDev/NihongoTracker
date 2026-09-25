import { describe, it, expect } from 'vitest';
import { containsOffensiveText } from '../constants/profanityFilter.js';

describe('containsOffensiveText', () => {
  it('allows normal badge text', () => {
    for (const ok of [
      '',
      'Donator',
      'Best Reader',
      'Grape King',
      'Spicy Ramen',
      'Class of 2024',
      'Assassin',
      'Cocoon',
      'Scholar',
      '日本語 Master',
    ]) {
      expect(containsOffensiveText(ok), ok).toBe(false);
    }
  });

  it('blocks slurs and strong profanity', () => {
    for (const bad of [
      'fuck you',
      'shithead',
      'you bitch',
      'nigger',
      'faggot',
      'retard',
    ]) {
      expect(containsOffensiveText(bad), bad).toBe(true);
    }
  });

  it('blocks leetspeak obfuscation', () => {
    for (const bad of ['n1gg3r', 'sh1t', 'f4ggot', 'b!tch']) {
      expect(containsOffensiveText(bad), bad).toBe(true);
    }
  });

  it('blocks spaced-out hard slurs', () => {
    for (const bad of ['n i g g e r', 'f.a.g.g.o.t', 'n-i-g-g-a']) {
      expect(containsOffensiveText(bad), bad).toBe(true);
    }
  });

  it('matches inflected forms', () => {
    for (const bad of ['fucker', 'bitches', 'raping']) {
      expect(containsOffensiveText(bad), bad).toBe(true);
    }
  });
});
