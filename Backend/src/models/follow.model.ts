import { Schema, model } from "mongoose";
import { IFollow } from "../types.js";

const FollowSchema = new Schema<IFollow>(
  {
    follower: { type: Schema.Types.ObjectId, ref: "User", required: true },
    following: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

FollowSchema.pre('validate', function preventSelfFollow(next) {
  if (this.follower && this.following && this.follower.equals(this.following)) {
    next(new Error('A user cannot follow themselves'));
    return;
  }
  next();
});

FollowSchema.index({ follower: 1, following: 1 }, { unique: true });
FollowSchema.index({ following: 1, createdAt: -1 });
FollowSchema.index({ follower: 1, createdAt: -1 });

export default model<IFollow>("Follow", FollowSchema);
