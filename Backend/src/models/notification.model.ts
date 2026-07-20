import { Schema, model } from 'mongoose';
import { INotification, NOTIFICATION_TYPES } from '../types.js';

const NotificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The user who triggered the notification (null for system events).
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, required: true, enum: NOTIFICATION_TYPES },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, trim: true, maxlength: 1000 },
    // Frontend route the notification links to (e.g. "/clubs/<id>?tab=members").
    link: { type: String, trim: true, maxlength: 500 },
    // Optional image shown instead of the actor avatar (media cover, etc).
    image: { type: String, trim: true, maxlength: 500 },
    entityType: { type: String, trim: true, maxlength: 50, default: null },
    entityId: { type: String, trim: true, maxlength: 100, default: null },
    meta: { type: Map, of: String, default: undefined },
    // Aggregation key: notifications sharing a groupKey collapse into one row
    // whose `count` is incremented (e.g. "review_like:<reviewId>").
    groupKey: { type: String, trim: true, maxlength: 200, default: null },
    count: { type: Number, default: 1, min: 1 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    // Optional TTL: set to auto-expire ephemeral notifications.
    expireAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Inbox listing: newest first per user.
NotificationSchema.index({ recipient: 1, createdAt: -1 });
// Unread badge count.
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
// Aggregation/dedup lookups.
NotificationSchema.index({ recipient: 1, groupKey: 1 }, { sparse: true });
// Entity cleanup (e.g. removing a like notification when the like is undone).
NotificationSchema.index({ entityType: 1, entityId: 1 }, { sparse: true });
// TTL for notifications that carry an explicit expiry.
NotificationSchema.index(
  { expireAt: 1 },
  { expireAfterSeconds: 0, sparse: true }
);

const Notification = model<INotification>('Notification', NotificationSchema);

export default Notification;
