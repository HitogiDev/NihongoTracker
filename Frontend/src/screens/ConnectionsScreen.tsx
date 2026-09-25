import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getConnectionsFn } from "../api/trackerApi";
import { useState } from "react";
import { getAvatarInitials } from "../utils/avatar";

interface ConnectionsScreenProps {
  direction: "followers" | "following";
}

const PAGE_SIZE = 20;

export default function ConnectionsScreen({
  direction,
}: ConnectionsScreenProps) {
  const { username = "" } = useParams<{ username: string }>();
  const { t } = useTranslation("profile");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["connections", username, direction, page],
    queryFn: () => getConnectionsFn(username, direction, page, PAGE_SIZE),
  });
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <main className="mx-auto min-h-96 w-full max-w-3xl px-4 py-8">
      <div className="surface p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">
              {direction === "followers"
                ? t("social.followersTitle", { username })
                : t("social.followingTitle", { username })}
            </h2>
            {!isLoading && !isError && (
              <p className="text-sm text-base-content/60">
                {t("social.peopleCount", { count: data?.total ?? 0 })}
              </p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="alert alert-error">
            <span>{t("social.loadError")}</span>
            <button className="btn btn-sm" onClick={() => void refetch()}>
              {t("social.retry")}
            </button>
          </div>
        ) : data?.users.length ? (
          <>
            <ul className="list">
              {data.users.map((person) => (
                <li key={person._id} className="list-row px-0">
                  <div className="avatar avatar-placeholder">
                    <div className="w-11 rounded-full bg-base-300">
                      {person.avatar ? (
                        <img
                          src={person.avatar}
                          alt={t("header.avatarAlt", {
                            username: person.username,
                          })}
                        />
                      ) : (
                        <span>{getAvatarInitials(person.username)}</span>
                      )}
                    </div>
                  </div>
                  <div className="list-col-grow self-center">
                    <Link
                      to={`/user/${encodeURIComponent(person.username)}`}
                      className="link link-hover font-medium"
                    >
                      {person.username}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  className="btn btn-ghost btn-sm btn-square"
                  aria-label={t("social.previousPage")}
                  disabled={page === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-base-content/70">
                  {t("social.page", { page, totalPages })}
                </span>
                <button
                  className="btn btn-ghost btn-sm btn-square"
                  aria-label={t("social.nextPage")}
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="py-10 text-center text-base-content/60">
            {direction === "followers"
              ? t("social.noFollowers")
              : t("social.noFollowing")}
          </p>
        )}
      </div>
    </main>
  );
}
