import { IconContext } from 'react-icons';
import { FaGithub } from 'react-icons/fa6';

function Footer() {
  return (
    <footer className="footer items-center p-4 bg-base-100 text-base-content flex flex-col md:flex-row justify-between mt-auto">
      <aside className="items-center grid-flow-col">
        <p className="text-base-content">
          Copyright © {new Date().getFullYear()} - All rights reserved
        </p>
      </aside>
      <nav className="grid-flow-col gap-4 md:place-self-center md:justify-self-end">
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
