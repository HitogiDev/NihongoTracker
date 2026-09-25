import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import MediaRecommendation from '../models/mediaRecommendation.model.js';

describe('MediaRecommendation model', () => {
  it('rejects recommending media to yourself at schema validation time', async () => {
    const userId = new Types.ObjectId();
    const recommendation = new MediaRecommendation({
      sender: userId,
      recipient: userId,
      mediaId: '123',
      mediaType: 'anime',
    });

    await expect(recommendation.validate()).rejects.toThrow(
      'A user cannot recommend media to themselves'
    );
  });
});
