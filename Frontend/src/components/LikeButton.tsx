import { useState, useRef } from 'react';
import { ThumbsUp } from 'lucide-react';

interface LikeButtonProps {
  isLiked: boolean;
  likesCount: number;
  onToggleLike: () => void;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export default function LikeButton({
  isLiked,
  likesCount,
  onToggleLike,
  disabled = false,
  size = 'sm',
}: LikeButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (disabled || isAnimating) return;

    setIsAnimating(true);

    if (!isLiked) {
      createParticles();
    }

    onToggleLike();

    setTimeout(() => setIsAnimating(false), 300);
  };

  function createParticles({
    particleCount = 8,
  }: { particleCount?: number } = {}) {
    if (!buttonRef.current) return;

    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    const buttonCenterX = rect.left + rect.width / 2;
    const buttonCenterY = rect.top + rect.height / 2;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');

      // Create colored dot particles
      const colors = ['#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b'];
      const color = colors[i % colors.length];

      // Style the particle as a colored dot
      Object.assign(particle.style, {
        position: 'fixed',
        left: `${buttonCenterX}px`,
        top: `${buttonCenterY}px`,
        width: `${6 + Math.random() * 4}px`,
        height: `${6 + Math.random() * 4}px`,
        backgroundColor: color,
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: '9999',
        transform: 'translate(-50%, -50%)',
        boxShadow: `0 0 6px ${color}`,
      });

      document.body.appendChild(particle);

      // Animate particle with random trajectory
      const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 25 + Math.random() * 25;
      const finalX = buttonCenterX + Math.cos(angle) * distance;
      const finalY = buttonCenterY + Math.sin(angle) * distance - 15;

      const animation = particle.animate(
        [
          {
            transform: 'translate(-50%, -50%) scale(0) rotate(0deg)',
            opacity: '0',
          },
          {
            transform: 'translate(-50%, -50%) scale(1) rotate(180deg)',
            opacity: '1',
            offset: 0.2,
          },
          {
            transform: `translate(${finalX - buttonCenterX}px, ${finalY - buttonCenterY}px) translate(-50%, -50%) scale(1.2) rotate(360deg)`,
            opacity: '1',
            offset: 0.8,
          },
          {
            transform: `translate(${finalX - buttonCenterX}px, ${finalY - buttonCenterY}px) translate(-50%, -50%) scale(0) rotate(360deg)`,
            opacity: '0',
          },
        ],
        {
          duration: 400 + Math.random() * 100,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }
      );

      animation.addEventListener('finish', () => {
        if (document.body.contains(particle)) {
          document.body.removeChild(particle);
        }
      });
    }
  }

  return (
    <button
      ref={buttonRef}
      className={`btn btn-${size} transition-all duration-300 ${
        isLiked ? 'btn-primary' : 'btn-ghost'
      } ${isAnimating ? 'scale-110' : 'hover:scale-105'} relative overflow-visible`}
      onClick={handleClick}
      disabled={disabled}
    >
      <div
        className={`flex items-center transition-all duration-300 ${
          isAnimating && isLiked ? 'animate-bounce' : ''
        } ${isAnimating && !isLiked ? 'animate-pulse' : ''}`}
      >
        <div
          className={`transition-transform duration-200 ${
            isAnimating ? (isLiked ? 'scale-125 rotate-12' : 'scale-110') : ''
          }`}
        >
          {isLiked ? (
            <ThumbsUp className="mr-1 text-white" />
          ) : (
            <ThumbsUp className="mr-1" />
          )}
        </div>
        <span
          className={`transition-all duration-300 font-medium ${
            isLiked ? 'text-white' : ''
          } ${isAnimating && isLiked ? 'animate-pulse font-bold' : ''}`}
        >
          {likesCount}
        </span>
      </div>
    </button>
  );
}
