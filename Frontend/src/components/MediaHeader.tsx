import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { getAverageColorFn, getMediaFn } from '../api/trackerApi';
import { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { MdPlayArrow, MdBook, MdMovie } from 'react-icons/md';
import { toast } from 'react-toastify';
import { IMediaDocument, OutletMediaContextType } from '../types';
import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { convertBBCodeToHtml } from '../utils/utils';
import QuickLog from '../components/QuickLog';
import { useUserDataStore } from '../store/userData';
import MediaNavbar from './MediaNavbar';

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

export default function MediaHeader() {
  const { mediaType, mediaId, username } = useParams<{
    mediaType: IMediaDocument['type'] | undefined;
    mediaId: string;
    username?: string;
  }>();

  const { user } = useUserDataStore();

  const navigate = useNavigate();
  const [averageColor, setAverageColor] = useState<string>('#ffffff');
  const [logModalOpen, setLogModalOpen] = useState(false);

  // Reset scroll when navigating to a new media
  useEffect(() => {
    if (mediaId && mediaType) {
      // Add class to ensure auto scroll behavior
      document.documentElement.classList.add('scroll-reset');

      // Use multiple methods to ensure scroll reset works across browsers
      const resetScroll = () => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };

      // Reset immediately
      resetScroll();

      // Also reset after a small delay in case of layout shifts
      const timeoutId = setTimeout(() => {
        resetScroll();
        // Remove the class after scroll is complete
        document.documentElement.classList.remove('scroll-reset');
      }, 10);

      return () => {
        clearTimeout(timeoutId);
        document.documentElement.classList.remove('scroll-reset');
      };
    }
  }, [mediaId, mediaType]);

  const {
    data: media,
    error: mediaError,
    isLoading: isLoadingMedia,
  } = useQuery({
    queryKey: ['media', mediaId, mediaType],
    queryFn: () => {
      if (!mediaId || !mediaType) {
        throw new Error('Media ID and type are required');
      }
      return getMediaFn(mediaId, mediaType);
    },
    enabled: !!mediaId && !!mediaType,
    refetchOnMount: 'always',
  });

  // Additional scroll reset when MediaHeader loading completes
  useEffect(() => {
    if (!isLoadingMedia && media) {
      const timeoutId = setTimeout(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 100); // Slightly longer delay to ensure skeleton content is replaced

      return () => clearTimeout(timeoutId);
    }
  }, [isLoadingMedia, media]);

  if (mediaError) {
    if (mediaError instanceof AxiosError) {
      if (mediaError.status === 404) navigate('/404', { replace: true });
      toast.error(mediaError.response?.data.message);
    } else {
      toast.error(
        mediaError.message ? mediaError.message : 'An error occurred'
      );
    }
  }

  const renderDescription = (description: string) => {
    // First check if it contains BBCode tags
    if (/\[(b|i|u|s|url|img|spoiler|quote|code|list|\*)\b/i.test(description)) {
      const htmlFromBBCode = convertBBCodeToHtml(description);

      const sanitizedDescription = DOMPurify.sanitize(
        htmlFromBBCode.replace(/<br\s*\/?>/gi, '<br />')
      );
      return <div dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />;
    }

    if (!/<[a-z][\s\S]*>/i.test(description)) {
      return description.split('\n').map((line, index) => (
        <p key={index}>
          {line}
          <br />
        </p>
      ));
    }

    // Render HTML safely
    const sanitizedDescription = DOMPurify.sanitize(
      description.replace(/<br\s*\/?>/gi, '<br />')
    );
    return <div dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />;
  };

  useEffect(() => {
    if (
      mediaType !== 'anime' &&
      mediaType !== 'manga' &&
      mediaType !== 'vn' &&
      mediaType !== 'video' &&
      mediaType !== 'reading' &&
      mediaType !== 'movie' &&
      mediaType !== 'tv show'
    ) {
      navigate('/404');
    }
  }, [mediaType, navigate, media]);

  useEffect(() => {
    async function getAvgColor() {
      if (media?.contentImage) {
        const color = await getAverageColorFn(media?.contentImage);
        if (color) {
          return setAverageColor(color.hex);
        }
        setAverageColor('#ffffff');
      }
    }

    void getAvgColor();
  }, [media]);

  return (
    <div className="flex flex-col justify-center bg-base-200 text-base-content">
      <QuickLog
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        media={media}
      />
      <div
        className={`h-48 sm:h-64 md:h-96 w-full bg-cover bg-center bg-no-repeat ${
          isLoadingMedia ? 'skeleton' : ''
        }`}
        style={{
          backgroundImage: `url(${!isLoadingMedia ? media?.coverImage : ''})`,
          backgroundColor: averageColor,
        }}
      >
        {media?.coverImage ? (
          <div className="flex flex-col justify-end size-full bg-linear-to-t from-shadow/[0.6] to-40% bg-cover" />
        ) : (
          <></>
        )}
      </div>

      <div className="min-h-12 bg-base-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] lg:grid-cols-[215px_1fr] gap-6">
            <div className="flex flex-col items-center md:items-start">
              <div className="w-full max-w-[200px] md:w-full -mt-16 sm:-mt-24 md:-mt-32">
                {isLoadingMedia ? (
                  <div className="w-full aspect-[2/3] rounded-lg shadow-xl border-2 border-white/20 skeleton"></div>
                ) : media?.contentImage ? (
                  <img
                    src={media.contentImage}
                    alt={media.title.contentTitleNative}
                    className="w-full h-auto rounded-lg shadow-xl border-2 border-white/20"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full aspect-[2/3] rounded-lg shadow-xl border-2 border-white/20 bg-base-200 flex items-center justify-center">
                    <div className="text-4xl text-base-content/30">
                      {getMediaTypeIcon(media?.type || '')}
                    </div>
                  </div>
                )}
              </div>
              {isLoadingMedia ? (
                <div className="skeleton h-12 w-full max-w-[200px] mt-4 rounded-lg"></div>
              ) : (
                <button
                  className="btn btn-primary w-full max-w-[200px] mt-4"
                  onClick={() => setLogModalOpen(true)}
                >
                  Log
                </button>
              )}
            </div>
            <div className="py-4 px-0 md:py-5 md:px-4">
              {isLoadingMedia ? (
                <div className="space-y-4">
                  <div className="skeleton h-8 w-3/4"></div>
                  <div className="space-y-2">
                    <div className="skeleton h-4 w-full"></div>
                    <div className="skeleton h-4 w-full"></div>
                    <div className="skeleton h-4 w-full"></div>
                    <div className="skeleton h-4 w-2/3"></div>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-xl sm:text-2xl font-bold text-base-content">
                    {media?.title?.contentTitleNative}
                  </h1>
                  <div className="text-base-content text-opacity-75 mt-4 text-sm sm:text-base">
                    {(() => {
                      const engDescription = media?.description?.filter(
                        (desc) => desc.language === 'eng'
                      )[0];
                      if (engDescription?.description) {
                        return renderDescription(engDescription.description);
                      }
                      const jpnDescription = media?.description?.filter(
                        (desc) => desc.language === 'jpn'
                      )[0];
                      if (jpnDescription?.description) {
                        return renderDescription(jpnDescription.description);
                      }
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <MediaNavbar
        mediaType={mediaType}
        mediaId={mediaId as string}
        username={username || user?.username}
      />
      <Outlet
        context={
          {
            mediaDocument: media,
            mediaType,
            username: username || user?.username,
          } satisfies OutletMediaContextType
        }
      />
    </div>
  );
}
