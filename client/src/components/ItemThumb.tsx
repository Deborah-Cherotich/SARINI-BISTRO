export function ItemThumb({
  imagePath,
  name,
  className = "",
}: {
  imagePath: string | null;
  name: string;
  className?: string;
}) {
  if (imagePath) {
    return (
      <img
        src={imagePath}
        alt={name}
        className={`object-cover bg-black/20 ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-sarini-panel-light text-sarini-yellow/50 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-1/3 h-1/3" stroke="currentColor" strokeWidth="1.5">
        <path
          d="M8 3v6a2 2 0 1 1-4 0V3M6 9v12M16 3c-1.7 0-3 2-3 5s1.3 5 3 5v9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
