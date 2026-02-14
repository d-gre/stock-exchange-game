import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CircularTimer } from './CircularTimer';

describe('CircularTimer', () => {
  describe('rendering', () => {
    it('should render SVG with correct size', () => {
      const { container } = render(<CircularTimer progress={50} size={40} />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '40');
      expect(svg).toHaveAttribute('height', '40');
    });

    it('should render background and progress circles', () => {
      const { container } = render(<CircularTimer progress={50} />);

      const circles = container.querySelectorAll('circle');
      expect(circles).toHaveLength(2);
      expect(circles[0]).toHaveClass('circular-timer__bg');
      expect(circles[1]).toHaveClass('circular-timer__progress');
    });

    it('should render center text when provided', () => {
      render(<CircularTimer progress={50} centerText="5s" />);

      expect(screen.getByText('5s')).toBeInTheDocument();
    });

    it('should not render center text when not provided', () => {
      const { container } = render(<CircularTimer progress={50} />);

      const textSpan = container.querySelector('.circular-timer__text');
      expect(textSpan).not.toBeInTheDocument();
    });

    it('should apply paused class when isPaused is true', () => {
      const { container } = render(<CircularTimer progress={50} isPaused={true} />);

      const timer = container.querySelector('.circular-timer');
      expect(timer).toHaveClass('circular-timer--paused');
    });

    it('should apply custom className', () => {
      const { container } = render(<CircularTimer progress={50} className="custom-class" />);

      const timer = container.querySelector('.circular-timer');
      expect(timer).toHaveClass('custom-class');
    });
  });

  describe('progress calculation', () => {
    it('should have full stroke at 100% progress', () => {
      const { container } = render(<CircularTimer progress={100} size={32} strokeWidth={3} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      // At 100%, strokeDashoffset should be 0
      expect(progressCircle).toHaveAttribute('stroke-dashoffset', '0');
    });

    it('should have no stroke at 0% progress', () => {
      const { container } = render(<CircularTimer progress={0} size={32} strokeWidth={3} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      // At 0%, strokeDashoffset should equal circumference
      const radius = (32 - 3) / 2;
      const circumference = 2 * Math.PI * radius;
      expect(progressCircle).toHaveAttribute('stroke-dashoffset', circumference.toString());
    });

    it('should have half stroke at 50% progress', () => {
      const { container } = render(<CircularTimer progress={50} size={32} strokeWidth={3} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      const radius = (32 - 3) / 2;
      const circumference = 2 * Math.PI * radius;
      const expectedOffset = circumference * 0.5;
      expect(progressCircle).toHaveAttribute('stroke-dashoffset', expectedOffset.toString());
    });
  });

  describe('transition behavior', () => {
    it('should have full transition enabled for normal progress changes', () => {
      const { container, rerender } = render(<CircularTimer progress={80} />);

      // Small decrease (normal countdown)
      rerender(<CircularTimer progress={70} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      expect(progressCircle).toHaveStyle({ transition: 'stroke-dashoffset 0.3s ease-out, opacity 0.15s ease-out' });
    });

    it('should skip stroke transition on cycle reset (large positive jump)', () => {
      const { container, rerender } = render(<CircularTimer progress={10} />);

      // Large positive jump (cycle reset: 10% -> 100%)
      rerender(<CircularTimer progress={100} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      // On reset: only opacity transition (for fade-in effect), no stroke-dashoffset transition
      expect(progressCircle).toHaveStyle({ transition: 'opacity 0.15s ease-out' });
    });

    it('should restore full transition after cycle reset', () => {
      const { container, rerender } = render(<CircularTimer progress={10} />);

      // Large positive jump (cycle reset)
      rerender(<CircularTimer progress={100} />);

      // Normal decrease after reset
      rerender(<CircularTimer progress={90} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      expect(progressCircle).toHaveStyle({ transition: 'stroke-dashoffset 0.3s ease-out, opacity 0.15s ease-out' });
    });

    it('should not skip stroke transition for small positive changes', () => {
      const { container, rerender } = render(<CircularTimer progress={50} />);

      // Small positive jump (within threshold)
      rerender(<CircularTimer progress={55} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      expect(progressCircle).toHaveStyle({ transition: 'stroke-dashoffset 0.3s ease-out, opacity 0.15s ease-out' });
    });
  });

  describe('opacity fade effect', () => {
    it('should have full opacity at high progress', () => {
      const { container } = render(<CircularTimer progress={100} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      expect(progressCircle).toHaveStyle({ opacity: '1' });
    });

    it('should have full opacity above fade threshold (15%)', () => {
      const { container } = render(<CircularTimer progress={20} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      expect(progressCircle).toHaveStyle({ opacity: '1' });
    });

    it('should have reduced opacity below fade threshold', () => {
      const { container } = render(<CircularTimer progress={7.5} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      // 7.5 / 15 = 0.5
      expect(progressCircle).toHaveStyle({ opacity: '0.5' });
    });

    it('should have zero opacity at 0% progress', () => {
      const { container } = render(<CircularTimer progress={0} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      expect(progressCircle).toHaveStyle({ opacity: '0' });
    });
  });

  describe('stroke color', () => {
    it('should use accent color', () => {
      const { container } = render(<CircularTimer progress={50} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      expect(progressCircle).toHaveAttribute('stroke', 'var(--circular-stroke)');
    });

    it('should use muted color when paused', () => {
      const { container } = render(<CircularTimer progress={50} isPaused={true} />);

      const progressCircle = container.querySelector('.circular-timer__progress');
      expect(progressCircle).toHaveAttribute('stroke', 'var(--circular-stroke-paused)');
    });
  });
});
