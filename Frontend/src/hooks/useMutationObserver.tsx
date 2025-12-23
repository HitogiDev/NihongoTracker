import { useEffect } from 'react';

function useMutationObserver(
  ref: React.RefObject<HTMLElement>,
  callback: MutationCallback,
  options: {
    attributes?: boolean;
    characterData?: boolean;
    childList?: boolean;
    subtree?: boolean;
  } = {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  }
) {
  useEffect(() => {
    if (ref.current) {
      const observer = new MutationObserver(callback);
      observer.observe(ref.current, options);
      return () => observer.disconnect();
    }
  }, [callback, options, ref]);
}

export default useMutationObserver;
