import { describe, expect, it } from 'vitest';
import {
  extractMentionedUsernames,
  extractNewMentions,
  MAX_MENTIONS_PER_TEXT,
} from '../services/mentionParser.js';

describe('extractMentionedUsernames', () => {
  it('finds mentions at the start, after spaces, and after punctuation', () => {
    expect(
      extractMentionedUsernames('@alice hi @bob_1, (@carol-x) and **@dave**.')
    ).toEqual(['alice', 'bob_1', 'carol-x', 'dave']);
  });

  it('ignores email addresses', () => {
    expect(extractMentionedUsernames('mail foo@bar.com or a.b@c.io')).toEqual(
      []
    );
  });

  it('ignores mentions inside inline code and fenced code', () => {
    expect(
      extractMentionedUsernames('`@inline` @real\n```\n@fenced\n```')
    ).toEqual(['real']);
  });

  it('removes case-insensitive duplicates', () => {
    expect(extractMentionedUsernames('@Alice @alice @ALICE')).toEqual([
      'Alice',
    ]);
  });

  it('rejects names longer than the username limit', () => {
    expect(extractMentionedUsernames('@abcdefghijklmnopqrstu')).toEqual([]);
  });

  it('limits the number of mentions in one text', () => {
    const text = Array.from({ length: 15 }, (_, i) => `@user${i}`).join(' ');
    expect(extractMentionedUsernames(text)).toHaveLength(
      MAX_MENTIONS_PER_TEXT
    );
  });

  it('does not read work mentions as user mentions', () => {
    expect(extractMentionedUsernames('[[anime:154587|Frieren]]')).toEqual([]);
  });
});

describe('extractNewMentions', () => {
  it('returns only mentions that the previous text did not have', () => {
    expect(extractNewMentions('@alice @Bob @carol', '@alice and @bob')).toEqual(
      ['carol']
    );
  });

  it('returns every mention when there is no previous text', () => {
    expect(extractNewMentions('@alice @bob')).toEqual(['alice', 'bob']);
  });
});
