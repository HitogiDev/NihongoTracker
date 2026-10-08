import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function NativeAuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("nav");
  return (
    <section className="native-auth mx-auto w-full max-w-md px-5 py-8">
      <div className="mb-7 space-y-2">
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="text-base-content/70">{subtitle}</p>
      </div>
      {children}
      <nav
        className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 text-sm text-base-content/65"
        aria-label={t("native.legal")}
      >
        <Link className="link link-hover" to="/terms">
          {t("titles.terms")}
        </Link>
        <Link className="link link-hover" to="/privacy">
          {t("titles.privacy")}
        </Link>
        <Link className="link link-hover" to="/support">
          {t("titles.support")}
        </Link>
      </nav>
    </section>
  );
}
