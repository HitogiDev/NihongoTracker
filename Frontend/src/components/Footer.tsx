import { FilePlus, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useUserDataStore } from '../store/userData';
import LanguageSwitcher from './LanguageSwitcher';

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 fill-current"
      viewBox="0 0 24 24"
    >
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.84 1.23 1.84 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.6-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 fill-current"
      viewBox="0 0 24 24"
    >
      <path d="M19.54 3.2A16.8 16.8 0 0 0 15.4 1.93l-.5 1.02a15.5 15.5 0 0 0-5.8 0l-.5-1.02A16.8 16.8 0 0 0 4.46 3.2C1.84 7.1 1.13 10.9 1.48 14.65a16.9 16.9 0 0 0 5.1 2.58l1.23-1.67c-.68-.25-1.33-.56-1.94-.93l.48-.37c3.74 1.75 7.78 1.75 11.48 0l.48.37c-.61.37-1.26.68-1.94.93l1.23 1.67a16.9 16.9 0 0 0 5.1-2.58c.41-4.35-.7-8.12-2.96-11.45ZM8.73 13.1c-1.12 0-2.04-1.03-2.04-2.3 0-1.27.9-2.3 2.04-2.3 1.14 0 2.06 1.03 2.04 2.3 0 1.27-.9 2.3-2.04 2.3Zm6.54 0c-1.12 0-2.04-1.03-2.04-2.3 0-1.27.9-2.3 2.04-2.3 1.14 0 2.06 1.03 2.04 2.3 0 1.27-.9 2.3-2.04 2.3Z" />
    </svg>
  );
}

function Footer() {
  const { t } = useTranslation('nav');
  const { user } = useUserDataStore();

  return (
    <footer className="footer footer-vertical sm:footer-horizontal mt-auto border-t border-base-300 bg-base-300 p-10 text-base-content">
      <aside className="max-w-xs">
        <p className="text-xl font-bold">NihongoTracker</p>
        <p className="mt-2 text-sm text-base-content/70">
          © {new Date().getFullYear()} NihongoTracker
        </p>
        <p className="mt-3 text-sm text-base-content/70">
          {t('footer.dataProvidedBy')}{' '}
          <a
            href="https://anilist.co"
            target="_blank"
            rel="noreferrer"
            className="link link-hover"
          >
            AniList
          </a>{' '}
          {t('footer.and')}{' '}
          <a
            href="https://vndb.org"
            target="_blank"
            rel="noreferrer"
            className="link link-hover"
          >
            VNDB
          </a>
          .
        </p>
      </aside>

      <nav>
        <h6 className="footer-title">{t('footer.legal')}</h6>
        <Link to="/guidelines" className="link link-hover">
          {t('footer.guidelines')}
        </Link>
        <Link to="/privacy" className="link link-hover">
          {t('footer.privacy')}
        </Link>
        <Link to="/terms" className="link link-hover">
          {t('footer.terms')}
        </Link>
        <Link to="/refund-policy" className="link link-hover">
          {t('footer.refund')}
        </Link>
      </nav>

      <nav>
        <h6 className="footer-title">{t('footer.explore')}</h6>
        <Link to="/" className="link link-hover">
          {t('links.home')}
        </Link>
        <Link to="/features" className="link link-hover">
          {t('links.features')}
        </Link>
        <Link to="/calculator" className="link link-hover">
          {t('links.calculator')}
        </Link>
        <Link to="/changelog" className="link link-hover">
          {t('footer.changelog')}
        </Link>
      </nav>

      <nav>
        <h6 className="footer-title">{t('footer.community')}</h6>
        <Link to="/ranking" className="link link-hover">
          {t('links.ranking')}
        </Link>
        <Link to="/clubs" className="link link-hover">
          {t('links.clubs')}
        </Link>
        <Link to="/recommendations" className="link link-hover">
          {t('links.recommendations')}
        </Link>
        {user && (
          <Link
            to="/media-request"
            className="link link-hover flex items-center gap-2"
          >
            <FilePlus className="h-4 w-4" />
            {t('footer.requestMedia')}
          </Link>
        )}
      </nav>

      <nav>
        <h6 className="footer-title">{t('footer.connect')}</h6>
        <Link to="/support" className="link link-hover flex items-center gap-2">
          <Heart className="h-4 w-4" />
          {t('footer.support')}
        </Link>
        <a
          href="https://discord.gg/6QtXrVdwmx"
          target="_blank"
          rel="noreferrer"
          className="link link-hover flex items-center gap-2"
        >
          <DiscordIcon />
          {t('footer.discord')}
        </a>
        <a
          href="https://github.com/ElaxDev/NihongoTracker"
          target="_blank"
          rel="noreferrer"
          className="link link-hover flex items-center gap-2"
        >
          <GitHubIcon />
          {t('footer.github')}
        </a>
        <LanguageSwitcher
          className="dropdown-top dropdown-end"
          buttonClassName="btn btn-ghost btn-sm justify-start gap-2 px-0 font-medium"
          showLabel
        />
      </nav>
    </footer>
  );
}

export default Footer;
