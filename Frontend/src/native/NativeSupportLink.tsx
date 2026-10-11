import { Heart } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function NativeSupportLink() {
  const { t } = useTranslation("nav");
  const { pathname, search } = useLocation();

  return (
    <Link
      to="/support"
      state={{ nativeFrom: `${pathname}${search}` }}
      aria-label={t("native.supportTitle")}
      title={t("native.supportTitle")}
      className="btn btn-ghost btn-sm btn-square"
    >
      <Heart className="h-5 w-5 text-secondary" aria-hidden="true" />
    </Link>
  );
}
