import { IconContext } from 'react-icons';
import { FaGithub } from 'react-icons/fa6';
import { MdFavorite } from 'react-icons/md';
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="footer items-center p-4 bg-base-100 text-base-content flex flex-col md:flex-row justify-between mt-auto">
      <aside className="items-center grid-flow-col">
        <p className="text-base-content">
          Copyright © {new Date().getFullYear()} - All rights reserved
        </p>
      </aside>
      <nav className="grid-flow-col gap-4 md:place-self-center md:justify-self-end flex items-center">
        <Link
          to="/privacy"
          className="text-base-content hover:text-primary transition-colors duration-200 text-sm"
        >
          Privacy Policy
        </Link>
        <Link
          to="/terms"
          className="text-sm hover:text-primary transition-colors"
        >
          Terms of Service
        </Link>
        <Link
          to="/support"
          className="flex items-center gap-2 text-base-content hover:text-primary transition-colors duration-200"
        >
          <MdFavorite className="text-xl" />
          <span className="text-sm font-medium">Support</span>
        </Link>
        <IconContext.Provider
          value={{ className: 'text-3xl text-base-content' }}
        >
          <a
            href="https://github.com/ElaxDev/NihongoTracker"
            target="_blank"
            rel="noreferrer"
          >
            <FaGithub />
          </a>
        </IconContext.Provider>
      </nav>
    </footer>
  );
}

export default Footer;
