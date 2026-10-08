import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronRight,
  UserRound,
  Palette,
  ShieldCheck,
  Settings2,
  Lock,
  Heart,
  CloudDownload,
  LogOut,
} from "lucide-react";
import { logoutUserFn } from "../api/trackerApi";
import { useUserDataStore } from "../store/userData";
import { getApiErrorMessage } from "../utils/apiError";
import Button from "../components/ui/Button";

const categories = [
  { id: "profile", key: "native.settingsProfile", icon: UserRound },
  { id: "customization", key: "native.customization", icon: Palette },
  { id: "account", key: "native.account", icon: ShieldCheck },
  { id: "preferences", key: "native.preferences", icon: Settings2 },
  { id: "privacy", key: "native.privacy", icon: Lock },
  { id: "patreon", key: "native.subscription", icon: Heart },
  { id: "advanced", key: "native.advanced", icon: CloudDownload },
] as const;
const help = [
  { path: "/support", key: "titles.support" },
  { path: "/guidelines", key: "titles.guidelines" },
  { path: "/changelog", key: "titles.changelog" },
  { path: "/calculator", key: "titles.calculator" },
  { path: "/lists", key: "titles.lists" },
  { path: "/texthooker", key: "native.texthooker" },
] as const;
const legal = [
  { path: "/terms", key: "titles.terms" },
  { path: "/privacy", key: "titles.privacy" },
  { path: "/refund-policy", key: "native.refunds" },
] as const;

export default function NativeSettingsIndex() {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const user = useUserDataStore((store) => store.user);
  const logout = useUserDataStore((store) => store.logout);
  const mutation = useMutation({
    mutationFn: logoutUserFn,
    onSuccess: () => {
      logout();
      navigate("/login", { replace: true });
    },
  });
  return (
    <section className="native-page space-y-6">
      <nav
        className="surface divide-y divide-base-300"
        aria-label={t("titles.settings")}
      >
        {categories.map(({ id, key, icon: Icon }) => (
          <Link
            key={id}
            to={`/settings?tab=${id}`}
            className="flex min-h-16 items-center gap-3 px-4 py-3"
          >
            <Icon className="h-5 w-5 text-base-content/65" />
            <span className="flex-1">{t(key)}</span>
            <ChevronRight className="h-4 w-4 text-base-content/50" />
          </Link>
        ))}
      </nav>
      {[
        { title: "native.help", items: help },
        { title: "native.legal", items: legal },
      ].map(({ title, items }) => (
        <section key={title} className="space-y-2">
          <h2 className="text-sm font-semibold text-base-content/65">
            {t(title as "native.help")}
          </h2>
          <nav className="surface divide-y divide-base-300">
            {items.map(({ path, key }) => (
              <Link
                key={path}
                to={path}
                className="flex min-h-12 items-center justify-between gap-3 px-4 py-3"
              >
                <span>{t(key)}</span>
                <ChevronRight className="h-4 w-4 text-base-content/50" />
              </Link>
            ))}
          </nav>
        </section>
      ))}
      {user?.roles?.includes("admin") && (
        <Link to="/admin" className="btn w-full">
          {t("titles.admin")}
        </Link>
      )}
      {mutation.error && (
        <p className="text-error text-sm" role="alert">
          {getApiErrorMessage(mutation.error)}
        </p>
      )}
      <Button
        appearance="outline"
        block
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <LogOut className="h-5 w-5" />
        {t("native.signOut")}
      </Button>
    </section>
  );
}
