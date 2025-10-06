import { useEffect, useState } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MdCreate,
  MdPlayArrow,
  MdBook,
  MdMovie,
  MdCalendarToday,
} from 'react-icons/md';
import { getClubFn, getClubMediaFn } from '../../api/clubApi';
import Loader from '../Loader';
import QuickLog from '../QuickLog';
import ClubMediaNavbar from './ClubMediaNavbar';
import { OutletClubMediaContextType } from '../../types';
import { getAverageColorFn } from '../../api/trackerApi';
import { useUserDataStore } from '../../store/userData';

const getMediaTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'anime':
      return <MdPlayArrow className="text-lg" />;
    case 'manga':
    case 'reading':
      return <MdBook className="text-lg" />;
    case 'movie':
    case 'video':
      return <MdMovie className="text-lg" />;
    case 'vn':
      return <MdPlayArrow className="text-lg" />;
    default:
      return <MdPlayArrow className="text-lg" />;
  }
};

export default function ClubMediaHeader() {
  const { clubId, mediaId } = useParams<{ clubId: string; mediaId: string }>();
  const navigate = useNavigate();
  const [averageColor, setAverageColor] = useState<string>('#ffffff');
  const { user } = useUserDataStore();

  const [selectedMedia, setSelectedMedia] = useState<{
    mediaId: string;
    mediaType: string;
    title: string;
  } | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);

  const { data: club, isLoading: clubLoading } = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => getClubFn(clubId!),
    enabled: !!clubId,
  });

  const {
    data: clubMediaData,
    isLoading: clubMediaLoading,
    error: clubMediaError,
  } = useQuery({
    queryKey: ['clubMedia', clubId],
    queryFn: () => getClubMediaFn(clubId!, true),
    enabled: !!clubId,
  });

  const media =
    clubMediaData?.media.find((m) => m._id === mediaId) ||
    club?.currentMedia.find((m) => m._id === mediaId);

  useEffect(() => {
    async function getAvgColor() {
      if (media?.mediaDocument?.contentImage) {
        const color = await getAverageColorFn(
          media?.mediaDocument?.contentImage
        );
        if (color) {
          return setAverageColor(color.hex);
        }
        setAverageColor('#ffffff');
      }
    }

    void getAvgColor();
  }, [media]);

  if (clubLoading || clubMediaLoading) return <Loader />;

  if (!club) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Club Not Found</h1>
          <button
            onClick={() => navigate('/clubs')}
            className="btn btn-primary"
          >
            Back to Clubs
          </button>
        </div>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Media Not Found</h1>
          <button
            onClick={() => navigate(`/clubs/${clubId}`)}
            className="btn btn-primary"
          >
            Back to Club
          </button>
        </div>
      </div>
    );
  }

  const canAddReview = club.isUserMember && club.userStatus === 'active';

  return (
    <div className="flex flex-col justify-center bg-base-200 text-base-content">
      {/* Banner Background */}
      <div
        className={
          'h-48 sm:h-64 md:h-96 w-full bg-cover bg-center bg-no-repeat'
        }
        style={{
          backgroundImage: `url(${media?.mediaDocument?.coverImage})`,
          backgroundColor: averageColor,
        }}
      >
        {media?.mediaDocument?.coverImage ? (
          <div
            className={`flex flex-col justify-end size-full bg-linear-to-t from-shadow/[0.6] to-40% bg-cover ${
              media.mediaDocument.isAdult && user?.settings?.blurAdultContent
                ? 'blur-sm'
                : ''
            }`}
          />
        ) : (
          <></>
        )}
      </div>

      {/* Content Section with Media Poster */}
      <div className="bg-base-100">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
            {/* Media Poster */}
            <div className="flex flex-col items-center md:items-start">
              <div className="w-full max-w-[200px] md:w-full -mt-16 sm:-mt-24 md:-mt-32">
                {media.mediaDocument?.contentImage ? (
                  <img
                    src={media.mediaDocument.contentImage}
                    alt={media.title}
                    className={`w-full h-auto rounded-lg shadow-xl border-2 border-white/20 ${
                      media.mediaDocument.isAdult &&
                      user?.settings?.blurAdultContent
                        ? 'blur-sm'
                        : ''
                    }`}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full aspect-[2/3] rounded-lg shadow-xl border-2 border-white/20 bg-base-200 flex items-center justify-center">
                    <div className="text-4xl text-base-content/30">
                      {getMediaTypeIcon(media.mediaType)}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              {canAddReview && (
                <button
                  className="btn btn-primary w-full max-w-[200px] mt-4"
                  onClick={() => {
                    setSelectedMedia({
                      mediaId: media.mediaId || '',
                      mediaType: media.mediaType,
                      title: media.title,
                    });
                    setLogModalOpen(true);
                  }}
                >
                  <MdCreate className="mr-2" />
                  Quick Log
                </button>
              )}
            </div>

            {/* Media Info */}
            <div className="py-4 md:py-5 md:px-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="badge badge-primary badge-lg capitalize">
                  {media.mediaType}
                </span>
                <span
                  className={`badge badge-lg ${media.isActive ? 'badge-success' : 'badge-outline'}`}
                >
                  {media.isActive ? 'Active' : 'Completed'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-bold mb-4">
                {media.title}
              </h1>

              <p className="text-base-content/90 text-lg mb-6">
                {club.name} • Added by {media.addedBy.username}
              </p>

              {media.description && (
                <div className="mb-6">
                  <p className="text-base-content/80 whitespace-pre-wrap">
                    {media.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-base-content/70">
                <div className="flex items-center gap-2">
                  <MdCalendarToday className="text-base" />
                  <span>
                    Start: {new Date(media.startDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MdCalendarToday className="text-base" />
                  <span>
                    End: {new Date(media.endDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ClubMediaNavbar clubId={clubId!} mediaId={mediaId!} />

      {/* Outlet for the content */}
      <Outlet
        context={
          {
            club,
            clubMedia: media,
            clubMediaData,
            clubMediaError,
            user,
          } satisfies OutletClubMediaContextType
        }
      />

      {/* Quick Log Modal */}
      {selectedMedia && (
        <QuickLog
          open={logModalOpen}
          onClose={() => setLogModalOpen(false)}
          media={{
            contentId: selectedMedia.mediaId,
            title: {
              contentTitleNative: selectedMedia.title,
              contentTitleRomaji: selectedMedia.title,
              contentTitleEnglish: selectedMedia.title,
            },
            type: selectedMedia.mediaType as
              | 'anime'
              | 'manga'
              | 'reading'
              | 'vn'
              | 'video'
              | 'movie',
            contentImage: undefined, // Let QuickLog handle image loading
            isAdult: false,
          }}
        />
      )}
    </div>
  );
}
