function ProgressBar({
  progress,
  maxProgress,
}: {
  progress?: number;
  maxProgress?: number;
}) {
  return (
    <progress
      className="progress w-full progress-primary"
      value={progress ? progress : 0}
      max={maxProgress ? maxProgress : 100}
    />
  );
}

export default ProgressBar;
