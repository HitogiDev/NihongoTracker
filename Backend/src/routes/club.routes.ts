import { Router } from 'express';
import multer from 'multer';
import {
  getClubs,
  getClub,
  createClub,
  joinClub,
  leaveClub,
  updateClub,
  getUserClubs,
  manageMembershipRequest,
  addClubMedia,
  getClubMedia,
  getClubMediaLogs,
  getClubMediaRankings,
  getClubMemberRankings,
  getClubMediaStats,
  addClubReview,
  getClubReviews,
  editReview,
  toggleReviewLike,
  createMediaVoting,
  editMediaVoting,
  deleteMediaVoting,
  addVotingCandidate,
  voteForCandidate,
  getMediaVotings,
  finalizeVoting,
  completeVoting,
} from '../controllers/club.controller.js';
import { protect } from '../libs/authMiddleware.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// All routes require authentication
router.use(protect);

// Club routes (all authenticated)
router.get('/', getClubs); // Get all clubs with filtering
router.get('/:clubId', getClub); // Get specific club

router.post(
  '/',
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ]),
  createClub
); // Create new club
router.get('/user/my-clubs', getUserClubs); // Get user's clubs
router.post('/:clubId/join', joinClub); // Join a club
router.post('/:clubId/leave', leaveClub); // Leave a club
router.put('/:clubId', updateClub); // Update club (leaders only)
router.post('/:clubId/members/:memberId', manageMembershipRequest); // Approve/reject membership

// Club Media routes
router.post('/:clubId/media', addClubMedia); // Add media to club (leaders/moderators only)
router.get('/:clubId/media', getClubMedia); // Get club media
router.get('/:clubId/media/:mediaId/logs', getClubMediaLogs); // Get club member logs for specific media
router.get('/:clubId/media/:mediaId/rankings', getClubMediaRankings); // Get club member rankings for specific media
router.get('/:clubId/media/:mediaId/stats', getClubMediaStats); // Get club media statistics

// Club Rankings routes
router.get('/:clubId/rankings', getClubMemberRankings); // Get club member rankings (overall)

// Club Reviews routes
router.post('/:clubId/media/:mediaId/reviews', addClubReview); // Add review for club media
router.get('/:clubId/media/:mediaId/reviews', getClubReviews); // Get reviews for club media
router.put('/:clubId/media/:mediaId/reviews/:reviewId', editReview); // Edit review
router.post('/:clubId/media/:mediaId/reviews/:reviewId/like', toggleReviewLike); // Like/unlike review

// Club Media Voting routes
router.post('/:clubId/votings', createMediaVoting); // Create new media voting
router.put('/:clubId/votings/:votingId', editMediaVoting); // Edit media voting
router.delete('/:clubId/votings/:votingId', deleteMediaVoting); // Delete media voting
router.get('/:clubId/votings', getMediaVotings); // Get media votings
router.post('/:clubId/votings/:votingId/candidates', addVotingCandidate); // Add candidate to voting
router.post('/:clubId/votings/:votingId/finalize', finalizeVoting); // Finalize voting setup
router.post(
  '/:clubId/votings/:votingId/vote/:candidateIndex',
  voteForCandidate
); // Vote for candidate
router.post('/:clubId/votings/:votingId/complete', completeVoting); // Complete voting and select winner

export default router;
