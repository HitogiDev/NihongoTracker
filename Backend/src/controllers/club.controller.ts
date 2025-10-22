import { Request, Response, NextFunction } from 'express';
import { Club } from '../models/club.model.js';
import User from '../models/user.model.js';
import { MediaBase } from '../models/media.model.js';
import Log from '../models/log.model.js';
import uploadFile, { uploadFileWithCleanup } from '../services/uploadFile.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { Types } from 'mongoose';
import {
  ICreateClubRequest,
  IClubResponse,
  IClubListResponse,
  IClub,
  IClubMember,
  IClubMediaCandidate,
} from '../types.js';

export async function getClubs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<IClubListResponse> | void> {
  try {
    const {
      page = 1,
      limit = 12,
      search = '',
      sortBy = 'totalXp',
      sortOrder = 'desc',
      isPublic,
      tags,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build search query
    const searchQuery: any = { isActive: true };

    if (search) {
      searchQuery.$text = { $search: search as string };
    }

    if (isPublic !== undefined) {
      searchQuery.isPublic = isPublic === 'true';
    }

    if (tags) {
      const tagArray = (tags as string).split(',');
      searchQuery.tags = { $in: tagArray };
    }

    // Build sort query
    const sortQuery: any = {};
    sortQuery[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Get clubs with active member count (exclude pending / banned)
    const clubs = await Club.aggregate([
      { $match: searchQuery },
      {
        $addFields: {
          memberCount: {
            $size: {
              $filter: {
                input: '$members',
                as: 'm',
                cond: { $eq: ['$$m.status', 'active'] },
              },
            },
          },
        },
      },
      { $sort: sortQuery },
      { $skip: skip },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'users',
          localField: 'members.user',
          foreignField: '_id',
          as: 'memberDetails',
          pipeline: [{ $project: { username: 1, avatar: 1 } }],
        },
      },
    ]);

    const total = await Club.countDocuments(searchQuery);

    // Add user membership info if user is authenticated
    const userId = res.locals.user?._id;
    const clubsWithUserInfo: IClubResponse[] = clubs.map((club) => {
      const userMember = userId
        ? club.members.find(
            (member: IClubMember) =>
              member.user.toString() === userId.toString()
          )
        : null;

      return {
        ...club,
        isUserMember: !!userMember,
        userRole: userMember?.role,
        userStatus: userMember?.status,
      } as IClubResponse;
    });

    const response: IClubListResponse = {
      clubs: clubsWithUserInfo,
      total,
      page: pageNum,
      limit: limitNum,
    };

    return res.status(200).json(response);
  } catch (error) {
    return next(error as customError);
  }
}

export async function getClub(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<IClubResponse> | void> {
  try {
    const { clubId } = req.params;
    const userId = res.locals.user?._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId)
      .populate('members.user', 'username avatar level totalXp')
      .populate('currentMedia.addedBy', 'username');

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Auto-update voting statuses based on current date
    await updateVotingStatuses(club);

    // Refresh club data after potential status updates
    const updatedClub = await Club.findById(clubId)
      .populate('members.user', 'username avatar level totalXp')
      .populate('currentMedia.addedBy', 'username');

    if (!updatedClub) {
      return res.status(404).json({ message: 'Club not found after update' });
    }

    // Check if user is a member
    const userMember = userId
      ? updatedClub.members.find(
          (member) => member.user._id.toString() === userId.toString()
        )
      : null;

    // All authenticated users can view clubs
    // The difference between public/private is only in the joining mechanism

    const clubResponse = {
      ...updatedClub.toObject(),
      memberCount: updatedClub.members.filter((m) => m.status === 'active')
        .length,
      isUserMember: !!userMember,
      userRole: userMember?.role,
      userStatus: userMember?.status,
    } as IClubResponse;

    return res.status(200).json(clubResponse);
  } catch (error) {
    return next(error as customError);
  }
}

export async function createClub(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<IClub> | void> {
  try {
    const userId = res.locals.user._id;
    let clubData: ICreateClubRequest = req.body;

    // Parse JSON-stringified arrays from FormData
    if (typeof clubData.tags === 'string') {
      try {
        clubData.tags = JSON.parse(clubData.tags);
      } catch (error) {
        console.error('Error parsing tags:', error);
        clubData.tags = [];
      }
    }

    // Convert string numbers back to numbers
    if (typeof clubData.memberLimit === 'string') {
      clubData.memberLimit = parseInt(clubData.memberLimit, 10);
    }

    // Convert string booleans back to booleans
    if (typeof clubData.isPublic === 'string') {
      clubData.isPublic = clubData.isPublic === 'true';
    }

    // Validate required fields
    if (!clubData.name || clubData.name.trim().length === 0) {
      return res.status(400).json({ message: 'Club name is required' });
    }

    // Check if club name already exists
    const existingClub = await Club.findOne({ name: clubData.name });
    if (existingClub) {
      return res.status(400).json({ message: 'Club name already exists' });
    }

    // Handle file uploads if present
    let avatarUrl = '';
    let bannerUrl = '';

    if (req.files && Object.keys(req.files).length > 0) {
      try {
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };

        if (files.avatar?.[0]) {
          const file = await uploadFile(files.avatar[0]);
          avatarUrl = file.downloadURL;
        }

        if (files.banner?.[0]) {
          const file = await uploadFile(files.banner[0]);
          bannerUrl = file.downloadURL;
        }
      } catch (error) {
        if (error instanceof customError) {
          return next(error);
        }
        return next(
          new customError(
            'File upload failed: ' + (error as Error).message,
            400
          )
        );
      }
    }

    // Create the club with the creator as the leader
    const newClub = new Club({
      ...clubData,
      avatar: avatarUrl,
      banner: bannerUrl,
      members: [
        {
          user: userId,
          role: 'leader',
          joinedAt: new Date(),
          status: 'active',
        },
      ],
    });

    await newClub.save();

    // Add club to user's clubs array
    await User.findByIdAndUpdate(userId, {
      $push: { clubs: newClub._id },
    });

    return res.status(201).json(newClub);
  } catch (error) {
    return next(error as customError);
  }
}

export async function joinClub(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId } = req.params;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Check if user is already a member
    const existingMember = club.members.find((member) =>
      member.user.equals(userId)
    );

    if (existingMember) {
      return res.status(400).json({ message: 'Already a member of this club' });
    }

    // Check member limit (only count active members)
    const activeMemberCount = club.members.filter(
      (member) => member.status === 'active'
    ).length;
    if (activeMemberCount >= club.memberLimit) {
      return res.status(400).json({ message: 'Club has reached member limit' });
    }

    // Add member with appropriate status
    const memberStatus = club.isPublic ? 'active' : 'pending';
    club.members.push({
      user: userId,
      role: 'member',
      joinedAt: new Date(),
      status: memberStatus,
    });

    await club.save();

    // Add club to user's clubs array if approved
    if (memberStatus === 'active') {
      await User.findByIdAndUpdate(userId, {
        $push: { clubs: clubId },
      });
    }

    const message = club.isPublic
      ? 'Successfully joined the club'
      : 'Join request sent, waiting for approval';

    return res.status(200).json({ message });
  } catch (error) {
    return next(error as customError);
  }
}

export async function leaveClub(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId } = req.params;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const memberIndex = club.members.findIndex((member) =>
      member.user.equals(userId)
    );

    if (memberIndex === -1) {
      return res.status(400).json({ message: 'Not a member of this club' });
    }

    const member = club.members[memberIndex];

    // If user is the leader and there are other active members, they need to transfer leadership first
    const activeMembers = club.members.filter((m) => m.status === 'active');
    if (member.role === 'leader' && activeMembers.length > 1) {
      return res.status(400).json({
        message:
          'Cannot leave club as leader. Transfer leadership or disband the club first.',
      });
    }

    // Remove member from club
    club.members.splice(memberIndex, 1);

    // If no members left, deactivate the club
    if (club.members.length === 0) {
      club.isActive = false;
    }

    await club.save();

    // Remove club from user's clubs array
    await User.findByIdAndUpdate(userId, {
      $pull: { clubs: clubId },
    });

    return res.status(200).json({ message: 'Successfully left the club' });
  } catch (error) {
    return next(error as customError);
  }
}

export async function transferLeadership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId } = req.params;
    const { newLeaderId } = req.body;
    const currentUserId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    if (!Types.ObjectId.isValid(newLeaderId)) {
      return res.status(400).json({ message: 'Invalid new leader ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Check if current user is the leader
    const currentLeader = club.members.find(
      (member) =>
        member.user.equals(currentUserId) &&
        member.role === 'leader' &&
        member.status === 'active'
    );

    if (!currentLeader) {
      return res
        .status(403)
        .json({ message: 'Only the club leader can transfer leadership' });
    }

    // Check if new leader is an active member
    const newLeaderMember = club.members.find(
      (member) => member.user.equals(newLeaderId) && member.status === 'active'
    );

    if (!newLeaderMember) {
      return res
        .status(400)
        .json({ message: 'New leader must be an active club member' });
    }

    // Transfer leadership
    currentLeader.role = 'member';
    newLeaderMember.role = 'leader';

    await club.save();

    return res
      .status(200)
      .json({ message: 'Leadership transferred successfully' });
  } catch (error) {
    return next(error as customError);
  }
}

export async function updateClub(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<IClub> | void> {
  try {
    const { clubId } = req.params;
    const userId = res.locals.user._id;
    let updateData = req.body;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Check if user is the leader
    const userMember = club.members.find((member) =>
      member.user.equals(userId)
    );

    if (!userMember || userMember.role !== 'leader') {
      return res.status(403).json({
        message: 'Only club leaders can update club settings',
      });
    }

    // Parse JSON-stringified arrays from FormData if present
    if (typeof updateData.tags === 'string') {
      try {
        updateData.tags = JSON.parse(updateData.tags);
      } catch (error) {
        console.error('Error parsing tags:', error);
        updateData.tags = [];
      }
    }

    // Convert string numbers back to numbers
    if (typeof updateData.memberLimit === 'string') {
      updateData.memberLimit = parseInt(updateData.memberLimit, 10);
    }

    // Convert string booleans back to booleans
    if (typeof updateData.isPublic === 'string') {
      updateData.isPublic = updateData.isPublic === 'true';
    }

    // Handle file uploads if present
    if (req.files && Object.keys(req.files).length > 0) {
      try {
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };

        if (files.avatar?.[0]) {
          const file = await uploadFileWithCleanup(
            files.avatar[0],
            club.avatar
          );
          updateData.avatar = file.downloadURL;
        }

        if (files.banner?.[0]) {
          const file = await uploadFileWithCleanup(
            files.banner[0],
            club.banner
          );
          updateData.banner = file.downloadURL;
        }
      } catch (error) {
        if (error instanceof customError) {
          return next(error);
        }
        return next(
          new customError(
            'File upload failed: ' + (error as Error).message,
            400
          )
        );
      }
    }

    // Update allowed fields
    const allowedFields = [
      'name',
      'description',
      'isPublic',
      'tags',
      'rules',
      'memberLimit',
      'avatar',
      'banner',
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        (club as any)[field] = updateData[field];
      }
    });

    await club.save();

    return res.status(200).json(club);
  } catch (error) {
    return next(error as customError);
  }
}

export async function getUserClubs(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<IClub[]> | void> {
  try {
    const userId = res.locals.user._id;

    const clubs = await Club.find({
      'members.user': userId,
      'members.status': 'active',
      isActive: true,
    }).select('name avatar level totalXp members');

    return res.status(200).json(clubs);
  } catch (error) {
    return next(error as customError);
  }
}

export async function manageJoinRequests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, memberId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId) || !Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Check if user is the leader
    const userMember = club.members.find((member) =>
      member.user.equals(userId)
    );

    if (!userMember || userMember.role !== 'leader') {
      return res.status(403).json({
        message: 'Only club leaders can manage membership requests',
      });
    }

    // Find the pending member
    const pendingMember = club.members.find(
      (member) => member.user.equals(memberId) && member.status === 'pending'
    );

    if (!pendingMember) {
      return res.status(404).json({ message: 'Pending member not found' });
    }

    if (action === 'approve') {
      pendingMember.status = 'active';
      await User.findByIdAndUpdate(memberId, {
        $push: { clubs: clubId },
      });
      await club.save();
      return res.status(200).json({ message: 'Member approved' });
    } else if (action === 'reject') {
      club.members = club.members.filter(
        (member) => !member.user.equals(memberId)
      );
      await club.save();
      return res.status(200).json({ message: 'Member rejected' });
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    return next(error as customError);
  }
}

export async function getPendingJoinRequests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId } = req.params;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId).populate(
      'members.user',
      'username avatar'
    );
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMember = club.members.find((m) => m.user.equals(userId));
    if (!userMember || userMember.role !== 'leader') {
      return res
        .status(403)
        .json({ message: 'Only club leaders can view pending requests' });
    }

    const pendingMembers = club.members.filter((m) => m.status === 'pending');

    return res.status(200).json({ pending: pendingMembers });
  } catch (error) {
    return next(error as customError);
  }
}

export async function addClubMedia(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId } = req.params;
    const {
      mediaId,
      mediaType,
      title,
      description,
      startDate,
      endDate,
      mediaData,
    } = req.body;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (
      !userMember ||
      (userMember.role !== 'leader' && userMember.role !== 'moderator')
    ) {
      return res
        .status(403)
        .json({ message: 'Only leaders and moderators can add media' });
    }

    // Check if media exists in MediaBase and create it if it doesn't
    let existingMedia = null;
    let createMedia = true;

    if (mediaId) {
      existingMedia = await MediaBase.findOne({
        contentId: mediaId,
        type: mediaType,
      });
      if (existingMedia) {
        createMedia = false;
      }
    }

    // Create media if it doesn't exist and we have media data
    if (createMedia && mediaData && mediaId) {
      if (mediaType === 'video' && mediaData.youtubeChannelInfo) {
        // Handle YouTube video media creation
        const channelMedia = await MediaBase.create({
          contentId: mediaData.youtubeChannelInfo.channelId,
          title: {
            contentTitleNative: mediaData.youtubeChannelInfo.channelTitle,
            contentTitleEnglish: mediaData.youtubeChannelInfo.channelTitle,
          },
          contentImage: mediaData.youtubeChannelInfo.channelImage,
          coverImage: mediaData.youtubeChannelInfo.channelImage,
          description: [
            {
              description:
                mediaData.youtubeChannelInfo.channelDescription || '',
              language: 'eng',
            },
          ],
          type: 'video',
          isAdult: false,
        });
        existingMedia = channelMedia;
      } else if (mediaType !== 'audio' && mediaType !== 'other') {
        // Handle regular AniList content
        const createdMedia = await MediaBase.create({
          contentId: mediaId,
          title: {
            contentTitleNative: mediaData.contentTitleNative || title,
            contentTitleEnglish: mediaData.contentTitleEnglish || '',
            contentTitleRomaji: mediaData.contentTitleRomaji || '',
          },
          contentImage: mediaData.contentImage,
          episodes: mediaData.episodes,
          episodeDuration: mediaData.episodeDuration,
          runtime: mediaData.runtime,
          synonyms: mediaData.synonyms || [],
          chapters: mediaData.chapters,
          volumes: mediaData.volumes,
          isAdult: mediaData.isAdult || false,
          coverImage: mediaData.coverImage,
          type: mediaType,
          description: mediaData.description || [
            { description: '', language: 'eng' },
          ],
        });
        existingMedia = createdMedia;
      }
    }

    // If we still don't have media, try one more search
    if (!existingMedia && mediaId) {
      existingMedia = await MediaBase.findOne({
        contentId: mediaId,
        type: mediaType,
      });
    }

    const newMedia = {
      mediaId,
      mediaType,
      title,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      addedBy: userId,
      votes: [],
      isActive: true,
    };

    club.currentMedia.push(newMedia);
    await club.save();

    return res
      .status(201)
      .json({ message: 'Media added successfully', media: newMedia });
  } catch (error) {
    return next(error as customError);
  }
}

// Edit club media (consumption period dates)
export async function editClubMedia(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, mediaId } = req.params;
    const { title, description, startDate, endDate } = req.body;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (
      !userMember ||
      (userMember.role !== 'leader' && userMember.role !== 'moderator')
    ) {
      return res
        .status(403)
        .json({ message: 'Only leaders and moderators can edit media' });
    }

    // Find the media to edit
    const mediaIndex = club.currentMedia.findIndex(
      (media) => media._id?.toString() === mediaId
    );

    if (mediaIndex === -1) {
      return res.status(404).json({ message: 'Media not found' });
    }

    const media = club.currentMedia[mediaIndex];

    // Validate dates
    const newStartDate = new Date(startDate);
    const newEndDate = new Date(endDate);

    if (newStartDate >= newEndDate) {
      return res
        .status(400)
        .json({ message: 'End date must be after start date' });
    }

    // Update the media using findByIdAndUpdate with arrayFilters to avoid validation issues
    const updatedClub = await Club.findByIdAndUpdate(
      clubId,
      {
        $set: {
          'currentMedia.$[elem].title': title || media.title,
          'currentMedia.$[elem].description':
            description !== undefined ? description : media.description,
          'currentMedia.$[elem].startDate': newStartDate,
          'currentMedia.$[elem].endDate': newEndDate,
        },
      },
      {
        arrayFilters: [{ 'elem._id': new Types.ObjectId(mediaId) }],
        new: true,
        runValidators: false, // Skip validation to avoid required field errors
      }
    );

    if (!updatedClub) {
      return res.status(404).json({ message: 'Failed to update media' });
    }

    const updatedMedia = updatedClub.currentMedia.find(
      (m) => m._id?.toString() === mediaId
    );

    return res.status(200).json({
      message: 'Media updated successfully',
      media: updatedMedia,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Get club media (current and past)
export async function getClubMedia(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId } = req.params;
    const { active = 'true' } = req.query;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId)
      .populate('currentMedia.addedBy', 'username avatar')
      .populate('currentMedia.votes.user', 'username avatar');

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const isActiveFilter = active === 'true';
    const filteredMedia = club.currentMedia.filter(
      (media) => media.isActive === isActiveFilter
    );

    // Enhance media with actual media documents for images and metadata
    const enhancedMedia = await Promise.all(
      filteredMedia.map(async (media) => {
        try {
          const mediaDocument = await MediaBase.findOne({
            contentId: media.mediaId,
            type: media.mediaType,
          });

          return {
            ...(media as any).toObject(),
            mediaDocument: mediaDocument || null,
          };
        } catch (error) {
          return {
            ...(media as any).toObject(),
            mediaDocument: null,
          };
        }
      })
    );

    return res.status(200).json({ media: enhancedMedia });
  } catch (error) {
    return next(error as customError);
  }
}

// Add review for club media
export async function addClubReview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, mediaId } = req.params;
    const { content, rating, hasSpoilers } = req.body;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Check if user is a member
    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (!userMember || userMember.status !== 'active') {
      return res
        .status(403)
        .json({ message: 'Only active club members can write reviews' });
    }

    // Check if media exists in club
    const media = club.currentMedia.find((m) => m._id?.toString() === mediaId);
    if (!media) {
      return res.status(404).json({ message: 'Media not found in club' });
    }

    // Import ClubReview model
    const { ClubReview } = await import('../models/club.model.js');

    // Check if user already reviewed this media
    const existingReview = await ClubReview.findOne({
      user: userId,
      clubMedia: mediaId,
    });

    if (existingReview) {
      return res
        .status(400)
        .json({ message: 'You have already reviewed this media' });
    }

    const newReview = new ClubReview({
      user: userId,
      clubMedia: mediaId,
      content,
      rating,
      hasSpoilers: hasSpoilers || false,
    });

    await newReview.save();

    return res
      .status(201)
      .json({ message: 'Review added successfully', review: newReview });
  } catch (error) {
    return next(error as customError);
  }
}

// Get reviews for club media
export async function getClubReviews(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, mediaId } = req.params;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    // Import ClubReview model
    const { ClubReview } = await import('../models/club.model.js');

    const reviews = await ClubReview.find({ clubMedia: mediaId })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json({ reviews });
  } catch (error) {
    return next(error as customError);
  }
}

// Edit review
export async function editReview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, mediaId, reviewId } = req.params;
    const { content, rating, hasSpoilers } = req.body;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId) || !Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid club ID or review ID' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Review content is required' });
    }

    if (content.length > 1000) {
      return res
        .status(400)
        .json({ message: 'Review content must be 1000 characters or less' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res
        .status(400)
        .json({ message: 'Rating must be between 1 and 5' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Check if user is a member
    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (!userMember || userMember.status !== 'active') {
      return res
        .status(403)
        .json({ message: 'Only active club members can edit reviews' });
    }

    // Import ClubReview model
    const { ClubReview } = await import('../models/club.model.js');

    const review = await ClubReview.findOne({
      _id: reviewId,
      clubMedia: mediaId,
      user: userId, // Only allow users to edit their own reviews
    });

    if (!review) {
      return res
        .status(404)
        .json({ message: 'Review not found or you are not the author' });
    }

    // Update the review
    review.content = content.trim();
    review.hasSpoilers = hasSpoilers || false;
    review.editedAt = new Date();

    if (rating !== undefined) {
      review.rating = rating;
    }

    await review.save();

    // Populate user data for response
    const updatedReview = await ClubReview.findById(reviewId).populate(
      'user',
      'username avatar'
    );

    return res
      .status(200)
      .json({ message: 'Review updated successfully', review: updatedReview });
  } catch (error) {
    return next(error as customError);
  }
}

// Like/Unlike review
export async function toggleReviewLike(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, mediaId, reviewId } = req.params;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId) || !Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid club ID or review ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Check if user is a member
    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (!userMember || userMember.status !== 'active') {
      return res
        .status(403)
        .json({ message: 'Only active club members can like reviews' });
    }

    // Import ClubReview model
    const { ClubReview } = await import('../models/club.model.js');

    const review = await ClubReview.findOne({
      _id: reviewId,
      clubMedia: mediaId,
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const userIdString = userId.toString();
    const isLiked = review.likes.some((id) => id.toString() === userIdString);

    if (isLiked) {
      review.likes = review.likes.filter(
        (id) => id.toString() !== userIdString
      );
    } else {
      review.likes.push(userId);
    }

    await review.save();
    return res.status(200).json({
      message: isLiked
        ? 'Review unliked successfully'
        : 'Review liked successfully',
      liked: !isLiked,
      likesCount: review.likes.length,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Create a new media voting (Step 1: Basic Info)
export async function createMediaVoting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId } = req.params;
    const {
      title,
      description,
      mediaType,
      customMediaType,
      votingStartDate,
      votingEndDate,
      consumptionStartDate,
      consumptionEndDate,
      candidateSubmissionType,
      suggestionStartDate,
      suggestionEndDate,
    } = req.body;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (
      !userMember ||
      (userMember.role !== 'leader' && userMember.role !== 'moderator')
    ) {
      return res
        .status(403)
        .json({ message: 'Only leaders and moderators can create votings' });
    }

    // Validate dates
    const votingStart = new Date(votingStartDate);
    const votingEnd = new Date(votingEndDate);
    const consumptionStart = new Date(consumptionStartDate);
    const consumptionEnd = new Date(consumptionEndDate);

    // Allow testing with past dates by checking for a testing flag in the request
    const isTestingMode = req.body.testingMode === true;
    const now = new Date();

    if (votingStart >= votingEnd) {
      return res
        .status(400)
        .json({ message: 'Voting end date must be after start date' });
    }

    if (consumptionStart >= consumptionEnd) {
      return res
        .status(400)
        .json({ message: 'Consumption end date must be after start date' });
    }

    if (votingEnd >= consumptionStart) {
      return res
        .status(400)
        .json({ message: 'Consumption must start after voting ends' });
    }

    // For non-testing mode, validate that dates are in the future
    if (!isTestingMode) {
      if (votingStart <= now) {
        return res
          .status(400)
          .json({ message: 'Voting start date must be in the future' });
      }
    }

    let suggestionStart: Date | undefined;
    let suggestionEnd: Date | undefined;

    if (candidateSubmissionType === 'member_suggestions') {
      if (!suggestionStartDate || !suggestionEndDate) {
        return res.status(400).json({
          message: 'Suggestion dates are required for member suggestions',
        });
      }

      suggestionStart = new Date(suggestionStartDate);
      suggestionEnd = new Date(suggestionEndDate);

      if (suggestionStart >= suggestionEnd) {
        return res
          .status(400)
          .json({ message: 'Suggestion end date must be after start date' });
      }

      if (suggestionEnd >= votingStart) {
        return res
          .status(400)
          .json({ message: 'Suggestions must end before voting starts' });
      }

      // For non-testing mode, validate that suggestion dates are appropriate
      if (!isTestingMode) {
        if (suggestionStart <= now) {
          return res
            .status(400)
            .json({ message: 'Suggestion start date must be in the future' });
        }
      }
    }

    // Determine initial status based on current time and testing mode
    let initialStatus:
      | 'setup'
      | 'suggestions_open'
      | 'suggestions_closed'
      | 'voting_open'
      | 'voting_closed'
      | 'completed' = 'setup';

    if (candidateSubmissionType === 'member_suggestions' && suggestionStart) {
      if (isTestingMode) {
        // In testing mode, allow manually setting status for past dates
        if (suggestionStart <= now && suggestionEnd && suggestionEnd > now) {
          initialStatus = 'suggestions_open';
        } else if (
          suggestionEnd &&
          suggestionEnd <= now &&
          votingStart <= now &&
          votingEnd > now
        ) {
          initialStatus = 'voting_open';
        } else if (
          votingEnd <= now &&
          consumptionStart <= now &&
          consumptionEnd > now
        ) {
          initialStatus = 'completed';
        } else if (votingEnd <= now) {
          initialStatus = 'voting_closed';
        } else if (suggestionEnd && suggestionEnd <= now) {
          initialStatus = 'suggestions_closed';
        } else {
          initialStatus = 'suggestions_open';
        }
      } else {
        // Normal mode - only set to suggestions_open if suggestion period has started
        initialStatus = suggestionStart <= now ? 'suggestions_open' : 'setup';
      }
    }

    const newVoting = {
      title,
      description,
      mediaType,
      customMediaType: mediaType === 'custom' ? customMediaType : undefined,
      candidateSubmissionType,
      suggestionStartDate: suggestionStart,
      suggestionEndDate: suggestionEnd,
      votingStartDate: votingStart,
      votingEndDate: votingEnd,
      consumptionStartDate: consumptionStart,
      consumptionEndDate: consumptionEnd,
      status: initialStatus,
      isActive: true,
      createdBy: userId,
      candidates: [],
    };

    club.mediaVotings.push(newVoting);
    await club.save();

    // Get the saved voting with its generated _id
    const savedClub = await Club.findById(clubId);
    const savedVoting =
      savedClub?.mediaVotings[savedClub.mediaVotings.length - 1];

    return res.status(201).json({
      message: 'Media voting created successfully',
      voting: savedVoting,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Edit media voting (only in setup status)
export async function editMediaVoting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, votingId } = req.params;
    const {
      title,
      description,
      mediaType,
      customMediaType,
      votingStartDate,
      votingEndDate,
      consumptionStartDate,
      consumptionEndDate,
      candidateSubmissionType,
      suggestionStartDate,
      suggestionEndDate,
    } = req.body;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (
      !userMember ||
      (userMember.role !== 'leader' && userMember.role !== 'moderator')
    ) {
      return res
        .status(403)
        .json({ message: 'Only leaders and moderators can edit votings' });
    }

    const votingIndex = club.mediaVotings.findIndex(
      (v) => v._id?.toString() === votingId
    );
    if (votingIndex === -1) {
      return res.status(404).json({ message: 'Voting not found' });
    }

    const voting = club.mediaVotings[votingIndex];

    // Allow editing votings in setup, suggestions_closed, voting_closed, or completed status
    // In later stages, only consumption period can be modified on frontend
    if (
      voting.status !== 'setup' &&
      voting.status !== 'suggestions_closed' &&
      voting.status !== 'voting_closed' &&
      voting.status !== 'completed'
    ) {
      return res.status(400).json({
        message:
          'Can only edit votings that are in setup, suggestions_closed, voting_closed, or completed status',
      });
    }

    // Validate dates
    const votingStart = new Date(votingStartDate);
    const votingEnd = new Date(votingEndDate);
    const consumptionStart = new Date(consumptionStartDate);
    const consumptionEnd = new Date(consumptionEndDate);

    const isTestingMode = req.body.testingMode === true;
    const now = new Date();

    // Check if this is a late-stage edit (only consumption period should be modified)
    const isLateStageEdit =
      voting.status === 'voting_closed' || voting.status === 'completed';

    // Always validate consumption period dates
    if (consumptionStart >= consumptionEnd) {
      return res
        .status(400)
        .json({ message: 'Consumption end date must be after start date' });
    }

    // For late-stage edits, only validate consumption dates and skip other validations
    if (!isLateStageEdit) {
      // Validate all dates for early-stage edits
      if (votingStart >= votingEnd) {
        return res
          .status(400)
          .json({ message: 'Voting end date must be after start date' });
      }

      if (votingEnd >= consumptionStart) {
        return res
          .status(400)
          .json({ message: 'Consumption must start after voting ends' });
      }

      // For non-testing mode, validate that dates are in the future
      if (!isTestingMode) {
        if (votingStart <= now) {
          return res
            .status(400)
            .json({ message: 'Voting start date must be in the future' });
        }
      }
    } else {
      // For late-stage edits, ensure consumption dates are reasonable
      // Allow consumption to start in the past since voting may have already completed
      if (!isTestingMode) {
        // Only check that consumption end is not too far in the past (more than 1 year)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        if (consumptionEnd < oneYearAgo) {
          return res.status(400).json({
            message:
              'Consumption end date cannot be more than 1 year in the past',
          });
        }
      }
    }

    let suggestionStart: Date | undefined;
    let suggestionEnd: Date | undefined;

    // Only validate suggestions for early-stage edits
    if (!isLateStageEdit && candidateSubmissionType === 'member_suggestions') {
      if (!suggestionStartDate || !suggestionEndDate) {
        return res.status(400).json({
          message: 'Suggestion dates are required for member suggestions',
        });
      }

      suggestionStart = new Date(suggestionStartDate);
      suggestionEnd = new Date(suggestionEndDate);

      if (suggestionStart >= suggestionEnd) {
        return res
          .status(400)
          .json({ message: 'Suggestion end date must be after start date' });
      }

      if (suggestionEnd >= votingStart) {
        return res
          .status(400)
          .json({ message: 'Suggestions must end before voting starts' });
      }

      if (!isTestingMode) {
        if (suggestionStart <= now) {
          return res
            .status(400)
            .json({ message: 'Suggestion start date must be in the future' });
        }
      }
    } else if (isLateStageEdit) {
      // For late-stage edits, preserve existing suggestion dates
      suggestionStart = voting.suggestionStartDate;
      suggestionEnd = voting.suggestionEndDate;
    }

    // Update the voting
    club.mediaVotings[votingIndex] = {
      ...voting,
      // For late-stage edits, only update consumption dates
      // For early-stage edits, update all fields
      title: isLateStageEdit ? voting.title : title,
      description: isLateStageEdit ? voting.description : description,
      mediaType: isLateStageEdit ? voting.mediaType : mediaType,
      customMediaType: isLateStageEdit
        ? voting.customMediaType
        : mediaType === 'custom'
          ? customMediaType
          : undefined,
      candidateSubmissionType: isLateStageEdit
        ? voting.candidateSubmissionType
        : candidateSubmissionType,
      suggestionStartDate: suggestionStart,
      suggestionEndDate: suggestionEnd,
      votingStartDate: isLateStageEdit ? voting.votingStartDate : votingStart,
      votingEndDate: isLateStageEdit ? voting.votingEndDate : votingEnd,
      // Always allow consumption dates to be updated
      consumptionStartDate: consumptionStart,
      consumptionEndDate: consumptionEnd,
      // Explicitly preserve these required fields
      createdBy: voting.createdBy,
      isActive: voting.isActive,
      status: voting.status,
      candidates: voting.candidates,
      _id: voting._id,
    };

    await club.save();

    const updatedVoting = club.mediaVotings[votingIndex];

    return res.status(200).json({
      message: 'Media voting updated successfully',
      voting: updatedVoting,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Delete media voting (only in setup status)
export async function deleteMediaVoting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, votingId } = req.params;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (
      !userMember ||
      (userMember.role !== 'leader' && userMember.role !== 'moderator')
    ) {
      return res
        .status(403)
        .json({ message: 'Only leaders and moderators can delete votings' });
    }

    const votingIndex = club.mediaVotings.findIndex(
      (v) => v._id?.toString() === votingId
    );
    if (votingIndex === -1) {
      return res.status(404).json({ message: 'Voting not found' });
    }

    const voting = club.mediaVotings[votingIndex];

    // Only allow deleting votings that are still in setup phase or suggestions_closed
    if (voting.status !== 'setup' && voting.status !== 'suggestions_closed') {
      return res.status(400).json({
        message:
          'Can only delete votings that are in setup or suggestions_closed status',
      });
    }

    // Remove the voting
    club.mediaVotings.splice(votingIndex, 1);
    await club.save();

    return res.status(200).json({
      message: 'Media voting deleted successfully',
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Add candidate to media voting (Step 2: Add candidates or during suggestion period)
export async function addVotingCandidate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, votingId } = req.params;
    const { mediaId, title, description, image, isAdult } = req.body;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (!userMember || userMember.status !== 'active') {
      return res
        .status(403)
        .json({ message: 'Only active club members can add candidates' });
    }

    const votingIndex = club.mediaVotings.findIndex(
      (v) => v._id?.toString() === votingId
    );
    if (votingIndex === -1) {
      return res.status(404).json({ message: 'Voting not found' });
    }

    const voting = club.mediaVotings[votingIndex];

    // Check permissions and status
    const canAddCandidate =
      (voting.candidateSubmissionType === 'manual' &&
        (userMember.role === 'leader' || userMember.role === 'moderator') &&
        voting.status === 'setup') ||
      (voting.candidateSubmissionType === 'member_suggestions' &&
        voting.status === 'suggestions_open' &&
        voting.suggestionEndDate &&
        new Date() <= voting.suggestionEndDate);

    if (!canAddCandidate) {
      return res
        .status(400)
        .json({ message: 'Cannot add candidates at this time' });
    }

    // Check if media already exists in candidates
    const existingCandidate = voting.candidates.find(
      (c) => c.mediaId === mediaId
    );
    if (existingCandidate) {
      return res
        .status(400)
        .json({ message: 'This media is already a candidate' });
    }

    const newCandidate = {
      mediaId,
      title,
      description,
      image,
      addedBy: userId,
      votes: [],
      isAdult: isAdult || false,
    };

    club.mediaVotings[votingIndex].candidates.push(newCandidate);
    await club.save();

    return res.status(201).json({
      message: 'Candidate added successfully',
      candidate: newCandidate,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Finalize voting setup (Step 3: Confirm and activate)
export async function finalizeVoting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, votingId } = req.params;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (
      !userMember ||
      (userMember.role !== 'leader' && userMember.role !== 'moderator')
    ) {
      return res
        .status(403)
        .json({ message: 'Only leaders and moderators can finalize votings' });
    }

    const votingIndex = club.mediaVotings.findIndex(
      (v) => v._id?.toString() === votingId
    );
    if (votingIndex === -1) {
      return res.status(404).json({ message: 'Voting not found' });
    }

    const voting = club.mediaVotings[votingIndex];

    if (voting.status !== 'setup' && voting.status !== 'suggestions_closed') {
      return res
        .status(400)
        .json({ message: 'Voting cannot be finalized in current status' });
    }

    if (voting.candidates.length === 0) {
      return res
        .status(400)
        .json({ message: 'At least one candidate is required' });
    }

    // Update status based on current time
    const now = new Date();
    let newStatus:
      | 'setup'
      | 'suggestions_open'
      | 'suggestions_closed'
      | 'voting_open'
      | 'voting_closed'
      | 'completed' = 'setup';

    if (voting.candidateSubmissionType === 'member_suggestions') {
      if (voting.suggestionEndDate && now >= voting.suggestionEndDate) {
        newStatus = 'suggestions_closed';
      } else {
        newStatus = 'suggestions_open';
      }
    }

    if (now >= voting.votingStartDate) {
      newStatus = 'voting_open';
    }

    club.mediaVotings[votingIndex].status = newStatus;
    await club.save();

    return res.status(200).json({
      message: 'Voting finalized successfully',
      status: newStatus,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Vote for a candidate in media voting
export async function voteForCandidate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, votingId, candidateIndex } = req.params;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Auto-update voting statuses based on current date
    await updateVotingStatuses(club);

    // Refresh club data after potential status updates
    const updatedClub = await Club.findById(clubId);
    if (!updatedClub) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMember = updatedClub.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (!userMember || userMember.status !== 'active') {
      return res
        .status(403)
        .json({ message: 'Only active club members can vote' });
    }

    const votingIndex = updatedClub.mediaVotings.findIndex(
      (v) => v._id?.toString() === votingId
    );
    if (votingIndex === -1) {
      return res.status(404).json({ message: 'Voting not found' });
    }

    const voting = updatedClub.mediaVotings[votingIndex];

    if (voting.status !== 'voting_open') {
      return res.status(400).json({
        message: 'Voting is not currently open',
        currentStatus: voting.status,
        votingStart: voting.votingStartDate,
        votingEnd: voting.votingEndDate,
      });
    }

    if (new Date() > voting.votingEndDate) {
      return res.status(400).json({ message: 'Voting period has ended' });
    }

    const candidateIdx = parseInt(candidateIndex);
    if (candidateIdx < 0 || candidateIdx >= voting.candidates.length) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Check if user has already voted (prevent vote changes)
    const hasAlreadyVoted = voting.candidates.some((candidate) =>
      candidate.votes.some((vote) => vote.toString() === userId.toString())
    );

    if (hasAlreadyVoted) {
      return res.status(400).json({
        message:
          'You have already voted in this voting. Votes cannot be changed.',
      });
    }

    // Add vote to selected candidate
    updatedClub.mediaVotings[votingIndex].candidates[candidateIdx].votes.push(
      userId
    );
    await updatedClub.save();

    return res.status(200).json({ message: 'Vote recorded successfully' });
  } catch (error) {
    return next(error as customError);
  }
}

// Get media votings for a club
export async function getMediaVotings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId } = req.params;
    const { active = 'true' } = req.query;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId)
      .populate('mediaVotings.createdBy', 'username avatar')
      .populate('mediaVotings.candidates.addedBy', 'username avatar');

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Auto-update voting statuses based on current date
    await updateVotingStatuses(club);

    // Refresh club data after potential status updates
    const updatedClub = await Club.findById(clubId)
      .populate('mediaVotings.createdBy', 'username avatar')
      .populate('mediaVotings.candidates.addedBy', 'username avatar');

    if (!updatedClub) {
      return res.status(404).json({ message: 'Club not found after update' });
    }

    const isActiveFilter = active === 'true';
    const filteredVotings = updatedClub.mediaVotings.filter(
      (voting) => voting.isActive === isActiveFilter
    );

    return res.status(200).json({ votings: filteredVotings });
  } catch (error) {
    return next(error as customError);
  }
}

// Complete voting and select winner
export async function completeVoting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, votingId } = req.params;
    const userId = res.locals.user._id;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (
      !userMember ||
      (userMember.role !== 'leader' && userMember.role !== 'moderator')
    ) {
      return res
        .status(403)
        .json({ message: 'Only leaders and moderators can complete votings' });
    }

    const votingIndex = club.mediaVotings.findIndex(
      (v) => v._id?.toString() === votingId
    );
    if (votingIndex === -1) {
      return res.status(404).json({ message: 'Voting not found' });
    }

    const voting = club.mediaVotings[votingIndex];

    if (voting.status === 'completed') {
      return res.status(400).json({ message: 'Voting is already completed' });
    }

    // Find candidate with most votes
    let winnerCandidate: any = null;
    let maxVotes = 0;

    voting.candidates.forEach((candidate: any) => {
      if (candidate.votes.length > maxVotes) {
        maxVotes = candidate.votes.length;
        winnerCandidate = candidate;
      }
    });

    if (winnerCandidate) {
      // Set winner candidate
      club.mediaVotings[votingIndex].winnerCandidate = {
        mediaId: winnerCandidate.mediaId,
        title: winnerCandidate.title,
        description: winnerCandidate.description,
        image: winnerCandidate.image,
      };

      // Add winner to currentMedia
      const newMedia = {
        mediaId: winnerCandidate.mediaId,
        mediaType:
          voting.mediaType === 'custom' ? 'reading' : (voting.mediaType as any),
        title: winnerCandidate.title,
        description: winnerCandidate.description,
        startDate: voting.consumptionStartDate,
        endDate: voting.consumptionEndDate,
        isActive: true,
        addedBy: voting.createdBy,
        votes: [],
      };

      club.currentMedia.push(newMedia);
    }

    club.mediaVotings[votingIndex].status = 'completed';
    club.mediaVotings[votingIndex].isActive = false;

    await club.save();

    return res.status(200).json({
      message: 'Voting completed successfully',
      winner: winnerCandidate,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Get recent activity for club (logs and reviews from last 7 days)
export async function getClubRecentActivity(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId } = req.params;
    const { limit = 10, days = 7, page = 1 } = req.query;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Check if user is a member to see activity
    const userId = res.locals.user._id;
    const userMember = club.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (!userMember || userMember.status !== 'active') {
      return res.status(403).json({
        message: 'Only active club members can view club activity',
      });
    }

    // Get club member user IDs
    const memberIds = club.members
      .filter((member) => member.status === 'active')
      .map((member) => member.user);

    // Calculate date range
    const daysNum = parseInt(days as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skipNum = (pageNum - 1) * limitNum;
    // type for recentLogs
    interface IRecentLog {
      _id: Types.ObjectId;
      user: {
        _id: Types.ObjectId;
        username: string;
        avatar?: string;
      };
      description: string;
      episodes?: number;
      pages?: number;
      time?: number;
      xp?: number;
      createdAt: Date;
      media?: {
        _id: Types.ObjectId;
        contentId: string;
        titleEnglish?: string;
        titleNative?: string;
        titleRomaji?: string;
      };
    }
    // Get recent logs (do NOT filter by club media)
    const recentLogs: IRecentLog[] = await Log.aggregate([
      { $match: { user: { $in: memberIds }, createdAt: { $gte: startDate } } },
      { $sort: { createdAt: -1 } },
      { $skip: skipNum },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'media',
          localField: 'mediaId',
          foreignField: 'contentId',
          as: 'mediaInfo',
        },
      },
      {
        $unwind: { path: '$mediaInfo', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          _id: 1,
          user: {
            _id: '$userInfo._id',
            username: '$userInfo.username',
            avatar: '$userInfo.avatar',
          },
          description: 1,
          episodes: 1,
          pages: 1,
          time: 1,
          xp: 1,
          createdAt: 1,
          media: {
            _id: '$mediaInfo._id',
            contentId: '$mediaInfo.contentId',
            titleEnglish: '$mediaInfo.title.contentTitleEnglish',
            titleNative: '$mediaInfo.title.contentTitleNative',
            titleRomaji: '$mediaInfo.title.contentTitleRomaji',
          },
        },
      },
    ]);
    // Get recent reviews
    const { ClubReview } = await import('../models/club.model.js');
    const clubMediaObjectIds = club.currentMedia.map((media) => media._id);

    const recentReviews = await ClubReview.find({
      user: { $in: memberIds },
      clubMedia: { $in: clubMediaObjectIds },
      createdAt: { $gte: startDate },
    })
      .populate('user', 'username avatar')
      .populate('clubMedia', 'title')
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(limitNum);

    // Combine and sort by date
    const activities = [
      ...recentLogs.map((log) => {
        // Try to get populated media title
        let mediaTitle =
          log.media?.titleEnglish ||
          log.media?.titleRomaji ||
          log.media?.titleNative ||
          null;

        let foundMedia = null;
        if (log.media?.contentId) {
          foundMedia = club.currentMedia.find(
            (m) => m.mediaId === log.media?.contentId
          );
        }
        return {
          type: 'log' as const,
          _id: log._id,
          user: log.user,
          media: {
            _id: log.media?._id || null,
            title: mediaTitle || 'Unknown Media',
          },
          clubMedia: !!foundMedia,
          content: log.description || '',
          metadata: {
            episodes: log.episodes,
            pages: log.pages,
            time: log.time,
            xp: log.xp,
          },
          createdAt: (log as any).createdAt,
        };
      }),
      ...recentReviews.map((review) => ({
        type: 'review' as const,
        _id: review._id,
        user: review.user,
        media: {
          _id: review.clubMedia._id,
          title: (review.clubMedia as any)?.title || 'Unknown Media',
        },
        content: review.content,
        metadata: {
          rating: review.rating,
          hasSpoilers: review.hasSpoilers,
        },
        createdAt: review.createdAt,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Get total count for pagination
    const totalLogs = await Log.countDocuments({
      user: { $in: memberIds },
      createdAt: { $gte: startDate },
    });
    const totalReviews = await ClubReview.countDocuments({
      user: { $in: memberIds },
      clubMedia: { $in: clubMediaObjectIds },
      createdAt: { $gte: startDate },
    });
    const total = totalLogs + totalReviews;

    return res.status(200).json({
      activities,
      total,
      page: pageNum,
      pageSize: limitNum,
      hasMore: pageNum * limitNum < total,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Get club member logs for specific media (after consumption period started)
export async function getClubMediaLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, mediaId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!Types.ObjectId.isValid(clubId) || !Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({ message: 'Invalid club or media ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Find the specific media in the club
    const media = club.currentMedia.find((m) => m._id?.toString() === mediaId);
    if (!media) {
      return res.status(404).json({ message: 'Media not found in club' });
    }

    // Get club member user IDs
    const memberIds = club.members
      .filter((member) => member.status === 'active')
      .map((member) => member.user);

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get logs from club members for this media after the start date
    const logs = await Log.find({
      user: { $in: memberIds },
      mediaId: media.mediaId,
      type: media.mediaType,
      createdAt: { $gte: new Date(media.startDate) },
    })
      .populate('user', 'username avatar')
      .populate(
        'mediaId',
        'title contentTitleEnglish contentTitleRomaji contentTitleNative'
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Log.countDocuments({
      user: { $in: memberIds },
      mediaId: media.mediaId,
      type: media.mediaType,
      createdAt: { $gte: new Date(media.startDate) },
    });

    return res.status(200).json({
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Get club member rankings for specific media (after consumption period started)
export async function getClubMediaRankings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, mediaId } = req.params;
    const { period = 'consumption' } = req.query; // 'consumption' or 'alltime'

    if (!Types.ObjectId.isValid(clubId) || !Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({ message: 'Invalid club or media ID' });
    }

    const club = await Club.findById(clubId).populate(
      'members.user',
      'username avatar'
    );
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Find the specific media in the club
    const media = club.currentMedia.find((m) => m._id?.toString() === mediaId);
    if (!media) {
      return res.status(404).json({ message: 'Media not found in club' });
    }

    // Get club member user IDs (extract just the _id from populated user objects)
    const memberIds = club.members
      .filter((member) => member.status === 'active')
      .map((member) => {
        // Handle both populated and non-populated user references
        if (typeof member.user === 'object' && member.user._id) {
          return member.user._id;
        }
        return member.user;
      });

    // Base match criteria
    const baseMatch: any = {
      user: { $in: memberIds },
      mediaId: media.mediaId,
      type: media.mediaType,
    };

    // Add time filter if consumption period
    if (period === 'consumption') {
      baseMatch.createdAt = { $gte: new Date(media.startDate) };
    }

    const memberStats = await Log.aggregate([
      {
        $match: baseMatch,
      },
      {
        $group: {
          _id: '$user',
          totalLogs: { $sum: 1 },
          totalXp: { $sum: { $ifNull: ['$xp', 0] } },
          totalTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'anime'] },
                    {
                      $or: [
                        { $eq: ['$time', 0] },
                        { $eq: ['$time', null] },
                        { $eq: [{ $type: '$time' }, 'missing'] },
                      ],
                    },
                    { $gt: ['$episodes', 0] },
                  ],
                },
                { $multiply: ['$episodes', 24] },
                { $ifNull: ['$time', 0] },
              ],
            },
          },
          totalEpisodes: { $sum: { $ifNull: ['$episodes', 0] } },
          totalPages: { $sum: { $ifNull: ['$pages', 0] } },
          firstLog: { $min: '$createdAt' },
          lastLog: { $max: '$createdAt' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          user: {
            _id: '$user._id',
            username: '$user.username',
            avatar: '$user.avatar',
          },
          totalLogs: 1,
          totalXp: 1,
          totalTime: 1,
          totalEpisodes: 1,
          totalPages: 1,
          firstLog: 1,
          lastLog: 1,
          score: '$totalXp', // Use XP as the primary ranking metric
        },
      },
      {
        $sort: { score: -1, totalLogs: -1 },
      },
    ]);

    // Add ranking positions
    const rankedMembers = memberStats.map((member: any, index: number) => ({
      ...member,
      rank: index + 1,
    }));

    // Include members who haven't logged yet
    const membersWithLogs = memberStats.map((stat: any) =>
      stat.user._id.toString()
    );
    const membersWithoutLogs = club.members
      .filter(
        (member: any) =>
          member.status === 'active' &&
          !membersWithLogs.includes(member.user._id.toString())
      )
      .map((member: any) => ({
        user: {
          _id: member.user._id,
          username: member.user.username,
          avatar: member.user.avatar,
        },
        totalLogs: 0,
        totalXp: 0,
        totalTime: 0,
        totalEpisodes: 0,
        totalPages: 0,
        firstLog: null,
        lastLog: null,
        score: 0,
        rank: rankedMembers.length + 1,
      }));

    const allRankings = [...rankedMembers, ...membersWithoutLogs];

    return res.status(200).json({
      rankings: allRankings,
      mediaInfo: {
        title: media.title,
        mediaType: media.mediaType,
        startDate: media.startDate,
        endDate: media.endDate,
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Get club media statistics (aggregated stats for all club members)
export async function getClubMediaStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId, mediaId } = req.params;
    const { period = 'consumption' } = req.query; // 'consumption' or 'alltime'

    if (!Types.ObjectId.isValid(clubId) || !Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({ message: 'Invalid club or media ID' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Find the specific media in the club
    const media = club.currentMedia.find((m) => m._id?.toString() === mediaId);
    if (!media) {
      return res.status(404).json({ message: 'Media not found in club' });
    }

    // Get club member user IDs
    const memberIds = club.members
      .filter((member) => member.status === 'active')
      .map((member) => member.user);

    // Base match criteria
    const baseMatch: any = {
      user: { $in: memberIds },
      mediaId: media.mediaId,
      type: media.mediaType,
    };

    // Add time filter if consumption period
    if (period === 'consumption') {
      baseMatch.createdAt = { $gte: new Date(media.startDate) };
    }

    const totalStats = await Log.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          totalMembers: { $addToSet: '$user' },
          totalXp: { $sum: '$xp' },
          totalTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'anime'] },
                    {
                      $or: [
                        { $eq: ['$time', 0] },
                        { $eq: ['$time', null] },
                        { $eq: [{ $type: '$time' }, 'missing'] },
                      ],
                    },
                    { $gt: ['$episodes', 0] },
                  ],
                },
                { $multiply: ['$episodes', 24] },
                { $ifNull: ['$time', 0] },
              ],
            },
          },
          totalEpisodes: { $sum: { $ifNull: ['$episodes', 0] } },
          totalChars: { $sum: { $ifNull: ['$chars', 0] } },
          totalPages: { $sum: { $ifNull: ['$pages', 0] } },
          firstLogDate: { $min: '$createdAt' },
          lastLogDate: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          totalLogs: 1,
          totalMembers: { $size: '$totalMembers' },
          totalXp: 1,
          totalTime: 1,
          totalEpisodes: 1,
          totalChars: 1,
          totalPages: 1,
          firstLogDate: 1,
          lastLogDate: 1,
        },
      },
    ]);

    // Get recent statistics (this week, this month)
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const recentMatch = { ...baseMatch };

    const recentStats = await Log.aggregate([
      { $match: recentMatch },
      {
        $facet: {
          thisWeek: [
            { $match: { createdAt: { $gte: thisWeekStart } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                activeMembers: { $addToSet: '$user' },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
            {
              $project: {
                count: 1,
                activeMembers: { $size: '$activeMembers' },
                episodes: 1,
                chars: 1,
                pages: 1,
                time: 1,
                xp: 1,
              },
            },
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: thisMonthStart } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                activeMembers: { $addToSet: '$user' },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
            {
              $project: {
                count: 1,
                activeMembers: { $size: '$activeMembers' },
                episodes: 1,
                chars: 1,
                pages: 1,
                time: 1,
                xp: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = totalStats[0] || {
      totalLogs: 0,
      totalMembers: 0,
      totalXp: 0,
      totalTime: 0,
      totalEpisodes: 0,
      totalChars: 0,
      totalPages: 0,
      firstLogDate: null,
      lastLogDate: null,
    };

    const recent = recentStats[0] || { thisWeek: [], thisMonth: [] };
    const thisWeek = recent.thisWeek[0] || {
      count: 0,
      activeMembers: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };
    const thisMonth = recent.thisMonth[0] || {
      count: 0,
      activeMembers: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };

    return res.status(200).json({
      mediaInfo: {
        mediaId: media.mediaId,
        mediaType: media.mediaType,
        title: media.title,
        startDate: media.startDate,
        endDate: media.endDate,
        isActive: media.isActive,
      },
      period: period as string,
      total: {
        logs: total.totalLogs,
        members: total.totalMembers,
        episodes: total.totalEpisodes,
        characters: total.totalChars,
        pages: total.totalPages,
        minutes: total.totalTime,
        hours: Math.round((total.totalTime / 60) * 10) / 10,
        xp: total.totalXp,
        firstLogDate: total.firstLogDate,
        lastLogDate: total.lastLogDate,
      },
      thisWeek: {
        logs: thisWeek.count,
        activeMembers: thisWeek.activeMembers,
        episodes: thisWeek.episodes,
        characters: thisWeek.chars,
        pages: thisWeek.pages,
        minutes: thisWeek.time,
        hours: Math.round((thisWeek.time / 60) * 10) / 10,
        xp: thisWeek.xp,
      },
      thisMonth: {
        logs: thisMonth.count,
        activeMembers: thisMonth.activeMembers,
        episodes: thisMonth.episodes,
        characters: thisMonth.chars,
        pages: thisMonth.pages,
        minutes: thisMonth.time,
        hours: Math.round((thisMonth.time / 60) * 10) / 10,
        xp: thisMonth.xp,
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Get club member rankings (overall, not media-specific)
export async function getClubMemberRankings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { clubId } = req.params;
    const {
      sortBy = 'totalXp',
      period = 'all-time',
      limit = 50,
      page = 1,
    } = req.query;

    if (!Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    const club = await Club.findById(clubId).populate(
      'members.user',
      'username avatar stats'
    );
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Get club member user IDs
    const activeMembers = club.members
      .filter((member) => member.status === 'active')
      .map((member) => ({
        userId: typeof member.user === 'object' ? member.user._id : member.user,
        joinDate: member.joinedAt,
        userObj: member.user,
      }));

    const memberIds = activeMembers.map((m) => m.userId);

    // Create date filter based on period
    let dateFilter: { createdAt?: { $gte?: Date; $lt?: Date } } = {};
    const now = new Date();

    if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter.createdAt = { $gte: startOfWeek };
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.createdAt = { $gte: startOfMonth };
    }

    // Aggregate member stats from logs
    const memberStats = await Log.aggregate([
      {
        $match: {
          user: { $in: memberIds },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: '$user',
          totalLogs: { $sum: 1 },
          totalXp: { $sum: { $ifNull: ['$xp', 0] } },
          totalTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'anime'] },
                    {
                      $or: [
                        { $eq: ['$time', 0] },
                        { $eq: ['$time', null] },
                        { $eq: [{ $type: '$time' }, 'missing'] },
                      ],
                    },
                    { $gt: ['$episodes', 0] },
                  ],
                },
                { $multiply: ['$episodes', 24] }, // 24 minutes per episode
                { $ifNull: ['$time', 0] },
              ],
            },
          },
        },
      },
      {
        $addFields: {
          totalHours: {
            $round: [{ $divide: ['$totalTime', 60] }, 1],
          },
        },
      },
    ]);

    // Create a map for quick lookup
    const statsMap = new Map();
    memberStats.forEach((stat) => {
      statsMap.set(stat._id.toString(), stat);
    });

    // Build rankings with member info
    const rankings = activeMembers
      .map((member) => {
        const stats = statsMap.get(member.userId.toString()) || {
          totalLogs: 0,
          totalXp: 0,
          totalTime: 0,
          totalHours: 0,
        };

        return {
          user: {
            _id: member.userId,
            username: (member.userObj as any)?.username || 'Unknown',
            avatar: (member.userObj as any)?.avatar,
            stats: {
              userLevel: (member.userObj as any)?.stats?.userLevel || 1,
              userXp: (member.userObj as any)?.stats?.userXp || 0,
            },
          },
          totalLogs: stats.totalLogs,
          totalXp: stats.totalXp,
          totalTime: stats.totalTime, // in minutes
          totalHours: stats.totalHours,
          rank: 0, // Will be assigned after sorting
          joinDate: member.joinDate.toISOString(),
        };
      })
      .filter((member) => {
        if (period !== 'all-time') {
          return member.totalLogs > 0;
        }
        return true;
      });

    // Sort based on selected criteria
    rankings.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'totalLogs':
          aValue = a.totalLogs;
          bValue = b.totalLogs;
          break;
        case 'totalTime':
          aValue = a.totalHours;
          bValue = b.totalHours;
          break;
        case 'level':
          aValue = a.user.stats.userLevel;
          bValue = b.user.stats.userLevel;
          break;
        default: // totalXp
          aValue = a.totalXp;
          bValue = b.totalXp;
          break;
      }

      return bValue - aValue; // descending order
    });

    // Assign ranks
    rankings.forEach((member, index) => {
      member.rank = index + 1;
    });

    // Apply pagination
    const skip = (Number(page) - 1) * Number(limit);
    const paginatedRankings = rankings.slice(skip, skip + Number(limit));

    return res.status(200).json({
      rankings: paginatedRankings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: rankings.length,
        totalPages: Math.ceil(rankings.length / Number(limit)),
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Auto-update voting statuses based on current date
export async function updateVotingStatuses(club: IClub): Promise<void> {
  const now = new Date();
  let hasChanges = false;

  for (let i = 0; i < club.mediaVotings.length; i++) {
    const voting = club.mediaVotings[i];
    let newStatus = voting.status;

    // Skip if voting is already completed
    if (voting.status === 'completed') {
      continue;
    }

    // Update status based on dates
    if (voting.candidateSubmissionType === 'member_suggestions') {
      if (
        voting.suggestionStartDate &&
        now >= voting.suggestionStartDate &&
        voting.suggestionEndDate &&
        now < voting.suggestionEndDate
      ) {
        newStatus = 'suggestions_open';
      } else if (
        voting.suggestionEndDate &&
        now >= voting.suggestionEndDate &&
        now < voting.votingStartDate
      ) {
        newStatus = 'suggestions_closed';
      }
    }

    // Check if voting should be open
    if (now >= voting.votingStartDate && now < voting.votingEndDate) {
      newStatus = 'voting_open';
    } else if (now >= voting.votingEndDate) {
      newStatus = 'voting_closed';
    }

    // Check if consumption period has started (auto-complete voting)
    if (
      now >= voting.consumptionStartDate &&
      voting.status !== 'voting_closed'
    ) {
      newStatus = 'voting_closed';

      // Auto-select winner and add to currentMedia when voting completes
      const winnerCandidate =
        voting.candidates.reduce<IClubMediaCandidate | null>(
          (winner, candidate) => {
            if (!winner || candidate.votes.length > winner.votes.length) {
              return candidate;
            }
            return winner;
          },
          null
        );

      if (winnerCandidate) {
        // Set winner candidate
        club.mediaVotings[i].winnerCandidate = {
          mediaId: winnerCandidate.mediaId,
          title: winnerCandidate.title,
          description: winnerCandidate.description,
          image: winnerCandidate.image,
        };

        // Add winner to currentMedia
        const newMedia = {
          mediaId: winnerCandidate.mediaId,
          mediaType:
            voting.mediaType === 'custom'
              ? 'reading'
              : (voting.mediaType as any),
          title: winnerCandidate.title,
          description: winnerCandidate.description,
          startDate: voting.consumptionStartDate,
          endDate: voting.consumptionEndDate,
          isActive: true,
          addedBy: voting.createdBy,
          votes: [],
        };

        club.currentMedia.push(newMedia);
      }

      club.mediaVotings[i].isActive = false;
    }

    // Update status if changed
    if (newStatus !== voting.status) {
      club.mediaVotings[i].status = newStatus;
      hasChanges = true;
    }
  }

  // Save changes if any status was updated
  if (hasChanges) {
    await club.save();
  }
}
