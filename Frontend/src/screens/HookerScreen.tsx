import type { ChangeEvent, CSSProperties, ReactNode } from 'react';
import { useCallback, useRef, useState, useEffect, Fragment } from 'react';
import {
  useLocation,
  useParams,
  useSearchParams,
  Link as RouterLink,
} from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTextSessionFn,
  addLinesToSessionFn,
  removeLinesFromSessionFn,
  clearSessionLinesFn,
  addSessionHistoryEntryFn,
  createLogFn,
  getMediaFn,
  getUserMediaStatsFn,
  updateSessionTimerFn,
} from '../api/trackerApi';
import {
  Settings,
  Play,
  Pause,
  Trash2,
  Users,
  Crown,
  X,
  Monitor,
  Clock,
  Activity,
  BarChart2,
  Copy,
  Link,
  Unlink,
  Save,
  Share2,
  Home,
  Type,
  FileText,
  RotateCcw,
  Edit3,
  HelpCircle,
} from 'lucide-react';
import useMutationObserver from '../hooks/useMutationObserver';
import { io, Socket } from 'socket.io-client';
import { numberWithCommas } from '../utils/utils';
import { IMediaDocument, ITextSession } from '../types';
import { toast, ToastContainer } from 'react-toastify';
import QuickLog, { QuickLogInitialValues } from '../components/QuickLog';
import { useUserDataStore } from '../store/userData';

type LineEntry = {
  id: string;
  text: string;
  japaneseCount: number;
};

type Member = {
  id: string;
  role: 'host' | 'guest';
  username?: string;
  userId?: string;
};

const JAPANESE_CHAR_REGEX =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;

const HOOKER_THEME_OPTIONS = [
  { value: '', label: 'Use app theme' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'cupcake', label: 'Cupcake' },
  { value: 'bumblebee', label: 'Bumblebee' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'retro', label: 'Retro' },
  { value: 'garden', label: 'Garden' },
  { value: 'forest', label: 'Forest' },
  { value: 'winter', label: 'Winter' },
  { value: 'sunset', label: 'Sunset' },
] as const;

function countJapaneseCharacters(value: string) {
  return (value.match(JAPANESE_CHAR_REGEX) ?? []).length;
}

function createLineId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function TextHooker() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { contentId: paramContentId, mediaId } = useParams<{
    contentId: string;
    mediaId: string;
  }>();
  const contentId = paramContentId || mediaId;
  const queryClient = useQueryClient();
  const user = useUserDataStore((state) => state.user);
  const hasPatreonAccess =
    (user?.patreon?.isActive && user?.patreon?.tier) ||
    user?.roles?.includes('admin');
  const availableHookerThemes = hasPatreonAccess
    ? HOOKER_THEME_OPTIONS
    : HOOKER_THEME_OPTIONS.filter(
        (themeOption) =>
          themeOption.value === 'light' || themeOption.value === 'dark'
      );
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogDefaults, setQuickLogDefaults] =
    useState<QuickLogInitialValues | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [lines, setLines] = useState<LineEntry[]>([]);
  const [vertical, setVertical] = useState(() => {
    return localStorage.getItem('texthooker_vertical') === 'true';
  });
  const [lineSpacing, setLineSpacing] = useState(() => {
    const saved = localStorage.getItem('texthooker_lineSpacing');
    return saved ? Number(saved) : 1.5;
  });
  const [lineGap, setLineGap] = useState(() => {
    const saved = localStorage.getItem('texthooker_lineGap');
    return saved ? Number(saved) : 16;
  });
  const [showTopbarTimer, setShowTopbarTimer] = useState(() => {
    const saved = localStorage.getItem('texthooker_showTopbarTimer');
    return saved === null ? true : saved === 'true';
  });
  const [showTopbarReadingSpeed, setShowTopbarReadingSpeed] = useState(() => {
    const saved = localStorage.getItem('texthooker_showTopbarReadingSpeed');
    return saved === null ? true : saved === 'true';
  });
  const [showTopbarCharacters, setShowTopbarCharacters] = useState(() => {
    const saved = localStorage.getItem('texthooker_showTopbarCharacters');
    return saved === null ? true : saved === 'true';
  });
  const [showTopbarLines, setShowTopbarLines] = useState(() => {
    const saved = localStorage.getItem('texthooker_showTopbarLines');
    return saved === null ? true : saved === 'true';
  });
  const [hookerTheme, setHookerTheme] = useState(() => {
    return localStorage.getItem('texthooker_theme') || '';
  });
  const [lineMarginBlock] = useState(0);
  const [lineMarginInline] = useState(0);
  const [mode, setMode] = useState<'local' | 'host' | 'guest'>('local');
  const [roomId, setRoomId] = useState<string>('');
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [isRoomConnected, setIsRoomConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const roomSocketRef = useRef<Socket | null>(null);
  const [connectedMembers, setConnectedMembers] = useState<Member[]>([]);

  const sortedMembers = (() => {
    if (!connectedMembers || connectedMembers.length === 0)
      return connectedMembers;
    const host = connectedMembers.find((m) => m.role === 'host');
    if (!host) return connectedMembers;
    return [host, ...connectedMembers.filter((m) => m.id !== host.id)];
  })();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [isTimerEditOpen, setIsTimerEditOpen] = useState(false);
  const [isResetTimerConfirmOpen, setIsResetTimerConfirmOpen] = useState(false);
  const [isPreventDuplicateConfirmOpen, setIsPreventDuplicateConfirmOpen] =
    useState(false);
  const [isResumePromptOpen, setIsResumePromptOpen] = useState(false);
  const [resumePromptHandled, setResumePromptHandled] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'display' | 'behavior'
  >('display');
  const [customCss, setCustomCss] = useState(() => {
    return localStorage.getItem('texthooker_customCss') || '';
  });
  const [isClassHelpOpen, setIsClassHelpOpen] = useState(false);
  const settingsPanelRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [timerEditHours, setTimerEditHours] = useState(0);
  const [timerEditMinutes, setTimerEditMinutes] = useState(0);
  const [timerEditSeconds, setTimerEditSeconds] = useState(0);
  const initialStatsRef = useRef({ lines: 0, chars: 0 });
  const inviteAppliedRef = useRef(false);
  const [isLogAnimating, setIsLogAnimating] = useState(false);
  const [animatedChars, setAnimatedChars] = useState(0);
  const [targetChars, setTargetChars] = useState(0);

  const { data: sessionData } = useQuery({
    queryKey: ['textSession', contentId],
    queryFn: () => getTextSessionFn(contentId!),
    enabled: !!contentId,
  });

  const media =
    typeof sessionData?.mediaId === 'object'
      ? (sessionData.mediaId as IMediaDocument)
      : null;

  const inviteRoomFromParams = searchParams.get('roomId');
  const inviteModeFromParams = searchParams.get('mode');

  useEffect(() => {
    if (inviteAppliedRef.current) return;
    if (inviteRoomFromParams && inviteModeFromParams) {
      inviteAppliedRef.current = true;
      setMode(inviteModeFromParams as 'host' | 'guest');
      setRoomId(inviteRoomFromParams);
      setIsRoomConnected(true);
    }
  }, [
    inviteRoomFromParams,
    inviteModeFromParams,
    setMode,
    setRoomId,
    setIsRoomConnected,
  ]);

  const { data: fullMediaData } = useQuery({
    queryKey: ['media', media?.contentId, media?.type],
    queryFn: () => getMediaFn(media!.contentId, media!.type),
    enabled: !!media && isStatsOpen,
  });

  const { data: userMediaStats } = useQuery({
    queryKey: ['userMediaStats', media?.contentId, media?.type],
    queryFn: () => getUserMediaStatsFn(media!.contentId, media!.type),
    enabled: !!media && isStatsOpen,
  });

  const previouslyLoggedChars = userMediaStats?.total?.characters || 0;

  const { mutate: saveLines } = useMutation({
    mutationFn: (newLines: LineEntry[]) => {
      const linesToSave = newLines.map((l) => ({
        id: l.id,
        text: l.text,
        charsCount: l.japaneseCount,
        createdAt: new Date().toISOString(),
      }));
      return addLinesToSessionFn(contentId!, linesToSave);
    },
  });

  useEffect(() => {
    if (roomId) {
      const saved = localStorage.getItem(`hostToken_${roomId}`);
      if (saved) setHostToken(saved);
      else setHostToken(null);
    }
  }, [roomId]);

  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('texthooker_fontSize');
    return saved ? Number(saved) : 24;
  });
  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem('texthooker_fontFamily') || 'Noto Sans JP';
  });
  const [autoPauseTimeout, setAutoPauseTimeout] = useState(() => {
    const saved = localStorage.getItem('texthooker_autoPauseTimeout');
    return saved ? Number(saved) : 120;
  });
  const [autostartTimerByPaste, setAutostartTimerByPaste] = useState(() => {
    return localStorage.getItem('texthooker_autostartTimerByPaste') === 'true';
  });
  const [autostartTimerByLine, setAutostartTimerByLine] = useState(() => {
    return localStorage.getItem('texthooker_autostartTimerByLine') === 'true';
  });
  const [allowNewLineDuringPause, setAllowNewLineDuringPause] = useState(() => {
    const saved = localStorage.getItem('texthooker_allowNewLineDuringPause');
    return saved === null ? true : saved === 'true';
  });
  const [allowPasteDuringPause, setAllowPasteDuringPause] = useState(() => {
    const saved = localStorage.getItem('texthooker_allowPasteDuringPause');
    return saved === null ? true : saved === 'true';
  });
  const [continuousReconnect, setContinuousReconnect] = useState(() => {
    return localStorage.getItem('texthooker_continuousReconnect') === 'true';
  });
  const [preventGlobalDuplicates, setPreventGlobalDuplicates] = useState(() => {
    return (
      localStorage.getItem('texthooker_preventGlobalDuplicates') === 'true'
    );
  });

  useEffect(() => {
    if (sessionData?.lines) {
      const mappedLines = sessionData.lines.map((l) => ({
        id: l.id,
        text: l.text,
        japaneseCount: l.charsCount,
      }));

      if (!preventGlobalDuplicates) {
        setLines(mappedLines);
        return;
      }

      const seenTexts = new Set<string>();
      const duplicateIds: string[] = [];
      const dedupedLines = mappedLines.filter((line) => {
        const normalized = line.text.trim();
        if (seenTexts.has(normalized)) {
          duplicateIds.push(line.id);
          return false;
        }
        seenTexts.add(normalized);
        return true;
      });

      setLines(dedupedLines);

      if (contentId && duplicateIds.length > 0) {
        removeLinesFromSessionFn(contentId, duplicateIds).catch(console.error);
      }
    }
  }, [sessionData, preventGlobalDuplicates, contentId]);

  const [websocketUrl, setWebsocketUrl] = useState(() => {
    return (
      localStorage.getItem('texthooker_websocketUrl') || 'ws://localhost:6677'
    );
  });
  const reconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const socketRef = useRef<WebSocket | null>(null);

  const lastActivityRef = useRef(Date.now());
  const timerInitializedFromServerRef = useRef(false);
  const lastSavedTimerRef = useRef<number>(0);
  const pendingHistoryEntryRef = useRef<{
    isShared: boolean;
    connectedUsersCount: number;
    charactersLogged: number;
    readingSpeed: number;
    sessionSeconds: number;
  } | null>(null);

  const timerKey = contentId || inviteRoomFromParams || roomId || 'session';
  const [seconds, setSeconds] = useState(() => {
    const saved = localStorage.getItem(`texthooker_timer_${timerKey}`);
    return saved ? Number(saved) : 0;
  });
  const [isTimerActive, setIsTimerActive] = useState(false);

  useEffect(() => {
    const mediaTitle =
      media?.title?.contentTitleEnglish ||
      media?.title?.contentTitleRomaji ||
      media?.title?.contentTitleNative;

    if (mediaTitle) {
      document.title = `${mediaTitle} • TextHooker • NihongoTracker`;
      return;
    }

    document.title = 'TextHooker • NihongoTracker';
  }, [
    media?.title?.contentTitleEnglish,
    media?.title?.contentTitleRomaji,
    media?.title?.contentTitleNative,
  ]);

  useEffect(() => {
    if (!contentId || !sessionData || resumePromptHandled) return;

    const roomMode = searchParams.get('mode');
    if (roomMode === 'host' || roomMode === 'guest') return;

    const hasProgress =
      (sessionData.lines?.length ?? 0) > 0 ||
      (sessionData.timerSeconds ?? 0) > 0;

    if (hasProgress) {
      setIsTimerActive(false);
      setIsResumePromptOpen(true);
      return;
    }

    setResumePromptHandled(true);
  }, [contentId, sessionData, resumePromptHandled, searchParams]);

  const handleContinueCurrentSession = useCallback(() => {
    setResumePromptHandled(true);
    setIsResumePromptOpen(false);
    lastActivityRef.current = Date.now();
  }, []);

  const handleStartNewMediaSession = useCallback(async () => {
    if (!contentId) return;

    try {
      await Promise.all([
        clearSessionLinesFn(contentId),
        updateSessionTimerFn(contentId, 0),
      ]);

      initialStatsRef.current = { lines: 0, chars: 0 };
      setLines([]);
      setSeconds(0);
      lastSavedTimerRef.current = 0;
      timerInitializedFromServerRef.current = true;

      queryClient.setQueryData<ITextSession | undefined>(
        ['textSession', contentId],
        (previous) => {
          if (!previous) return previous;
          return {
            ...previous,
            lines: [],
            timerSeconds: 0,
            updatedAt: new Date().toISOString(),
          };
        }
      );

      toast.success('Started a new session');
    } catch (error) {
      toast.error('Failed to start a new session');
      console.error(error);
    } finally {
      setResumePromptHandled(true);
      setIsResumePromptOpen(false);
      lastActivityRef.current = Date.now();
      setIsTimerActive(true);
    }
  }, [contentId, queryClient]);

  // Use whichever is higher to avoid losing timer progress
  useEffect(() => {
    if (
      sessionData &&
      !timerInitializedFromServerRef.current &&
      typeof sessionData.timerSeconds === 'number'
    ) {
      const serverTimer = sessionData.timerSeconds;
      const localTimer = Number(
        localStorage.getItem(`texthooker_timer_${timerKey}`) || 0
      );
      const bestTimer = Math.max(serverTimer, localTimer);
      setSeconds(bestTimer);
      lastSavedTimerRef.current = bestTimer;
      timerInitializedFromServerRef.current = true;
    }
  }, [sessionData, timerKey]);

  useEffect(() => {
    if (!contentId) return;
    const interval = setInterval(() => {
      const currentSeconds = Number(
        localStorage.getItem(`texthooker_timer_${timerKey}`) || 0
      );
      if (currentSeconds !== lastSavedTimerRef.current) {
        lastSavedTimerRef.current = currentSeconds;
        updateSessionTimerFn(contentId, currentSeconds).catch(console.error);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [contentId, timerKey]);

  useEffect(() => {
    return () => {
      if (contentId) {
        const currentSeconds = Number(
          localStorage.getItem(`texthooker_timer_${timerKey}`) || 0
        );
        if (currentSeconds !== lastSavedTimerRef.current) {
          updateSessionTimerFn(contentId, currentSeconds).catch(console.error);
        }
      }
    };
  }, [contentId, timerKey]);

  useEffect(() => {
    localStorage.setItem('texthooker_fontSize', String(fontSize));
  }, [fontSize]);
  useEffect(() => {
    localStorage.setItem('texthooker_fontFamily', fontFamily);
  }, [fontFamily]);
  useEffect(() => {
    localStorage.setItem(
      'texthooker_autoPauseTimeout',
      String(autoPauseTimeout)
    );
  }, [autoPauseTimeout]);
  useEffect(() => {
    localStorage.setItem('texthooker_vertical', String(vertical));
  }, [vertical]);
  useEffect(() => {
    localStorage.setItem('texthooker_lineSpacing', String(lineSpacing));
  }, [lineSpacing]);
  useEffect(() => {
    localStorage.setItem('texthooker_lineGap', String(lineGap));
  }, [lineGap]);
  useEffect(() => {
    localStorage.setItem('texthooker_showTopbarTimer', String(showTopbarTimer));
  }, [showTopbarTimer]);
  useEffect(() => {
    localStorage.setItem(
      'texthooker_showTopbarReadingSpeed',
      String(showTopbarReadingSpeed)
    );
  }, [showTopbarReadingSpeed]);
  useEffect(() => {
    localStorage.setItem(
      'texthooker_showTopbarCharacters',
      String(showTopbarCharacters)
    );
  }, [showTopbarCharacters]);
  useEffect(() => {
    localStorage.setItem('texthooker_showTopbarLines', String(showTopbarLines));
  }, [showTopbarLines]);
  useEffect(() => {
    localStorage.setItem('texthooker_theme', hookerTheme);
  }, [hookerTheme]);

  useEffect(() => {
    if (
      !hasPatreonAccess &&
      hookerTheme !== 'light' &&
      hookerTheme !== 'dark'
    ) {
      setHookerTheme('dark');
    }
  }, [hasPatreonAccess, hookerTheme]);

  useEffect(() => {
    localStorage.setItem('texthooker_websocketUrl', websocketUrl);
  }, [websocketUrl]);
  useEffect(() => {
    localStorage.setItem(
      'texthooker_autostartTimerByPaste',
      String(autostartTimerByPaste)
    );
  }, [autostartTimerByPaste]);
  useEffect(() => {
    localStorage.setItem(
      'texthooker_autostartTimerByLine',
      String(autostartTimerByLine)
    );
  }, [autostartTimerByLine]);
  useEffect(() => {
    localStorage.setItem(
      'texthooker_allowNewLineDuringPause',
      String(allowNewLineDuringPause)
    );
  }, [allowNewLineDuringPause]);
  useEffect(() => {
    localStorage.setItem(
      'texthooker_allowPasteDuringPause',
      String(allowPasteDuringPause)
    );
  }, [allowPasteDuringPause]);
  useEffect(() => {
    localStorage.setItem(
      'texthooker_continuousReconnect',
      String(continuousReconnect)
    );
  }, [continuousReconnect]);
  useEffect(() => {
    localStorage.setItem(
      'texthooker_preventGlobalDuplicates',
      String(preventGlobalDuplicates)
    );
  }, [preventGlobalDuplicates]);

  useEffect(() => {
    localStorage.setItem('texthooker_customCss', customCss);
  }, [customCss]);

  useEffect(() => {
    localStorage.setItem(`texthooker_timer_${timerKey}`, String(seconds));
  }, [seconds, timerKey]);

  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, [lines]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerActive) {
      interval = setInterval(() => {
        const now = Date.now();
        if (
          autoPauseTimeout > 0 &&
          now - lastActivityRef.current >= autoPauseTimeout * 1000
        ) {
          setIsTimerActive(false);
        } else {
          setSeconds((s) => s + 1);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, autoPauseTimeout]);

  useEffect(() => {
    if (mode === 'local' || !isRoomConnected) {
      setSocket(null);
      return;
    }

    const socketUrl =
      import.meta.env.VITE_API_URL ||
      (window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : undefined);
    const newSocket = io(socketUrl, { withCredentials: true });
    setSocket(newSocket);
    roomSocketRef.current = newSocket;

    newSocket.on('connect', () => {
      if (roomId) {
        newSocket.emit('join_room', {
          roomId,
          role: mode,
          hostToken,
          username: user?.username,
          userId: user?._id,
        });
      }
    });

    newSocket.on('connect_error', (error) => {
      toast.error(`Connection failed: ${error.message}`);
    });

    newSocket.on(
      'room_created',
      (data: { roomId: string; hostToken: string }) => {
        if (data.roomId === roomId) {
          setHostToken(data.hostToken);
          localStorage.setItem(`hostToken_${roomId}`, data.hostToken);
        }
      }
    );

    newSocket.on('error_message', (msg: string) => {
      toast.error(msg);
      setIsRoomConnected(false);
      setMode('local');
      newSocket.disconnect();
    });

    newSocket.on('room_users_update', (members: Member[]) => {
      setConnectedMembers(members);
    });

    if (mode === 'guest' || mode === 'host') {
      newSocket.on('receive_line', (lineData: LineEntry) => {
        let lineAdded = false;
        setLines((prev) => {
          if (
            preventGlobalDuplicates &&
            prev.some((line) => line.text.trim() === lineData.text.trim())
          ) {
            return prev;
          }
          lineAdded = true;
          return [...prev, lineData];
        });

        if (!lineAdded) return;

        lastActivityRef.current = Date.now();

        if (!isTimerActive && autostartTimerByLine) {
          setIsTimerActive(true);
        }

        if (contentId) {
          saveLines([lineData]);
        }
      });

      // Persist room history so it survives disconnection
      newSocket.on('load_history', (history: LineEntry[]) => {
        const nextHistory = preventGlobalDuplicates
          ? history.filter(
              (line, index, list) =>
                list.findIndex(
                  (item) => item.text.trim() === line.text.trim()
                ) === index
            )
          : history;

        setLines(nextHistory);

        if (contentId) {
          saveLines(nextHistory);
        }
      });
    }

    return () => {
      roomSocketRef.current = null;
      newSocket.disconnect();
    };
  }, [
    mode,
    roomId,
    isRoomConnected,
    hostToken,
    user,
    contentId,
    preventGlobalDuplicates,
    saveLines,
    isTimerActive,
    autostartTimerByLine,
  ]);

  const handleSocketMessage = useCallback(
    (event: MessageEvent) => {
      if (!isTimerActive && !allowNewLineDuringPause) return;

      let text = event.data;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed && typeof parsed.sentence === 'string') {
          text = parsed.sentence;
        }
      } catch (e) {
        // Raw text fallback
      }

      if (!text || text.trim().length === 0) return;

      if (!isTimerActive && autostartTimerByLine) {
        setIsTimerActive(true);
      }

      const japaneseCount = countJapaneseCharacters(text);
      const newLine = { id: createLineId(), text, japaneseCount };

      let lineAdded = false;
      setLines((prev) => {
        if (
          preventGlobalDuplicates &&
          prev.some((line) => line.text.trim() === text.trim())
        ) {
          return prev;
        }
        lineAdded = true;
        return [...prev, newLine];
      });

      if (!lineAdded) return;

      if (contentId) {
        saveLines([newLine]);
      }

      if (mode === 'host' && roomSocketRef.current) {
        roomSocketRef.current.emit('send_line', { roomId, lineData: newLine });
      }
    },
    [
      mode,
      roomId,
      contentId,
      saveLines,
      isTimerActive,
      allowNewLineDuringPause,
      autostartTimerByLine,
      preventGlobalDuplicates,
    ]
  );

  const attemptConnect = useCallback(() => {
    if (
      socketRef.current?.readyState === WebSocket.OPEN ||
      socketRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    setConnectionStatus('connecting');
    try {
      const socket = new WebSocket(websocketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus('connected');
        if (reconnectIntervalRef.current) {
          clearInterval(reconnectIntervalRef.current);
          reconnectIntervalRef.current = null;
        }
      };

      socket.onclose = () => {
        setConnectionStatus('disconnected');
        socketRef.current = null;
      };

      socket.onerror = () => {
        setConnectionStatus('error');
        socketRef.current = null;
      };

      socket.onmessage = handleSocketMessage;
    } catch (error) {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
    }
  }, [websocketUrl, handleSocketMessage]);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.onmessage = handleSocketMessage;
    }
  }, [handleSocketMessage]);

  const toggleSocket = useCallback(() => {
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }

    if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
      socketRef.current?.close();
      return;
    }

    attemptConnect();

    if (continuousReconnect) {
      reconnectIntervalRef.current = setInterval(() => {
        if (
          !socketRef.current ||
          socketRef.current.readyState === WebSocket.CLOSED
        ) {
          attemptConnect();
        }
      }, 3000);
    }
  }, [connectionStatus, attemptConnect, continuousReconnect]);

  useEffect(() => {
    if (
      continuousReconnect &&
      connectionStatus !== 'connected' &&
      connectionStatus !== 'connecting'
    ) {
      if (!reconnectIntervalRef.current) {
        reconnectIntervalRef.current = setInterval(() => {
          if (
            !socketRef.current ||
            socketRef.current.readyState === WebSocket.CLOSED
          ) {
            attemptConnect();
          }
        }, 3000);
      }
    } else if (!continuousReconnect && reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
  }, [continuousReconnect, connectionStatus, attemptConnect]);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
      }
    };
  }, []);

  const handleFontSizeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(event.target.value);
      if (!Number.isNaN(value)) {
        setFontSize(value);
      }
    },
    []
  );

  const handleFontFamilyChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setFontFamily(event.target.value);
    },
    []
  );

  const handleAutoPauseTimeoutChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(event.target.value);
      if (!Number.isNaN(value)) {
        setAutoPauseTimeout(value);
      }
    },
    []
  );

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m
      .toString()
      .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatSpeed = (chars: number, totalSeconds: number) => {
    if (totalSeconds === 0) return 0;
    const hours = totalSeconds / 3600;
    return Math.round(chars / hours);
  };

  const toggleTimer = useCallback(() => {
    setIsTimerActive((prev) => {
      // Reset activity timestamp to prevent immediate re-pause
      if (!prev) {
        lastActivityRef.current = Date.now();
      }
      return !prev;
    });
  }, []);

  const handleResetTimer = useCallback(() => {
    setSeconds(0);
    lastActivityRef.current = Date.now();
    setIsResetTimerConfirmOpen(false);
    if (contentId) {
      lastSavedTimerRef.current = 0;
      updateSessionTimerFn(contentId, 0).catch(console.error);
    }
  }, [contentId]);

  const handleRequestResetTimer = useCallback(() => {
    if (seconds === 0) return;
    setIsResetTimerConfirmOpen(true);
  }, [seconds]);

  const handleOpenTimerEdit = useCallback(() => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    setTimerEditHours(h);
    setTimerEditMinutes(m);
    setTimerEditSeconds(s);
    setIsTimerEditOpen(true);
  }, [seconds]);

  const handleSaveTimerEdit = useCallback(() => {
    const totalSeconds =
      timerEditHours * 3600 + timerEditMinutes * 60 + timerEditSeconds;
    setSeconds(totalSeconds);
    lastActivityRef.current = Date.now();
    setIsTimerEditOpen(false);
    if (contentId) {
      lastSavedTimerRef.current = totalSeconds;
      updateSessionTimerFn(contentId, totalSeconds).catch(console.error);
    }
  }, [timerEditHours, timerEditMinutes, timerEditSeconds, contentId]);

  const handleDeleteLast = useCallback(() => {
    setLines((prev) => {
      if (prev.length === 0) return prev;
      const lastLine = prev[prev.length - 1];
      if (contentId) {
        removeLinesFromSessionFn(contentId, [lastLine.id]).catch(console.error);
      }
      return prev.slice(0, -1);
    });
  }, [contentId]);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLElement>(document.body);

  const isAutoScrollEnabled = useRef(true);

  const linesNumber = lines.length;
  const charsNumber = (() =>
    lines.reduce((sum, entry) => {
      const count = Number.isFinite(entry.japaneseCount)
        ? entry.japaneseCount
        : countJapaneseCharacters(entry.text);
      return sum + count;
    }, 0))();

  const currentSessionLines = Math.max(
    0,
    linesNumber - initialStatsRef.current.lines
  );
  const currentSessionChars = Math.max(
    0,
    charsNumber - initialStatsRef.current.chars
  );
  const loggedChars = Math.max(charsNumber - currentSessionChars, 0);

  const triggerLogAnimation = useCallback(() => {
    const previousLogged = loggedChars;
    const nextLogged = previousLogged + currentSessionChars;

    setAnimatedChars(previousLogged);
    setTargetChars(nextLogged);
    setIsLogAnimating(true);

    setTimeout(() => {
      initialStatsRef.current = {
        lines: linesNumber,
        chars: charsNumber,
      };
      setSeconds(0);
      if (contentId) {
        lastSavedTimerRef.current = 0;
        updateSessionTimerFn(contentId, 0).catch(console.error);
      }
      setIsLogAnimating(false);
    }, 1500);
  }, [loggedChars, currentSessionChars, linesNumber, charsNumber, contentId]);

  const { mutate: createLog, isPending: isLogging } = useMutation({
    mutationFn: createLogFn,
    onSuccess: () => {
      if (contentId && pendingHistoryEntryRef.current) {
        addSessionHistoryEntry({
          contentId,
          entry: pendingHistoryEntryRef.current,
        });
      }
      pendingHistoryEntryRef.current = null;
      triggerLogAnimation();
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
    },
    onError: (error) => {
      pendingHistoryEntryRef.current = null;
      toast.error('Failed to log session');
      console.error(error);
    },
  });

  const { mutate: addSessionHistoryEntry } = useMutation({
    mutationFn: ({
      contentId,
      entry,
    }: {
      contentId: string;
      entry: {
        isShared: boolean;
        connectedUsersCount: number;
        charactersLogged: number;
        readingSpeed: number;
        sessionSeconds: number;
      };
    }) => addSessionHistoryEntryFn(contentId, entry),
    onSuccess: (updatedSession, variables) => {
      queryClient.setQueryData<ITextSession | undefined>(
        ['textSession', variables.contentId],
        updatedSession
      );
    },
  });

  const handleLogSession = () => {
    if (!media) {
      const totalMinutes = Math.floor(seconds / 60);
      setIsStatsOpen(false);
      setQuickLogDefaults({
        chars: currentSessionChars > 0 ? currentSessionChars : undefined,
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
      });
      setIsQuickLogOpen(true);
      return;
    }

    const isSharedNow =
      isRoomConnected && (mode === 'host' || mode === 'guest');
    const connectedUsersCount = isSharedNow
      ? Math.max(connectedMembers.length, 1)
      : 0;

    pendingHistoryEntryRef.current = {
      isShared: isSharedNow,
      connectedUsersCount,
      charactersLogged: currentSessionChars,
      readingSpeed: formatSpeed(currentSessionChars, seconds),
      sessionSeconds: seconds,
    };

    createLog({
      mediaId: media.contentId,
      date: new Date().toISOString(),
      time: Math.floor(seconds / 60),
      chars: currentSessionChars,
      type: media.type,
      description: media.title.contentTitleNative,
      isAdult: media.isAdult,
      private: false,
    });
  };

  useEffect(() => {
    if (!isLogAnimating) {
      setAnimatedChars(loggedChars);
      setTargetChars(loggedChars);
    }
  }, [loggedChars, isLogAnimating]);

  useEffect(() => {
    if (isLogAnimating && animatedChars < targetChars) {
      const diff = targetChars - animatedChars;
      const increment = Math.ceil(diff / 30); // Animate over ~30 frames
      const timer = setTimeout(() => {
        setAnimatedChars((prev) => Math.min(prev + increment, targetChars));
      }, 16); // ~60fps
      return () => clearTimeout(timer);
    }
  }, [isLogAnimating, animatedChars, targetChars]);

  useEffect(() => {
    const container = listContainerRef.current;
    if (!container || !isAutoScrollEnabled.current) return;

    if (vertical) {
      container.scrollTo({ left: -container.scrollWidth, behavior: 'smooth' });
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [lines, vertical]);

  const handleScroll = useCallback(() => {
    const container = listContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const LEEWAY = 100;

    if (vertical) {
      isAutoScrollEnabled.current = true;
    } else {
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - LEEWAY;
      isAutoScrollEnabled.current = isAtBottom;
    }
  }, [vertical]);

  const sessionHistory = [...(sessionData?.sessionHistory || [])]
    .sort(
      (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    )
    .slice(0, 10);

  const callback = useCallback(
    (mutationsList: MutationRecord[]) => {
      for (const mutation of mutationsList) {
        if (
          mutation.target === document.body &&
          mutation.type === 'childList' &&
          mutation.addedNodes.length >= 1
        ) {
          if (!isTimerActive && !allowPasteDuringPause) continue;

          let ptag: Node | null = null;
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (element.tagName === 'P') {
                ptag = node;
                break;
              }
            }
          }
          if (!ptag) {
            continue;
          }

          const text = ptag.textContent || '';

          try {
            if (ptag.parentNode) {
              ptag.parentNode.removeChild(ptag);
            } else {
              (ptag as ChildNode).remove?.();
            }
          } catch (e) {
            continue;
          }

          if (!isTimerActive && autostartTimerByPaste) {
            setIsTimerActive(true);
          }

          const japaneseCount = countJapaneseCharacters(text);
          const newLine = { id: createLineId(), text, japaneseCount };

          let lineAdded = false;
          setLines((prev) => {
            if (
              preventGlobalDuplicates &&
              prev.some((line) => line.text.trim() === text.trim())
            ) {
              return prev;
            }
            lineAdded = true;
            return [...prev, newLine];
          });

          if (!lineAdded) continue;

          if (contentId) {
            saveLines([newLine]);
          }

          if (mode === 'host' && roomSocketRef.current) {
            roomSocketRef.current.emit('send_line', {
              roomId,
              lineData: newLine,
            });
          }
        }
      }
    },
    [
      mode,
      roomId,
      contentId,
      saveLines,
      isTimerActive,
      allowPasteDuringPause,
      autostartTimerByPaste,
      preventGlobalDuplicates,
    ]
  );

  const applyPreventGlobalDuplicatesToCurrentLines = useCallback(() => {
    const removedIds: string[] = [];

    setLines((prev) => {
      const seenTexts = new Set<string>();
      return prev.filter((line) => {
        const normalized = line.text.trim();
        if (seenTexts.has(normalized)) {
          removedIds.push(line.id);
          return false;
        }
        seenTexts.add(normalized);
        return true;
      });
    });

    if (contentId && removedIds.length > 0) {
      removeLinesFromSessionFn(contentId, removedIds).catch(console.error);
    }

    if (removedIds.length > 0) {
      toast.success(`Removed ${removedIds.length} duplicate line(s)`);
    }

    setIsPreventDuplicateConfirmOpen(false);
  }, [contentId]);

  const handlePreventGlobalDuplicatesToggle = useCallback(
    (checked: boolean) => {
      setPreventGlobalDuplicates(checked);
      if (checked) {
        setIsPreventDuplicateConfirmOpen(true);
      } else {
        setIsPreventDuplicateConfirmOpen(false);
      }
    },
    []
  );

  const handleDelete = useCallback(
    (id: string) => {
      setLines((prev) => prev.filter((line) => line.id !== id));
      if (contentId) {
        removeLinesFromSessionFn(contentId, [id]).catch(console.error);
      }
    },
    [contentId]
  );

  const handleClearAll = useCallback(() => {
    setLines([]);
    if (contentId) {
      clearSessionLinesFn(contentId).catch(console.error);
    }
  }, [contentId]);

  const handleCopyAll = useCallback(async () => {
    const combined = lines.map((line) => line.text).join('\n');
    if (!combined) {
      return;
    }
    try {
      await navigator.clipboard.writeText(combined);
    } catch (error) {
      console.error('Failed to copy lines', error);
    }
  }, [lines]);

  const toggleVertical = useCallback(() => {
    setVertical((prev) => !prev);
  }, []);

  const handleLineSpacingChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(event.target.value);
      if (!Number.isNaN(value)) {
        setLineSpacing(value);
      }
    },
    []
  );

  const handleLineGapChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(event.target.value);
      if (!Number.isNaN(value)) {
        setLineGap(value);
      }
    },
    []
  );

  useMutationObserver(bodyRef, callback, {
    childList: true,
    attributes: false,
  });

  const columnHeight = 'calc(100vh - 160px)';

  const listStyles: CSSProperties = vertical
    ? { columnGap: lineGap, rowGap: lineGap, direction: 'rtl' }
    : { rowGap: lineGap };

  const textBaseStyle: CSSProperties = {
    lineHeight: lineSpacing,
    fontSize: fontSize,
    fontFamily:
      fontFamily === 'sans-serif'
        ? 'sans-serif'
        : `"${fontFamily}", sans-serif`,
  };

  const verticalTextStyle: CSSProperties = {
    ...textBaseStyle,
    writingMode: 'vertical-rl',
    textOrientation: 'mixed',
    flexShrink: 0,
    height: '100%',
    direction: 'ltr',
  };

  const horizontalTextStyle: CSSProperties = {
    ...textBaseStyle,
    display: 'block',
  };

  const topbarMetrics: Array<{
    key: string;
    title: string;
    content: ReactNode;
  }> = [];

  if (showTopbarTimer) {
    topbarMetrics.push({
      key: 'timer',
      title: 'Timer',
      content: (
        <>
          <Clock size={16} className="opacity-70" />
          {formatTime(seconds)}
        </>
      ),
    });
  }

  if (showTopbarReadingSpeed) {
    topbarMetrics.push({
      key: 'reading-speed',
      title: 'Reading Speed (chars/hour)',
      content: (
        <>
          <Activity size={16} className="opacity-70" />
          {numberWithCommas(formatSpeed(charsNumber, seconds))}/h
        </>
      ),
    });
  }

  if (showTopbarCharacters) {
    topbarMetrics.push({
      key: 'characters',
      title: 'Characters',
      content: (
        <>
          <Type size={16} className="opacity-70" />
          {numberWithCommas(charsNumber)}
        </>
      ),
    });
  }

  if (showTopbarLines) {
    topbarMetrics.push({
      key: 'lines',
      title: 'Lines',
      content: (
        <>
          <FileText size={16} className="opacity-70" />
          {numberWithCommas(linesNumber)}
        </>
      ),
    });
  }

  const listContainerClasses = vertical
    ? 'pt-16 px-4 flex flex-row overflow-x-auto overflow-y-hidden h-screen items-start pb-6'
    : 'pt-16 px-4 flex flex-col overflow-y-auto h-screen pb-6';

  const inviteLink = (() => {
    if (typeof window === 'undefined' || !roomId) return '';
    const url = new URL(`${window.location.origin}${location.pathname}`);
    url.searchParams.set('mode', 'guest');
    url.searchParams.set('roomId', roomId);
    return url.toString();
  })();

  const handleCopyInviteLink = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy invite link');
      console.error(error);
    }
  }, [inviteLink]);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      if (!settingsPanelRef.current) return;
      const target = event.target as Node;
      if (settingsButtonRef.current?.contains(target)) {
        return;
      }
      if (!settingsPanelRef.current.contains(target)) {
        setIsSettingsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isSettingsOpen]);

  return (
    <div
      data-theme={hookerTheme || undefined}
      className="bg-base-300 min-h-screen th-root"
    >
      {customCss.trim() && <style>{customCss}</style>}
      <ToastContainer autoClose={2000} position="bottom-right" />
      {/* Top Bar */}
      <div className="fixed top-1 right-1 m-2 px-3 py-2 bg-base-100 rounded-md shadow-md z-50 text-base-content inline-flex items-center gap-3 th-topbar">
        {topbarMetrics.map((metric, index) => (
          <Fragment key={metric.key}>
            <div
              className="font-mono text-base flex items-center gap-2"
              title={metric.title}
            >
              {metric.content}
            </div>
            {index < topbarMetrics.length - 1 && (
              <div className="w-px h-4 bg-base-content/20"></div>
            )}
          </Fragment>
        ))}

        {topbarMetrics.length > 0 && (
          <div className="w-px h-4 bg-base-content/20 mx-1"></div>
        )}

        <button
          type="button"
          onClick={toggleSocket}
          className={`btn btn-xs btn-ghost btn-square transition-colors duration-300 ${
            connectionStatus === 'connected'
              ? 'text-success'
              : connectionStatus === 'error'
                ? 'text-error'
                : connectionStatus === 'connecting'
                  ? 'text-warning'
                  : 'opacity-40'
          }`}
          title={`WebSocket Status: ${connectionStatus}`}
        >
          {connectionStatus === 'connected' ? (
            <Link size={16} />
          ) : (
            <Unlink size={16} />
          )}
        </button>

        <button
          type="button"
          onClick={toggleTimer}
          className="btn btn-xs btn-ghost btn-square"
          title={isTimerActive ? 'Pause Timer' : 'Resume Timer'}
        >
          {isTimerActive ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          type="button"
          onClick={handleRequestResetTimer}
          className="btn btn-xs btn-ghost btn-square"
          title="Reset Timer"
        >
          <RotateCcw size={16} />
        </button>

        <button
          type="button"
          onClick={handleOpenTimerEdit}
          className="btn btn-xs btn-ghost btn-square"
          title="Set Timer"
        >
          <Edit3 size={16} />
        </button>

        <button
          type="button"
          onClick={handleDeleteLast}
          className="btn btn-xs btn-ghost btn-square text-error"
          title="Delete last line"
        >
          <Trash2 size={16} />
        </button>

        <button
          type="button"
          onClick={() => setIsStatsOpen(true)}
          className="btn btn-xs btn-ghost btn-square"
          title="View Stats"
        >
          <BarChart2 size={16} />
        </button>

        <button
          ref={settingsButtonRef}
          type="button"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          className="btn btn-xs btn-ghost btn-square"
          title="Settings"
        >
          <Settings size={16} />
        </button>

        <div className="w-px h-4 bg-base-content/20 mx-1"></div>

        <RouterLink
          to="/texthooker"
          className="btn btn-xs btn-ghost btn-square"
          title="Back to Dashboard"
        >
          <Home size={16} />
        </RouterLink>

        {isRoomConnected && (
          <div className="dropdown dropdown-end">
            <button
              type="button"
              tabIndex={0}
              className="btn btn-xs btn-ghost btn-square"
              title="Connected Members"
            >
              <Users size={16} />
              <span className="absolute -top-1 -right-1 badge badge-xs badge-primary scale-75">
                {connectedMembers.length}
              </span>
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu menu-sm bg-base-100 rounded-box shadow-lg mt-2 p-2 min-w-52 z-50"
            >
              <li className="menu-title px-2 py-1 text-xs opacity-70">
                Members ({connectedMembers.length})
              </li>
              {sortedMembers.map((member) => {
                const isCurrentUser = member.id === socket?.id;
                const displayName =
                  member.username || (isCurrentUser ? user?.username : null);

                return (
                  <li key={member.id}>
                    {displayName ? (
                      <a
                        href={`/user/${displayName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex justify-between items-center text-xs"
                      >
                        <span className="flex items-center gap-2">
                          {member.role === 'host' && (
                            <Crown size={12} className="text-warning" />
                          )}
                          <span className="font-medium">
                            {displayName}
                            {isCurrentUser && ' (You)'}
                          </span>
                        </span>
                        <span className="badge badge-xs capitalize opacity-70">
                          {member.role === 'host' ? 'Host' : 'Guest'}
                        </span>
                      </a>
                    ) : (
                      <span className="flex justify-between items-center text-xs cursor-default">
                        <span className="flex items-center gap-2">
                          {member.role === 'host' && (
                            <Crown size={12} className="text-warning" />
                          )}
                          <span className="font-medium">
                            Anonymous{isCurrentUser && ' (You)'}
                          </span>
                        </span>
                        <span className="badge badge-xs capitalize opacity-70">
                          {member.role === 'host' ? 'Host' : 'Guest'}
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Timer Edit Modal */}
      <dialog className={`modal ${isTimerEditOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Set Timer
            </h3>
            <button
              onClick={() => setIsTimerEditOpen(false)}
              className="btn btn-sm btn-circle btn-ghost"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-xs">Hours</span>
              </label>
              <input
                type="number"
                min="0"
                max="99"
                value={timerEditHours}
                onChange={(e) =>
                  setTimerEditHours(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="input input-bordered w-20 text-center font-mono text-lg"
              />
            </div>
            <span className="text-2xl font-bold mt-6">:</span>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-xs">Minutes</span>
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={timerEditMinutes}
                onChange={(e) =>
                  setTimerEditMinutes(
                    Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                  )
                }
                className="input input-bordered w-20 text-center font-mono text-lg"
              />
            </div>
            <span className="text-2xl font-bold mt-6">:</span>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-xs">Seconds</span>
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={timerEditSeconds}
                onChange={(e) =>
                  setTimerEditSeconds(
                    Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                  )
                }
                className="input input-bordered w-20 text-center font-mono text-lg"
              />
            </div>
          </div>

          <div className="modal-action">
            <button
              onClick={() => setIsTimerEditOpen(false)}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button onClick={handleSaveTimerEdit} className="btn btn-primary">
              Save
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsTimerEditOpen(false)}>close</button>
        </form>
      </dialog>

      {/* Reset Timer Confirmation Modal */}
      <dialog
        className={`modal ${isResetTimerConfirmOpen ? 'modal-open' : ''}`}
      >
        <div className="modal-box max-w-sm">
          <h3 className="font-bold text-lg mb-2">Reset timer?</h3>
          <p className="text-base-content/70 mb-5">
            This will set the current timer back to 00:00:00.
          </p>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsResetTimerConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-error"
              onClick={handleResetTimer}
            >
              Reset timer
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsResetTimerConfirmOpen(false)}>
            close
          </button>
        </form>
      </dialog>

      <dialog
        className={`modal ${isPreventDuplicateConfirmOpen ? 'modal-open' : ''}`}
      >
        <div className="modal-box max-w-md">
          <h3 className="font-bold text-lg mb-2">
            Apply duplicate prevention to current lines?
          </h3>
          <p className="text-base-content/70 mb-5">
            This setting blocks adding new lines that match existing text. You
            can also remove already duplicated lines in this session now.
          </p>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsPreventDuplicateConfirmOpen(false)}
            >
              Keep current lines
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={applyPreventGlobalDuplicatesToCurrentLines}
            >
              Apply to current lines
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsPreventDuplicateConfirmOpen(false)}>
            close
          </button>
        </form>
      </dialog>

      {/* Resume Session Modal */}
      <dialog className={`modal ${isResumePromptOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-lg">
          <h3 className="font-bold text-lg mb-2">Resume previous session?</h3>
          <p className="text-base-content/70 mb-5">
            We found saved progress for this media. Do you want to continue the
            current session or start a new one?
          </p>

          <div className="bg-base-200 rounded-lg p-4 mb-5">
            <div className="text-sm text-base-content/70 mb-1">
              Current progress
            </div>
            <div className="text-sm font-medium">
              {numberWithCommas(charsNumber)} characters
            </div>
            <div className="text-sm font-medium">
              {formatTime(seconds)} tracked
            </div>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleContinueCurrentSession}
            >
              Continue current session
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void handleStartNewMediaSession();
              }}
            >
              Start new session
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            onClick={() => {
              handleContinueCurrentSession();
            }}
          >
            close
          </button>
        </form>
      </dialog>

      {/* Stats Modal */}
      <dialog className={`modal ${isStatsOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-4xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              Session Statistics
            </h3>
            <button
              onClick={() => setIsStatsOpen(false)}
              className="btn btn-sm btn-circle btn-ghost"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            {media && (
              <div className="md:w-1/3 flex-shrink-0">
                <div className="bg-base-200 p-4 rounded-lg space-y-4">
                  <img
                    src={media.coverImage || media.contentImage || ''}
                    alt={media.title.contentTitleNative}
                    className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg"
                  />
                  <div>
                    <h4 className="font-bold text-lg line-clamp-2">
                      {media.title.contentTitleNative}
                    </h4>
                    <p className="text-sm opacity-70 line-clamp-1">
                      {media.title.contentTitleRomaji}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="badge badge-primary badge-sm capitalize">
                        {media.type}
                      </span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2 mt-4">
                    <div className="text-sm font-semibold opacity-70 mb-2">
                      Reading Progress
                    </div>
                    {fullMediaData?.jiten?.mainDeck?.characterCount ? (
                      (() => {
                        const totalCharCount =
                          fullMediaData.jiten.mainDeck.characterCount;
                        const totalProgress =
                          previouslyLoggedChars + animatedChars;
                        const progressPercent = Math.min(
                          (totalProgress / totalCharCount) * 100,
                          100
                        );
                        return (
                          <>
                            <div className="flex justify-between items-center text-sm">
                              <span className="opacity-70">Progress</span>
                              <span
                                className={`font-bold transition-all duration-700 ${isLogAnimating ? 'scale-150 text-success drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]' : ''}`}
                              >
                                {progressPercent.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-base-300 rounded-full h-3 overflow-hidden relative">
                              <div
                                className={`h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-700 ease-out ${isLogAnimating ? 'shadow-lg shadow-primary/50' : ''}`}
                                style={{
                                  width: `${progressPercent}%`,
                                }}
                              />
                              {isLogAnimating && (
                                <div
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                                  style={{
                                    animation: 'shimmer 1s ease-in-out',
                                  }}
                                />
                              )}
                            </div>
                            <div className="flex justify-between text-xs opacity-60">
                              <span
                                className={
                                  isLogAnimating
                                    ? 'text-success font-semibold transition-all duration-500'
                                    : ''
                                }
                              >
                                {numberWithCommas(Math.round(totalProgress))}{' '}
                                chars
                              </span>
                              <span>
                                {numberWithCommas(totalCharCount)} total
                              </span>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <div className="text-sm opacity-50">
                        Character count not available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 space-y-6">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-3">
                  Current Session
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-base-200 p-3 rounded-lg">
                    <div className="text-xs opacity-70 mb-1">Time Elapsed</div>
                    <div className="text-xl font-mono font-bold">
                      {formatTime(seconds)}
                    </div>
                  </div>
                  <div className="bg-base-200 p-3 rounded-lg">
                    <div className="text-xs opacity-70 mb-1">Reading Speed</div>
                    <div className="text-xl font-bold">
                      {formatSpeed(currentSessionChars, seconds)}
                      <span className="text-xs font-normal opacity-60 ml-1">
                        chars/h
                      </span>
                    </div>
                  </div>
                  <div className="bg-base-200 p-3 rounded-lg">
                    <div className="text-xs opacity-70 mb-1">Lines Read</div>
                    <div className="text-xl font-bold">
                      {numberWithCommas(currentSessionLines)}
                    </div>
                  </div>
                  <div className="bg-base-200 p-3 rounded-lg">
                    <div className="text-xs opacity-70 mb-1">Characters</div>
                    <div className="text-xl font-bold">
                      {numberWithCommas(currentSessionChars)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="divider"></div>

              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-3">
                  Total (All Time)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-base-200 p-3 rounded-lg">
                    <div className="text-xs opacity-70 mb-1">Total Lines</div>
                    <div className="text-xl font-bold">
                      {numberWithCommas(linesNumber)}
                    </div>
                  </div>
                  <div className="bg-base-200 p-3 rounded-lg">
                    <div className="text-xs opacity-70 mb-1">
                      Total Characters
                    </div>
                    <div className="text-xl font-bold">
                      {numberWithCommas(charsNumber)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="divider"></div>

              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-3">
                  Session History
                </h4>
                {sessionHistory.length === 0 ? (
                  <div className="bg-base-200 p-3 rounded-lg text-sm opacity-70">
                    No logged sessions yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {sessionHistory.map((entry, index) => (
                      <div
                        key={`${entry.loggedAt}-${index}`}
                        className="bg-base-200 p-3 rounded-lg"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs opacity-70">
                            {new Date(entry.loggedAt).toLocaleString()}
                          </span>
                          <span
                            className={`badge badge-sm ${entry.isShared ? 'badge-primary' : 'badge-ghost'}`}
                          >
                            {entry.isShared ? 'Shared' : 'Offline'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="opacity-70">Characters</span>
                            <span className="font-semibold">
                              {numberWithCommas(entry.charactersLogged)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-70">Speed</span>
                            <span className="font-semibold">
                              {numberWithCommas(entry.readingSpeed)} chars/h
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-70">Time</span>
                            <span className="font-semibold">
                              {formatTime(entry.sessionSeconds)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-70">Connected</span>
                            <span className="font-semibold">
                              {entry.isShared
                                ? `${entry.connectedUsersCount} people`
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-base-content/10">
                <button
                  onClick={handleLogSession}
                  disabled={isLogging || currentSessionChars === 0}
                  className={`btn btn-primary w-full sm:w-auto transition-all ${isLogAnimating ? 'btn-success scale-105' : ''}`}
                >
                  {isLogging ? (
                    <span className="loading loading-spinner"></span>
                  ) : isLogAnimating ? (
                    <>
                      <span className="text-xl">✓</span>
                      Logged!
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Log Session
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsStatsOpen(false)}>close</button>
        </form>
      </dialog>

      {/* Settings Dropdown Panel */}
      {isSettingsOpen && (
        <div
          ref={settingsPanelRef}
          className="fixed top-16 right-3 z-[60] w-[min(92vw,52rem)] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border border-base-content/15 bg-base-100/95 backdrop-blur-md shadow-2xl p-5 th-settings-panel"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Settings
            </h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="btn btn-sm btn-circle btn-ghost"
            >
              <X size={20} />
            </button>
          </div>

          <div role="tablist" className="tabs tabs-border mb-5">
            <button
              role="tab"
              className={`tab ${activeSettingsTab === 'display' ? 'tab-active' : ''}`}
              onClick={() => setActiveSettingsTab('display')}
            >
              Display
            </button>
            <button
              role="tab"
              className={`tab ${activeSettingsTab === 'behavior' ? 'tab-active' : ''}`}
              onClick={() => setActiveSettingsTab('behavior')}
            >
              Behavior & Connection
            </button>
          </div>

          {activeSettingsTab === 'display' && (
            <div className="space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold border-b border-base-content/10 pb-2 flex items-center gap-2">
                  <Monitor size={16} /> Display
                </h4>

                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Vertical Text</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm"
                      checked={vertical}
                      onChange={toggleVertical}
                    />
                  </label>
                </div>

                <div className="rounded-lg border border-base-content/10 bg-base-200/40 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70 mb-2">
                    Top Bar Metrics
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100 px-3 py-2 cursor-pointer">
                      <span className="text-sm">Timer</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={showTopbarTimer}
                        onChange={(e) => setShowTopbarTimer(e.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100 px-3 py-2 cursor-pointer">
                      <span className="text-sm">Speed</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={showTopbarReadingSpeed}
                        onChange={(e) =>
                          setShowTopbarReadingSpeed(e.target.checked)
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100 px-3 py-2 cursor-pointer">
                      <span className="text-sm">Characters</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={showTopbarCharacters}
                        onChange={(e) =>
                          setShowTopbarCharacters(e.target.checked)
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100 px-3 py-2 cursor-pointer">
                      <span className="text-sm">Lines</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={showTopbarLines}
                        onChange={(e) => setShowTopbarLines(e.target.checked)}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Font Size (px)</span>
                  </label>
                  <input
                    type="number"
                    min="12"
                    max="72"
                    value={fontSize}
                    onChange={handleFontSizeChange}
                    className="input input-bordered input-sm w-full"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Font Family</span>
                  </label>
                  <select
                    value={fontFamily}
                    onChange={handleFontFamilyChange}
                    className="select select-bordered select-sm w-full"
                  >
                    <option value="Noto Sans JP">Noto Sans JP</option>
                    <option value="Meiryo">Meiryo</option>
                    <option value="Yu Gothic">Yu Gothic</option>
                    <option value="Hiragino Sans">Hiragino Sans</option>
                    <option value="sans-serif">Sans Serif</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Hooker Theme</span>
                  </label>
                  <select
                    value={hookerTheme}
                    onChange={(event) => setHookerTheme(event.target.value)}
                    className="select select-bordered select-sm w-full"
                  >
                    {availableHookerThemes.map((themeOption) => (
                      <option key={themeOption.value} value={themeOption.value}>
                        {themeOption.label}
                      </option>
                    ))}
                  </select>
                  <label className="label">
                    <span className="label-text-alt text-[10px] opacity-60">
                      Only affects TextHooker screen
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs">Line Height</span>
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      max={4}
                      step={0.1}
                      value={lineSpacing}
                      onChange={handleLineSpacingChange}
                      className="input input-bordered input-sm w-full"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs">Line Gap (px)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={96}
                      step={1}
                      value={lineGap}
                      onChange={handleLineGapChange}
                      className="input input-bordered input-sm w-full"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-base-300 bg-base-200/40 p-4 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Custom CSS</h4>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      title="Show class name help"
                      onClick={() => setIsClassHelpOpen(true)}
                    >
                      <HelpCircle size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-base-content/70 mb-3">
                    Add CSS rules to customize the TextHooker layout. Saved
                    locally in your browser.
                  </p>
                  <textarea
                    className="textarea textarea-bordered w-full h-56 font-mono text-xs"
                    value={customCss}
                    onChange={(e) => setCustomCss(e.target.value)}
                    placeholder={
                      '.th-line-text {\n  letter-spacing: 0.02em;\n}\n\n.th-topbar {\n  border-radius: 12px;\n}'
                    }
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => setCustomCss('')}
                    >
                      Clear Custom CSS
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSettingsTab === 'behavior' && (
            <div className="space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold border-b border-base-content/10 pb-2 flex items-center gap-2">
                  <Activity size={16} /> Behavior & Connection
                </h4>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Auto-Pause Timeout (s)</span>
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={3600}
                    value={autoPauseTimeout}
                    onChange={handleAutoPauseTimeoutChange}
                    className="input input-bordered input-sm w-full"
                  />
                </div>

                <div className="rounded-lg border border-base-content/10 bg-base-200/40 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70 mb-2">
                    Runtime Behavior
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    <label className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100 px-3 py-2 cursor-pointer">
                      <span className="text-sm">Allow Paste during Pause</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={allowPasteDuringPause}
                        onChange={(e) =>
                          setAllowPasteDuringPause(e.target.checked)
                        }
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100 px-3 py-2 cursor-pointer">
                      <span className="text-sm">
                        Allow New Line during Pause
                      </span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={allowNewLineDuringPause}
                        onChange={(e) =>
                          setAllowNewLineDuringPause(e.target.checked)
                        }
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100 px-3 py-2 cursor-pointer">
                      <span className="text-sm">
                        Autostart Timer by Paste during Pause
                      </span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={autostartTimerByPaste}
                        onChange={(e) =>
                          setAutostartTimerByPaste(e.target.checked)
                        }
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100 px-3 py-2 cursor-pointer">
                      <span className="text-sm">
                        Autostart Timer by Line during Pause
                      </span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={autostartTimerByLine}
                        onChange={(e) =>
                          setAutostartTimerByLine(e.target.checked)
                        }
                      />
                    </label>

                    <label
                      className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100 px-3 py-2 cursor-pointer"
                      title="Keep trying to connect until successful"
                    >
                      <span className="text-sm">Continuous Reconnect</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={continuousReconnect}
                        onChange={(e) =>
                          setContinuousReconnect(e.target.checked)
                        }
                      />
                    </label>

                    <label
                      className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100 px-3 py-2 cursor-pointer"
                      title="Block adding identical text lines globally"
                    >
                      <span className="text-sm">Prevent Global Duplicates</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={preventGlobalDuplicates}
                        onChange={(e) =>
                          handlePreventGlobalDuplicatesToggle(e.target.checked)
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">WebSocket URL</span>
                  </label>
                  <input
                    type="text"
                    value={websocketUrl}
                    onChange={(e) => setWebsocketUrl(e.target.value)}
                    className="input input-bordered input-sm w-full"
                    placeholder="ws://localhost:6677"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Collaboration Mode</span>
                  </label>
                  <select
                    value={mode}
                    onChange={(e) =>
                      setMode(e.target.value as 'local' | 'host' | 'guest')
                    }
                    className="select select-bordered select-sm w-full"
                  >
                    <option value="local">Local (Offline)</option>
                    <option value="host">Host (Broadcast)</option>
                    <option value="guest">Guest (Receive)</option>
                  </select>
                </div>

                {(mode === 'host' || mode === 'guest') && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Room ID</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        className="input input-bordered input-sm w-full"
                        placeholder="Enter Room Name"
                        disabled={isRoomConnected}
                      />
                      <button
                        type="button"
                        className={`btn btn-sm ${isRoomConnected ? 'btn-error' : 'btn-primary'}`}
                        onClick={() => setIsRoomConnected(!isRoomConnected)}
                        disabled={!roomId}
                      >
                        {isRoomConnected
                          ? 'Disconnect'
                          : mode === 'host'
                            ? 'Host'
                            : 'Join'}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'host' && roomId && inviteLink && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Invite Link</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inviteLink}
                        readOnly
                        className="input input-bordered input-sm w-full"
                      />
                      <button
                        type="button"
                        className={`btn btn-sm ${inviteLinkCopied ? 'btn-success' : 'btn-outline'}`}
                        onClick={handleCopyInviteLink}
                      >
                        {inviteLinkCopied ? (
                          'Copied!'
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Share2 size={14} /> Copy
                          </span>
                        )}
                      </button>
                    </div>
                    <span className="text-xs opacity-60 mt-1">
                      Share this URL so guests auto-join your room.
                    </span>
                  </div>
                )}

                <div className="divider"></div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="btn btn-sm btn-outline"
                  >
                    <Copy size={16} /> Copy All Lines
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="btn btn-sm btn-outline btn-error"
                  >
                    <Trash2 size={16} /> Clear All Lines
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <dialog className={`modal ${isClassHelpOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Class Name Help</h3>
            <button
              onClick={() => setIsClassHelpOpen(false)}
              className="btn btn-sm btn-circle btn-ghost"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-base-content/70 mb-3">
            Use these classes inside Custom CSS:
          </p>
          <div className="space-y-2 text-sm">
            <div className="rounded bg-base-200 px-3 py-2">
              <code>.th-root</code> - full TextHooker page
            </div>
            <div className="rounded bg-base-200 px-3 py-2">
              <code>.th-topbar</code> - top control bar
            </div>
            <div className="rounded bg-base-200 px-3 py-2">
              <code>.th-settings-panel</code> - settings dropdown panel
            </div>
            <div className="rounded bg-base-200 px-3 py-2">
              <code>.th-line-list</code> - line list scroller
            </div>
            <div className="rounded bg-base-200 px-3 py-2">
              <code>.th-line-item</code> - each captured line wrapper
            </div>
            <div className="rounded bg-base-200 px-3 py-2">
              <code>.th-line-text</code> - line text content
            </div>
          </div>
          <div className="modal-action">
            <button className="btn" onClick={() => setIsClassHelpOpen(false)}>
              Close
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsClassHelpOpen(false)}>close</button>
        </form>
      </dialog>

      {/* Join Room Modal */}
      <dialog className={`modal ${isJoinRoomOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Join Room
            </h3>
            <button
              onClick={() => setIsJoinRoomOpen(false)}
              className="btn btn-sm btn-circle btn-ghost"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Join as</span>
              </label>
              <div className="flex gap-2">
                <label className="label cursor-pointer border rounded-lg p-3 flex-1 border-base-300 hover:border-primary transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Crown size={16} className="text-warning" />
                      <span className="label-text font-medium">Host</span>
                    </div>
                    <span className="text-xs opacity-70">
                      Create & share room
                    </span>
                  </div>
                  <input
                    type="radio"
                    name="join-mode"
                    className="radio radio-primary radio-sm"
                    value="host"
                    checked={mode === 'host'}
                    onChange={(e) => setMode(e.target.value as 'host')}
                  />
                </label>
                <label className="label cursor-pointer border rounded-lg p-3 flex-1 border-base-300 hover:border-primary transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Users size={16} />
                      <span className="label-text font-medium">Guest</span>
                    </div>
                    <span className="text-xs opacity-70">
                      Join existing room
                    </span>
                  </div>
                  <input
                    type="radio"
                    name="join-mode"
                    className="radio radio-primary radio-sm"
                    value="guest"
                    checked={mode === 'guest'}
                    onChange={(e) => setMode(e.target.value as 'guest')}
                  />
                </label>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Room ID</span>
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="input input-bordered"
                placeholder={
                  mode === 'host' ? 'Create a room name' : 'Enter room ID'
                }
              />
              <label className="label">
                <span className="label-text-alt opacity-70">
                  {mode === 'host'
                    ? 'Choose a unique name for your room'
                    : 'Get the room ID from the host'}
                </span>
              </label>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setIsJoinRoomOpen(false);
                  setMode('local');
                  setRoomId('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (roomId.trim()) {
                    setIsRoomConnected(true);
                    setIsJoinRoomOpen(false);
                  }
                }}
                disabled={!roomId.trim()}
              >
                {mode === 'host' ? 'Create Room' : 'Join Room'}
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsJoinRoomOpen(false)}>close</button>
        </form>
      </dialog>

      <div
        ref={listContainerRef}
        className={`${listContainerClasses} th-line-list`}
        style={listStyles}
        onScroll={handleScroll}
      >
        {lines.map((line) => {
          const marginStyles: CSSProperties = {
            marginTop: lineMarginBlock,
            marginBottom: lineMarginBlock,
            marginLeft: lineMarginInline,
            marginRight: lineMarginInline,
          };

          if (vertical) {
            return (
              <div
                key={line.id}
                className="group relative flex flex-col items-end justify-start px-2 pt-6 text-base-content shrink-0 th-line-item"
                style={{
                  minHeight: columnHeight,
                  height: columnHeight,
                  ...marginStyles,
                }}
              >
                <span
                  lang="ja"
                  className="block text-lg whitespace-pre-wrap wrap-break-word th-line-text"
                  style={verticalTextStyle}
                >
                  {line.text}
                  <button
                    type="button"
                    className="inline-flex justify-center items-center text-error text-sm bg-base-100/80 rounded px-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                    aria-label="Delete line"
                    onClick={() => handleDelete(line.id)}
                    style={{
                      writingMode: 'horizontal-tb',
                      display: 'inline-flex',
                      marginTop: '0.5rem',
                      direction: 'ltr',
                    }}
                  >
                    <X size={14} />
                  </button>
                </span>
              </div>
            );
          }

          return (
            <div
              key={line.id}
              className="group relative px-2 py-2 text-base-content shrink-0 th-line-item"
              style={marginStyles}
            >
              <p
                className="whitespace-pre-wrap wrap-break-word th-line-text"
                style={horizontalTextStyle}
              >
                {line.text}
                <button
                  type="button"
                  className="ml-2 align-baseline text-error text-sm bg-base-100/80 rounded px-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                  aria-label="Delete line"
                  onClick={() => handleDelete(line.id)}
                >
                  <X size={14} />
                </button>
              </p>
            </div>
          );
        })}
      </div>

      <QuickLog
        open={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        initialValues={quickLogDefaults || undefined}
        onLogged={async () => {
          triggerLogAnimation();
          await queryClient.invalidateQueries({ queryKey: ['userStats'] });
        }}
        allowedTypes={['manga', 'vn', 'reading']}
      />
    </div>
  );
}

export default TextHooker;
