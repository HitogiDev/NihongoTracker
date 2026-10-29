import { Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserDataStore } from "../store/userData";
import { nativeRoute } from "./navigation";

/**
 * Keep the create action within reach on Records. Other tabs keep their row
 * actions free, and Home shows its own create button.
 */
export default function NativeFab() {
  const { t } = useTranslation("nav");
  const { pathname, search } = useLocation();
  const user = useUserDataStore((store) => store.user);
  const route = nativeRoute(pathname, search, user?.username);
  if (!user || route.tab !== "records" || !route.primary)
    return null;
  return (
    <Link
      to="/log"
      state={{ nativeFrom: `${pathname}${search}` }}
      className="native-floating-action btn btn-primary btn-circle shadow-lg"
      aria-label={t("native.createLog")}
    >
      <Plus className="h-6 w-6" />
    </Link>
  );
}
