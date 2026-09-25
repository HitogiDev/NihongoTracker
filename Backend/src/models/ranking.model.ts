import { Schema, Types, model } from 'mongoose';
import { IRanking } from '../types.js';

const RankingSchema = new Schema<IRanking>(
  {
    month: {
      type: Number,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    users: [Types.ObjectId],
  },
  { timestamps: true }
);

export default model<IRanking>('Ranking', RankingSchema);
