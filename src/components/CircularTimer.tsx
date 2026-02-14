import { useState } from 'react';

interface CircularTimerProps {
  /** Progress value from 0 to 100 */
  progress: number;
  /** Size of the timer in pixels */
  size?: number;
  /** Stroke width of the circle */
  strokeWidth?: number;
  /** Whether to animate counter-clockwise (default: false = clockwise) */
  counterClockwise?: boolean;
  /** Whether the timer is paused (changes color) */
  isPaused?: boolean;
  /** Optional text to display in the center */
  centerText?: string | number;
  /** Optional CSS class name */
  className?: string;
}

export const CircularTimer = ({
  progress,
  size = 32,
  strokeWidth = 3,
  counterClockwise = false,
  isPaused = false,
  centerText,
  className = '',
}: CircularTimerProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress / 100);

  // Track previous progress to detect cycle reset (jump from low to high)
  const [prevProgress, setPrevProgress] = useState(progress);
  const [skipTransition, setSkipTransition] = useState(false);

  if (progress !== prevProgress) {
    setSkipTransition(progress - prevProgress > 50);
    setPrevProgress(progress);
  }

  // Fade effect: fade out when progress is low, fade in after reset
  // Below 15%, opacity decreases linearly to 0
  const FADE_THRESHOLD = 15;
  const opacity = progress < FADE_THRESHOLD ? progress / FADE_THRESHOLD : 1;

  // Transition: always animate opacity for smooth fade effect
  // Only animate stroke-dashoffset during normal countdown (not on reset)
  const transition = skipTransition
    ? 'opacity 0.15s ease-out'
    : 'stroke-dashoffset 0.3s ease-out, opacity 0.15s ease-out';

  // SVG strokes are drawn clockwise. With strokeDashoffset, the stroke disappears
  // from the END of the path. By starting at 12 o'clock (rotate -90), the end is
  // just before 12 o'clock, so the stroke depletes counter-clockwise from 12 o'clock.
  // For clockwise filling, we flip vertically to reverse the direction while keeping
  // the 12 o'clock start position.
  const centerX = size / 2;
  const centerY = size / 2;
  const transform = counterClockwise
    ? `rotate(-90 ${centerX} ${centerY})`
    : `rotate(-90 ${centerX} ${centerY}) translate(${centerX}, ${centerY}) scale(1, -1) translate(${-centerX}, ${-centerY})`;

  // Use slightly larger viewBox to prevent clipping of stroke
  const viewBoxSize = size + 1;

  return (
    <div
      className={`circular-timer ${isPaused ? 'circular-timer--paused' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} width={size} height={size}>
        {/* Background circle */}
        <circle
          className="circular-timer__bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-circular-stroke)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          className="circular-timer__progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isPaused ? 'var(--circular-stroke-paused)' : 'var(--circular-stroke)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={transform}
          style={{ opacity, transition }}
        />
      </svg>
      {centerText !== undefined && (
        <span className="circular-timer__text">{centerText}</span>
      )}
    </div>
  );
};
