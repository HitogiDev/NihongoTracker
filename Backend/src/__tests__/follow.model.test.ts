import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import Follow from '../models/follow.model.js';

describe('Follow model', () => {
  it('rejects self-follow at schema validation time', async () => {
    const userId = new Types.ObjectId();
    const follow = new Follow({ follower: userId, following: userId });

    await expect(follow.validate()).rejects.toThrow(
      'A user cannot follow themselves'
    );
  });
});
