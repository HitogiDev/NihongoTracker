function Loader({ text }: { text?: string }) {
  return (
    <div className="fixed flex flex-col gap-2 top-0 left-0 justify-center items-center w-full h-full z-50 bg-black/[0.6]">
      <Spinner size="md" className="text-primary" />
      {text && <span className="font-bold text-primary">{text}</span>}
    </div>
  );
}

export default Loader;import Spinner from './ui/Spinner';

