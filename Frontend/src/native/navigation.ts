import type { ParseKeys } from "i18next";

export type NativeTab = "home" | "records" | "ranking" | "clubs" | "profile";
export interface NativeRoute {
  title: ParseKeys<"nav">;
  parent: string | null;
  tab: NativeTab | null;
  screen: string;
  primary: boolean;
}

const settingTitles: Record<string, ParseKeys<"nav">> = {
  profile: "native.settingsProfile",
  customization: "native.customization",
  account: "native.account",
  preferences: "native.preferences",
  privacy: "native.privacy",
  patreon: "native.subscription",
  advanced: "native.advanced",
};
const sectionTitles: Record<string, ParseKeys<"nav">> = {
  stats: "titles.sections.stats",
  activity: "titles.sections.activity",
  goals: "titles.goals",
  achievements: "native.achievements",
  list: "titles.sections.immersionList",
  lists: "titles.lists",
  followers: "titles.sections.followers",
  following: "titles.sections.following",
  moderation: "titles.admin",
};

export function nativeRoute(
  path: string,
  search: string,
  username?: string,
): NativeRoute {
  const parts = path.split("/").filter(Boolean);
  const ownProfile = username
    ? `/user/${encodeURIComponent(username)}`
    : "/login";
  const base = {
    parent: "/",
    tab: null,
    primary: false,
    screen: "general",
  } as const;
  if (path === "/")
    return {
      ...base,
      title: "native.home",
      parent: null,
      tab: "home",
      primary: true,
      screen: "home",
    };
  if (path === "/records")
    return {
      ...base,
      title: "native.records",
      parent: null,
      tab: "records",
      primary: true,
      screen: "records",
    };
  if (path === "/ranking")
    return {
      ...base,
      title: "titles.ranking",
      parent: null,
      tab: "ranking",
      primary: true,
      screen: "ranking",
    };
  if (path === "/clubs")
    return {
      ...base,
      title: "titles.clubs",
      parent: null,
      tab: "clubs",
      primary: true,
      screen: "clubs",
    };
  if (parts[0] === "user") {
    const profile = `/user/${parts[1]}`;
    const own = profile.toLowerCase() === ownProfile.toLowerCase();
    return {
      ...base,
      title: parts[2]
        ? (sectionTitles[parts[2]] ?? "native.profile")
        : "native.profile",
      parent: parts[2] ? profile : own ? null : "/ranking",
      tab: own ? "profile" : null,
      primary: own && !parts[2],
      screen: "profile",
    };
  }
  if (parts[0] === "settings") {
    const tab = new URLSearchParams(search).get("tab");
    return {
      ...base,
      title: tab && settingTitles[tab] ? settingTitles[tab] : "titles.settings",
      parent: tab ? "/settings" : ownProfile,
      tab: "profile",
      screen: "settings",
    };
  }
  if (parts[0] === "clubs")
    return {
      ...base,
      title: parts[1] === "create" ? "titles.createClub" : "titles.club",
      parent: parts[2] ? `/clubs/${parts[1]}` : "/clubs",
      tab: "clubs",
      screen: "club",
    };
  const titles: Record<string, ParseKeys<"nav">> = {
    login: "titles.login",
    register: "titles.register",
    "forgot-password": "titles.forgotPassword",
    "reset-password": "titles.resetPassword",
    "verify-email": "titles.verifyEmail",
    log: "titles.createLog",
    matchmedia: "titles.matchMedia",
    notifications: "titles.notifications",
    recommendations: "titles.recommendations",
    lists: "titles.lists",
    calculator: "titles.calculator",
    achievements: "native.achievements",
    privacy: "titles.privacy",
    terms: "titles.terms",
    guidelines: "titles.guidelines",
    support: "titles.support",
    changelog: "titles.changelog",
    "refund-policy": "native.refunds",
    features: "native.help",
    admin: "titles.admin",
    texthooker: "native.texthooker",
    "shared-log": "native.sharedLog",
    "media-request": "titles.requestMedia",
  };
  if (parts[0] === "login")
    return { ...base, title: "titles.login", parent: null, screen: "auth" };
  if (
    ["register", "forgot-password", "reset-password", "verify-email"].includes(
      parts[0],
    )
  )
    return {
      ...base,
      title: titles[parts[0]],
      parent: "/login",
      screen: "auth",
    };
  if (parts[0] === "log")
    return {
      ...base,
      title: "titles.createLog",
      parent: "/records",
      tab: "records",
      screen: "log",
    };
  if (titles[parts[0]])
    return {
      ...base,
      title: titles[parts[0]],
      parent: parts[0] === "lists" && parts[1] ? "/lists" : ownProfile,
    };
  return {
    ...base,
    title: "native.mediaDetails",
    parent: parts.length > 2 ? `/${parts[0]}/${parts[1]}` : "/records",
    screen: "media",
  };
}
