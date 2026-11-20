import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  Film,
  Flame,
  Flag,
  Gamepad2,
  Headphones,
  Heart,
  MessageCircle,
  Pencil,
  Trash2,
  Tv,
  Video,
  Star,
  Target,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  removeActivityReactionFn,
  setActivityReactionFn,
} from "../../api/activitiesApi";
import { deletePostFn } from "../../api/postsApi";
import {
  ActivityReactionType,
  IPostActivityMetadata,
  IPostDecoration,
  IPostImage,
  ISocialActivity,
} from "../../types";
import { renderMarkdownWithSpoilers } from "../../utils/markdown";
import MarkdownContent from "../ui/MarkdownContent";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import PostComposer from "./PostComposer";
import PostImages from "./PostImages";
import {
  backgroundLayerStyle,
  borderFrameStyle,
  hasPostDecoration,
} from "../../utils/postDecoration";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatRelativeDateInTimezone } from "../../utils/timezone";
import { getMediaTypeClasses } from "../../constants/mediaColors";
import { getLogTypeLabelKey } from "../../utils/logTypes";
import UserAvatar from "../UserAvatar";
import ActivityComments from "./ActivityComments";
import { useUserDataStore } from "../../store/userData";
import { useDateFormatting } from "../../hooks/useDateFormatting";

interface ActivityCardProps {
  activity: ISocialActivity;
  highlighted?: boolean;
  surface?: 'muted' | 'default';
}

const ACTIVITY_SURFACE_CLASSES = {
  muted: 'surface-muted',
  default: 'surface',
} as const;

interface ExpandableActivityTextProps {
  text: string;
  readMoreLabel: string;
  showLessLabel: string;
  onExpandedChange?: (expanded: boolean) => void;
}

const ACTIVITY_TEXT_PREVIEW_HEIGHT = 96;

function ExpandableActivityText({
  text,
  readMoreLabel,
  showLessLabel,
  onExpandedChange,
}: ExpandableActivityTextProps) {
  const contentRef = useRef<HTMLParagraphElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
    onExpandedChange?.(false);
    const content = contentRef.current;
    if (!content) return;

    const updateCanExpand = () => {
      setCanExpand(content.scrollHeight > ACTIVITY_TEXT_PREVIEW_HEIGHT + 1);
    };

    updateCanExpand();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateCanExpand);
    observer.observe(content);
    return () => observer.disconnect();
  }, [onExpandedChange, text]);

  const isCollapsed = canExpand && !isExpanded;

  return (
    <div className="mt-2">
      <div className="relative">
        <p
          ref={contentRef}
          className={
            isCollapsed
              ? "max-h-24 overflow-hidden whitespace-pre-wrap text-sm text-base-content/80"
              : "whitespace-pre-wrap text-sm text-base-content/80"
          }
        >
          {text}
        </p>
        {isCollapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-base-200 to-transparent" />
        )}
      </div>
      {canExpand && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            className="btn btn-link btn-sm h-auto min-h-0 px-0 text-primary"
            aria-expanded={isExpanded}
            onClick={() =>
              setIsExpanded((expanded) => {
                const nextExpanded = !expanded;
                onExpandedChange?.(nextExpanded);
                return nextExpanded;
              })
            }
          >
            {isExpanded ? showLessLabel : readMoreLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function metadataString(activity: ISocialActivity, key: string): string {
  const value = activity.metadata?.[key];
  return typeof value === "string" ? value : "";
}

function postMetadata(activity: ISocialActivity): IPostActivityMetadata | null {
  if (activity.type !== "post" || !activity.metadata) return null;
  const metadata = activity.metadata;
  const images = Array.isArray(metadata.images)
    ? (metadata.images as IPostImage[])
    : [];
  return {
    postId: typeof metadata.postId === "string" ? metadata.postId : activity.targetId,
    content: typeof metadata.content === "string" ? metadata.content : "",
    sensitive: metadata.sensitive === true,
    editedAt: typeof metadata.editedAt === "string" ? metadata.editedAt : null,
    decoration: hasPostDecoration(
      metadata.decoration as IPostDecoration | null | undefined,
    )
      ? (metadata.decoration as IPostDecoration)
      : null,
    images,
  };
}

function metadataNumber(activity: ISocialActivity, key: string): number {
  const value = activity.metadata?.[key];
  return typeof value === "number" ? value : 0;
}

const LOG_TYPE_ICONS: Record<string, typeof BookOpen> = {
  anime: Tv,
  audio: Headphones,
  book: BookOpen,
  game: Gamepad2,
  manga: BookOpen,
  movie: Film,
  reading: BookOpen,
  "light-novel": BookOpen,
  "tv show": Tv,
  video: Video,
  vn: Gamepad2,
};

function mediaPath(activity: ISocialActivity): string | null {
  const mediaType =
    metadataString(activity, "mediaType") || activity.targetType;
  const mediaId = metadataString(activity, "mediaId") || activity.targetId;
  const supportedMediaTypes = new Set([
    "anime",
    "manga",
    "light-novel",
    "vn",
    "video",
    "movie",
    "tv show",
    "game",
    "book",
  ]);
  if (!supportedMediaTypes.has(mediaType)) return null;
  return mediaType && mediaId
    ? `/${encodeURIComponent(mediaType)}/${encodeURIComponent(mediaId)}`
    : null;
}

export default function ActivityCard({
  activity,
  highlighted = false,
  surface = 'muted',
}: ActivityCardProps) {
  const { t } = useTranslation("social");
  const { t: tCommon } = useTranslation("common");
  const { formatDateTime } = useDateFormatting();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUserDataStore();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const post = postMetadata(activity);
  const frameStyle = post?.decoration
    ? borderFrameStyle(post.decoration.border)
    : null;
  const backgroundStyle = post?.decoration
    ? backgroundLayerStyle(post.decoration.background)
    : null;
  const isOwnActivity = currentUser?._id === activity.actor._id;
  const canModerate = Boolean(
    currentUser?.roles?.includes("admin") || currentUser?.roles?.includes("mod"),
  );
  const deletePostMutation = useMutation({
    mutationFn: () => deletePostFn(post?.postId ?? activity.targetId),
    onSuccess: async () => {
      setConfirmingDelete(false);
      toast.success(t("posts.deleted"));
      await queryClient.invalidateQueries({ queryKey: ["socialActivities"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const handleDescriptionExpandedChange = useCallback(
    (expanded: boolean) => setDescriptionExpanded(expanded),
    [],
  );
  const reactionMutation = useMutation({
    mutationFn: async (type: ActivityReactionType) => {
      if (activity.currentReaction === type) {
        await removeActivityReactionFn(activity._id);
        return;
      }

      await setActivityReactionFn(activity._id, type);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["socialActivities"] }),
        queryClient.invalidateQueries({ queryKey: ["mediaCommunity"] }),
      ]);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const mediaTitle = metadataString(activity, "mediaTitle");
  const summary = metadataString(activity, "summary");
  const description = metadataString(activity, "description");
  const clubName = metadataString(activity, "clubName");
  const achievementName = metadataString(activity, "name");
  const challengeTitle = metadataString(activity, "challengeTitle");
  const goalTitle = metadataString(activity, "goalTitle");
  const mediaImage = metadataString(activity, "mediaImage");
  const mediaType =
    metadataString(activity, "mediaType") || activity.targetType;
  const linkedMediaPath = mediaPath(activity);
  const isImmersionActivity =
    activity.type === "immersion_log" ||
    activity.type === "notable_immersion_session";
  const descriptionAsSubject =
    isImmersionActivity && !linkedMediaPath ? description : "";
  const logType = metadataString(activity, "logType").toLowerCase();
  const activityType = (logType || mediaType).toLowerCase() || "other";
  const typeClasses = getMediaTypeClasses(activityType);
  const typeLabelKey = getLogTypeLabelKey(activityType);
  const typeLabel = typeLabelKey ? tCommon(typeLabelKey) : "";
  const hasLogType = isImmersionActivity && Boolean(typeLabel);
  const consumptionAction = logType.includes("audio")
    ? t("activity.listened")
    : ["anime", "video", "movie", "tv show"].includes(logType)
      ? t("activity.watched")
      : activityType === "game"
        ? t("activity.played")
        : t("activity.read");
  const metricParts = [
    metadataNumber(activity, "time")
      ? t("metrics.minutes", { count: metadataNumber(activity, "time") })
      : "",
    metadataNumber(activity, "chars")
      ? t("metrics.characters", { count: metadataNumber(activity, "chars") })
      : "",
    metadataNumber(activity, "pages")
      ? t("metrics.pages", { count: metadataNumber(activity, "pages") })
      : "",
    metadataNumber(activity, "episodes")
      ? t("metrics.episodes", { count: metadataNumber(activity, "episodes") })
      : "",
  ].filter(Boolean);

  const activityCopy = (() => {
    switch (activity.type) {
      case "immersion_log":
      case "notable_immersion_session":
        return {
          Icon:
            activity.type === "notable_immersion_session"
              ? Flame
              : (LOG_TYPE_ICONS[logType] ?? BookOpen),
          action:
            activity.type === "notable_immersion_session"
              ? t("activity.notableSession")
              : consumptionAction,
          subject: linkedMediaPath
            ? mediaTitle
            : descriptionAsSubject || mediaTitle,
        };
      case "achievement_unlocked":
        return {
          Icon: Award,
          action: t("activity.achievement"),
          subject: achievementName,
        };
      case "media_review":
        return { Icon: Star, action: t("activity.review"), subject: summary };
      case "club_joined":
        return {
          Icon: Users,
          action: t("activity.clubJoined"),
          subject: clubName,
        };
      case "club_milestone":
        return {
          Icon: Users,
          action: t("activity.clubMilestone", {
            count: metadataNumber(activity, "memberCount"),
          }),
          subject: clubName,
        };
      case "club_challenge_started":
        return {
          Icon: Flag,
          action: t("activity.challengeStarted"),
          subject: challengeTitle,
        };
      case "challenge_joined":
        return {
          Icon: Flag,
          action: t("activity.challengeJoined"),
          subject: challengeTitle,
        };
      case "challenge_completed":
        return {
          Icon: Award,
          action: t("activity.challengeCompleted"),
          subject: challengeTitle,
        };
      case "duel_won":
        return {
          Icon: Award,
          action: t("activity.duelWon"),
          subject: metadataString(activity, "opponentUsername"),
        };
      case "cooperative_goal_progress":
        return {
          Icon: Target,
          action: t("activity.goalProgress"),
          subject: goalTitle,
        };
      case "cooperative_goal_completed":
        return {
          Icon: Award,
          action: t("activity.goalCompleted"),
          subject: goalTitle,
        };
      case "post":
        return { Icon: MessageCircle, action: "", subject: "" };
      default:
        return { Icon: BookOpen, action: t("activity.generic"), subject: "" };
    }
  })();
  const { Icon } = activityCopy;
  const shouldBlurMedia =
    Boolean(currentUser?.settings?.blurAdultContent ?? true) &&
    (mediaType === "vn"
      ? Boolean(activity.metadata?.isAdultImage)
      : Boolean(activity.metadata?.isAdult));
  const hasMediaCover = Boolean(mediaImage && linkedMediaPath && !post);
  const expandedWithMedia = descriptionExpanded && hasMediaCover;
  const commentsId = `activity-${activity._id}-comments`;
  const showCommentsButton = activity.commentCount > 0 || activity.canComment !== false;

  const renderMediaCover = (className: string) =>
    mediaImage && linkedMediaPath ? (
      <Link
        to={linkedMediaPath}
        className={className}
        aria-label={mediaTitle || activityCopy.subject}
      >
        <img
          src={mediaImage}
          alt={mediaTitle || activityCopy.subject}
          loading="lazy"
          className={`h-full w-full object-cover ${
            shouldBlurMedia ? "blur-md" : ""
          }`}
        />
      </Link>
    ) : null;

  return (
    <div className="space-y-3">
      <div
        className={frameStyle ? "rounded-box" : "contents"}
        style={frameStyle ?? undefined}
      >
      <article
        id={`activity-${activity._id}`}
        className={`card card-sm ${ACTIVITY_SURFACE_CLASSES[surface]} relative shadow-sm overflow-visible transition-shadow duration-300 hover:shadow-lg ${highlighted ? "ring-2 ring-primary" : ""}`}
      >
        {backgroundStyle && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-box"
            style={backgroundStyle}
          />
        )}
        <div
          className={
            expandedWithMedia
              ? "relative flow-root"
              : hasMediaCover
                ? "relative grid min-h-36 grid-cols-[5.75rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_minmax(0,1fr)]"
                : "relative"
          }
        >
          {!expandedWithMedia &&
            renderMediaCover(
              "relative min-h-36 overflow-hidden rounded-l-box bg-base-300",
            )}

          <div
            className={
              expandedWithMedia
                ? "flow-root min-w-0 p-3 sm:p-4"
                : "card-body min-w-0 gap-0 p-3 sm:p-4"
            }
          >
            {expandedWithMedia &&
              renderMediaCover(
                "float-left mb-3 mr-4 h-56 w-28 overflow-hidden rounded-box bg-base-300 ring-1 ring-base-content/10 sm:h-64 sm:w-36",
              )}
            <header className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {!hasMediaCover && (
                  <Link
                    to={`/user/${encodeURIComponent(activity.actor.username)}`}
                    className="shrink-0"
                  >
                    <div className="avatar">
                      <UserAvatar
                        username={activity.actor.username}
                        avatar={activity.actor.avatar}
                        containerClassName="h-8 w-8 overflow-hidden rounded-full"
                        imageClassName="h-full w-full object-cover"
                        fallbackClassName="flex h-full w-full items-center justify-center bg-base-300"
                        textClassName="text-xs font-semibold"
                      />
                    </div>
                  </Link>
                )}
                <Link
                  to={`/user/${encodeURIComponent(activity.actor.username)}`}
                  className="link link-hover min-w-0 truncate text-sm font-semibold text-primary"
                >
                  {activity.actor.username}
                </Link>
              </div>
              <div
                className="tooltip tooltip-left md:tooltip-top shrink-0"
                data-tip={formatDateTime(activity.occurredAt)}
              >
                <time
                  dateTime={activity.occurredAt}
                  className="cursor-help text-xs text-base-content/70"
                >
                  {formatRelativeDateInTimezone(activity.occurredAt)}
                </time>
              </div>
            </header>

            {post ? (
              <>
                {post.content && (
                  <MarkdownContent
                    className="prose prose-sm mt-2 max-w-none break-words text-base-content/90"
                    html={renderMarkdownWithSpoilers(post.content, {
                      allowImages: false,
                    })}
                  />
                )}
                <PostImages
                  images={post.images}
                  username={activity.actor.username}
                  sensitive={post.sensitive}
                />
              </>
            ) : (
            <div className="mt-2 flex min-w-0 items-start gap-2 text-sm leading-relaxed">
              {!hasMediaCover && (
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${hasLogType ? typeClasses.color : "text-primary"}`}
                />
              )}
              <p className="min-w-0 break-words">
                <span className="text-base-content/70">
                  {activityCopy.action}
                </span>
                {activityCopy.subject && (
                  <>
                    {" "}
                    {linkedMediaPath ? (
                      <Link
                        to={linkedMediaPath}
                        className="link link-hover font-medium text-primary"
                      >
                        {activityCopy.subject}
                      </Link>
                    ) : (
                      <span className="font-medium">
                        {activityCopy.subject}
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
            )}

            {!post && description && description !== activityCopy.subject && (
              <ExpandableActivityText
                text={description}
                readMoreLabel={t("activity.readMore")}
                showLessLabel={t("activity.showLess")}
                onExpandedChange={handleDescriptionExpandedChange}
              />
            )}

            <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {hasLogType && (
                  <span
                    className={`badge badge-soft badge-sm gap-1 ${typeClasses.bgColor} ${typeClasses.color}`}
                  >
                    {typeLabel}
                  </span>
                )}
                {activity.importance === "important" && (
                  <span className="badge badge-soft badge-warning badge-sm gap-1">
                    <Star className="h-3 w-3" />
                    {t("activity.notable")}
                  </span>
                )}
                {metricParts.length > 0 && (
                  <span className="text-xs text-base-content/70">
                    {metricParts.join(" · ")}
                  </span>
                )}
                {post?.editedAt && (
                  <span className="text-xs text-base-content/50">
                    {t("posts.edited")}
                  </span>
                )}
              </div>

              <div className="card-actions ml-auto items-center gap-0">
                {post && isOwnActivity && (
                  <Button
                    appearance="ghost"
                    size="sm"
                    shape="square"
                    className="text-base-content/60"
                    aria-label={t("posts.edit")}
                    title={t("posts.edit")}
                    onClick={() => setEditingPost(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {post && (isOwnActivity || canModerate) && (
                  <Button
                    appearance="ghost"
                    size="sm"
                    shape="square"
                    className="text-base-content/60"
                    aria-label={t("posts.delete")}
                    title={t("posts.delete")}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {showCommentsButton && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm gap-1 px-2 text-base-content/70"
                    aria-controls={commentsId}
                    aria-expanded={commentsOpen}
                    disabled={!currentUser}
                    onClick={() => setCommentsOpen((open) => !open)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    {activity.commentCount > 0 && (
                      <span>{activity.commentCount}</span>
                    )}
                    <span className="sr-only">{t("comments.show")}</span>
                  </button>
                )}
                <button
                  type="button"
                  className={
                    activity.currentReaction === "like"
                      ? "btn btn-primary btn-sm gap-1 px-2"
                      : "btn btn-ghost btn-sm gap-1 px-2 text-base-content/70"
                  }
                  aria-label={t("reactions.like")}
                  aria-pressed={activity.currentReaction === "like"}
                  title={t("reactions.like")}
                  disabled={reactionMutation.isPending || !currentUser}
                  onClick={() => reactionMutation.mutate("like")}
                >
                  <Heart
                    className="h-4 w-4"
                    fill={
                      activity.currentReaction === "like"
                        ? "currentColor"
                        : "none"
                    }
                  />
                  {(activity.reactionCounts.like ?? 0) > 0 && (
                    <span>{activity.reactionCounts.like}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
      </div>

      {commentsOpen && (
        <div id={commentsId} className="pl-3 sm:pl-6">
          <ActivityComments activityId={activity._id} />
        </div>
      )}

      {post && editingPost && (
        <Modal
          open
          size="lg"
          title={t("posts.editTitle")}
          onClose={() => setEditingPost(false)}
        >
          <PostComposer
            post={{ ...post, visibility: activity.visibility }}
            onDone={() => setEditingPost(false)}
            onCancel={() => setEditingPost(false)}
          />
        </Modal>
      )}

      {post && (
        <Modal
          open={confirmingDelete}
          size="sm"
          title={t("posts.deleteTitle")}
          onClose={() => setConfirmingDelete(false)}
          actions={
            <>
              <Button
                appearance="ghost"
                onClick={() => setConfirmingDelete(false)}
              >
                {t("posts.cancel")}
              </Button>
              <Button
                variant="error"
                loading={deletePostMutation.isPending}
                onClick={() => deletePostMutation.mutate()}
              >
                {t("posts.deleteConfirm")}
              </Button>
            </>
          }
        >
          <p className="text-sm text-base-content/70">{t("posts.deleteBody")}</p>
        </Modal>
      )}
    </div>
  );
}
