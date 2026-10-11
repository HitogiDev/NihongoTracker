import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  ExternalLink,
  Gamepad2,
  Headphones,
  Heart,
  Plus,
  Trophy,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";
import { buttonClass } from "../components/ui/buttons";
import { PATREON_URL, SUPPORT_PLANS } from "../constants/supportPlans";
import {
  ONBOARDING_STEP_COUNT,
  useNativeOnboardingStore,
} from "./onboardingStore";

const SCREENS = ["welcome", "logs", "progress", "plans"] as const;

export default function NativeOnboarding({ account }: { account: string }) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const step = useNativeOnboardingStore((store) => store.steps[account] ?? 0);
  const setStep = useNativeOnboardingStore((store) => store.setStep);
  const finish = useNativeOnboardingStore((store) => store.finish);
  const content = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const screen = SCREENS[step] ?? "welcome";
  const last = step === ONBOARDING_STEP_COUNT - 1;
  const complete = useCallback(() => {
    finish(account);
    navigate("/", { replace: true });
  }, [account, finish, navigate]);

  useEffect(() => {
    const back = (event: Event) => {
      event.preventDefault();
      if (step > 0) setStep(account, step - 1);
      else complete();
    };
    window.addEventListener("nihongo:native-back", back);
    return () => window.removeEventListener("nihongo:native-back", back);
  }, [account, step, setStep, complete]);

  useLayoutEffect(() => {
    if (content.current) content.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  return (
    <div className="native-shell native-onboarding bg-base-200 text-base-content">
      <header className="native-header shrink-0 bg-base-100">
        <div className="flex min-h-14 items-center gap-2 px-3">
          {step > 0 && (
            <Button
              appearance="ghost"
              size="sm"
              shape="square"
              aria-label={t("native.back")}
              onClick={() => setStep(account, step - 1)}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}
          <span className="min-w-0 flex-1 truncate font-semibold">
            NihongoTracker
          </span>
          <Button appearance="ghost" size="sm" onClick={complete}>
            {t("onboarding.skip")}
          </Button>
        </div>
      </header>

      <main
        ref={content}
        className="native-content min-h-0 flex-1 overflow-y-auto"
        aria-labelledby="native-onboarding-title"
      >
        <section
          className={
            last
              ? "mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-4"
              : "mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6"
          }
        >
          <div className="space-y-2">
            <p className="text-xs font-medium text-base-content/60">
              {t("onboarding.step", {
                current: step + 1,
                total: ONBOARDING_STEP_COUNT,
              })}
            </p>
            <progress
              className="progress progress-primary h-1 w-full"
              value={step + 1}
              max={ONBOARDING_STEP_COUNT}
              aria-label={t("onboarding.step", {
                current: step + 1,
                total: ONBOARDING_STEP_COUNT,
              })}
            />
          </div>

          <div
            className={last ? "space-y-2 text-center" : "space-y-3 text-center"}
          >
            {screen === "welcome" ? (
              <img
                src="/favicon.png"
                alt=""
                className="mx-auto h-20 w-20 rounded-box"
              />
            ) : (
              <div
                className={
                  last
                    ? "mx-auto grid h-12 w-12 place-items-center rounded-box bg-primary/10 text-primary"
                    : "mx-auto grid h-20 w-20 place-items-center rounded-box bg-primary/10 text-primary"
                }
                aria-hidden="true"
              >
                {screen === "logs" && <Plus className="h-10 w-10" />}
                {screen === "progress" && <Trophy className="h-10 w-10" />}
                {screen === "plans" && <Heart className="h-6 w-6" />}
              </div>
            )}
            <h1
              id="native-onboarding-title"
              ref={heading}
              tabIndex={-1}
              className="text-2xl font-bold outline-none"
            >
              {t(`onboarding.${screen}.title`)}
            </h1>
            <p className="text-base-content/70">
              {t(`onboarding.${screen}.description`)}
            </p>
          </div>

          {screen === "welcome" && (
            <div className="surface space-y-4 p-5">
              <div
                className="flex justify-center gap-4 text-primary"
                aria-hidden="true"
              >
                <BookOpen className="h-8 w-8" />
                <Headphones className="h-8 w-8" />
                <Gamepad2 className="h-8 w-8" />
              </div>
              <p className="text-center font-medium">
                {t("onboarding.welcome.media")}
              </p>
              <p className="text-center text-sm text-base-content/65">
                {t("onboarding.welcome.hint")}
              </p>
            </div>
          )}

          {screen === "logs" && (
            <>
              <div className="surface space-y-4 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  {t("onboarding.logs.example")}
                </p>
                <div className="flex items-center gap-3">
                  <Headphones
                    className="h-8 w-8 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {t("onboarding.logs.session")}
                    </p>
                    <p className="text-sm text-base-content/65">
                      {t("onboarding.logs.duration")}
                    </p>
                  </div>
                  <span className="badge badge-primary shrink-0">+ XP</span>
                </div>
              </div>
              <p className="text-center text-sm text-base-content/65">
                {t("onboarding.logs.hint")}
              </p>
            </>
          )}

          {screen === "progress" && (
            <div className="space-y-3">
              {(
                [
                  { id: "goals", icon: CalendarCheck },
                  { id: "ranking", icon: Trophy },
                  { id: "clubs", icon: Users },
                ] as const
              ).map(({ id, icon: Icon }) => (
                <div key={id} className="surface flex items-start gap-3 p-4">
                  <Icon
                    className="h-6 w-6 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {t(`onboarding.progress.${id}Title`)}
                    </p>
                    <p className="text-sm text-base-content/65">
                      {t(`onboarding.progress.${id}Description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {screen === "plans" && (
            <div className="space-y-3">
              {SUPPORT_PLANS.map((plan) => (
                <section key={plan.id} className="surface space-y-2 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 className="min-w-0 font-semibold">{plan.name}</h2>
                    <p className="text-sm font-semibold text-primary">
                      {t("onboarding.plans.price", { price: plan.price })}
                    </p>
                  </div>
                  <p className="text-sm text-base-content/65">
                    {t(`onboarding.plans.${plan.id}`)}
                  </p>
                </section>
              ))}
              <p className="text-center text-xs text-base-content/60">
                {t("onboarding.plans.hint")}
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="native-onboarding-actions shrink-0 bg-base-100">
        <div className="mx-auto max-w-md space-y-2">
          {last ? (
            <>
              <a
                href={PATREON_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({ variant: "primary", block: true })}
              >
                <Heart className="h-5 w-5" aria-hidden="true" />
                {t("onboarding.plans.support")}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <Button appearance="ghost" block onClick={complete}>
                {t("onboarding.plans.continueFree")}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              block
              onClick={() => setStep(account, step + 1)}
            >
              {t("onboarding.next")}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
