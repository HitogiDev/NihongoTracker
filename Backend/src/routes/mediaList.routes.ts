import { Router } from 'express';
import {
  getMediaLists,
  getUserMediaLists,
  getMyMediaLists,
  getMediaListById,
  createMediaList,
  updateMediaList,
  deleteMediaList,
  addMediaListEntry,
  removeMediaListEntry,
  toggleMediaListLike,
  cloneMediaList,
  getMediaListComments,
  addMediaListComment,
  deleteMediaListComment,
} from '../controllers/mediaList.controller.js';
import { protect, optionalProtect } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', optionalProtect, getMediaLists);
router.get('/mine', protect, getMyMediaLists);
router.get('/user/:username', optionalProtect, getUserMediaLists);
router.post('/', protect, createMediaList);
router.get('/:listId', optionalProtect, getMediaListById);
router.put('/:listId', protect, updateMediaList);
router.delete('/:listId', protect, deleteMediaList);
router.post('/:listId/entries', protect, addMediaListEntry);
router.delete(
  '/:listId/entries/:mediaType/:mediaId',
  protect,
  removeMediaListEntry
);
router.post('/:listId/like', protect, toggleMediaListLike);
router.post('/:listId/clone', protect, cloneMediaList);
router.get('/:listId/comments', optionalProtect, getMediaListComments);
router.post('/:listId/comments', protect, addMediaListComment);
router.delete('/:listId/comments/:commentId', protect, deleteMediaListComment);

export default router;
