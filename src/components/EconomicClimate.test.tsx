import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EconomicClimate } from './EconomicClimate';
import type { MarketPhase, Sector } from '../types';

// Mock i18next - imports actual i18n from setup
import '../test/setup';

const defaultSectorPhases: Record<Sector, MarketPhase> = {
  tech: 'prosperity',
  finance: 'prosperity',
  industrial: 'prosperity',
  commodities: 'prosperity',
};

describe('EconomicClimate', () => {
  describe('rendering', () => {
    it('should render the title', () => {
      render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={50}
        />
      );
      // German translation
      expect(screen.getByText('Wirtschaftsklima')).toBeInTheDocument();
    });

    it('should render fear & greed index label', () => {
      render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={50}
        />
      );
      expect(screen.getByText('Fear & Greed Index')).toBeInTheDocument();
    });

    it('should render fear & greed description', () => {
      render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={50}
        />
      );
      // German translation
      expect(screen.getByText(/Misst die Marktstimmung/)).toBeInTheDocument();
    });

    it('should render global phase label', () => {
      render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={50}
        />
      );
      expect(screen.getByText('Globale Phase')).toBeInTheDocument();
    });

    it('should render sector phases label', () => {
      render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={50}
        />
      );
      expect(screen.getByText('Sektorphasen')).toBeInTheDocument();
    });

    it('should render all four sectors', () => {
      render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={50}
        />
      );
      expect(screen.getByText('Tech')).toBeInTheDocument();
      expect(screen.getByText('Finanz')).toBeInTheDocument();
      expect(screen.getByText('Industrie')).toBeInTheDocument();
      expect(screen.getByText('Rohstoffe')).toBeInTheDocument();
    });
  });

  describe('fear & greed index display', () => {
    it('should display the fear/greed value', () => {
      render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={75}
        />
      );
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('should show extreme fear level for index <= 25', () => {
      render(
        <EconomicClimate
          globalPhase="panic"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={15}
        />
      );
      expect(screen.getByText('Extreme Angst')).toBeInTheDocument();
    });

    it('should show fear level for index 26-45', () => {
      render(
        <EconomicClimate
          globalPhase="consolidation"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={35}
        />
      );
      expect(screen.getByText('Angst')).toBeInTheDocument();
    });

    it('should show neutral level for index 46-55', () => {
      render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={50}
        />
      );
      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });

    it('should show greed level for index 56-75', () => {
      render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={65}
        />
      );
      expect(screen.getByText('Gier')).toBeInTheDocument();
    });

    it('should show extreme greed level for index > 75', () => {
      render(
        <EconomicClimate
          globalPhase="boom"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={90}
        />
      );
      expect(screen.getByText('Extreme Gier')).toBeInTheDocument();
    });

    it('should set correct bar width based on index', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={60}
        />
      );
      const bar = container.querySelector('.economic-climate__fear-greed-bar');
      expect(bar).toHaveStyle({ width: '60%' });
    });
  });

  describe('fear & greed bar modifiers', () => {
    it('should apply extremeFear modifier for index <= 25', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="panic"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={20}
        />
      );
      const bar = container.querySelector('.economic-climate__fear-greed-bar--extremeFear');
      expect(bar).toBeInTheDocument();
    });

    it('should apply fear modifier for index 26-45', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="consolidation"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={40}
        />
      );
      const bar = container.querySelector('.economic-climate__fear-greed-bar--fear');
      expect(bar).toBeInTheDocument();
    });

    it('should apply neutral modifier for index 46-55', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={50}
        />
      );
      const bar = container.querySelector('.economic-climate__fear-greed-bar--neutral');
      expect(bar).toBeInTheDocument();
    });

    it('should apply greed modifier for index 56-75', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={70}
        />
      );
      const bar = container.querySelector('.economic-climate__fear-greed-bar--greed');
      expect(bar).toBeInTheDocument();
    });

    it('should apply extremeGreed modifier for index > 75', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="boom"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={85}
        />
      );
      const bar = container.querySelector('.economic-climate__fear-greed-bar--extremeGreed');
      expect(bar).toBeInTheDocument();
    });
  });

  describe('global phase display', () => {
    it('should display prosperity phase badge', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={50}
        />
      );
      // Multiple "Prosperität" badges exist (global + sectors), check via container
      const globalBadge = container.querySelector('.economic-climate__global-phase .economic-climate__phase-badge--prosperity');
      expect(globalBadge).toBeInTheDocument();
      expect(globalBadge).toHaveTextContent('Prosperität');
    });

    it('should display boom phase badge', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="boom"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={80}
        />
      );
      expect(screen.getByText('Boom')).toBeInTheDocument();
      const badge = container.querySelector('.economic-climate__phase-badge--boom');
      expect(badge).toBeInTheDocument();
    });

    it('should display consolidation phase badge', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="consolidation"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={40}
        />
      );
      expect(screen.getByText('Konsolidierung')).toBeInTheDocument();
      const badge = container.querySelector('.economic-climate__phase-badge--consolidation');
      expect(badge).toBeInTheDocument();
    });

    it('should display panic phase badge', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="panic"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={15}
        />
      );
      expect(screen.getByText('Panik')).toBeInTheDocument();
      const badge = container.querySelector('.economic-climate__phase-badge--panic');
      expect(badge).toBeInTheDocument();
    });

    it('should display recession phase badge', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="recession"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={30}
        />
      );
      expect(screen.getByText('Rezession')).toBeInTheDocument();
      const badge = container.querySelector('.economic-climate__phase-badge--recession');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('sector phase display', () => {
    it('should display different phases for different sectors', () => {
      const mixedSectorPhases: Record<Sector, MarketPhase> = {
        tech: 'boom',
        finance: 'consolidation',
        industrial: 'prosperity',
        commodities: 'recession',
      };

      const { container } = render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={mixedSectorPhases}
          fearGreedIndex={50}
        />
      );

      // Check that sector badges have correct modifiers
      const sectorItems = container.querySelectorAll('.economic-climate__sector-item');
      expect(sectorItems).toHaveLength(4);

      // Each sector should have a badge with --small modifier
      const smallBadges = container.querySelectorAll('.economic-climate__phase-badge--small');
      expect(smallBadges).toHaveLength(4);
    });

    it('should render sector items in correct order', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={50}
        />
      );

      const sectorNames = container.querySelectorAll('.economic-climate__sector-name');
      expect(sectorNames[0]).toHaveTextContent('Tech');
      expect(sectorNames[1]).toHaveTextContent('Finanz');
      expect(sectorNames[2]).toHaveTextContent('Industrie');
      expect(sectorNames[3]).toHaveTextContent('Rohstoffe');
    });
  });

  describe('boundary conditions', () => {
    it('should handle fearGreedIndex of 0', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="panic"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={0}
        />
      );
      expect(screen.getByText('0')).toBeInTheDocument();
      const bar = container.querySelector('.economic-climate__fear-greed-bar');
      expect(bar).toHaveStyle({ width: '0%' });
    });

    it('should handle fearGreedIndex of 100', () => {
      const { container } = render(
        <EconomicClimate
          globalPhase="boom"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={100}
        />
      );
      expect(screen.getByText('100')).toBeInTheDocument();
      const bar = container.querySelector('.economic-climate__fear-greed-bar');
      expect(bar).toHaveStyle({ width: '100%' });
    });

    it('should handle fearGreedIndex at level boundaries (25, 45, 55, 75)', () => {
      // Test boundary values
      const { rerender, container } = render(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={25}
        />
      );
      expect(container.querySelector('.economic-climate__fear-greed-bar--extremeFear')).toBeInTheDocument();

      rerender(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={45}
        />
      );
      expect(container.querySelector('.economic-climate__fear-greed-bar--fear')).toBeInTheDocument();

      rerender(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={55}
        />
      );
      expect(container.querySelector('.economic-climate__fear-greed-bar--neutral')).toBeInTheDocument();

      rerender(
        <EconomicClimate
          globalPhase="prosperity"
          sectorPhases={defaultSectorPhases}
          fearGreedIndex={75}
        />
      );
      expect(container.querySelector('.economic-climate__fear-greed-bar--greed')).toBeInTheDocument();
    });
  });
});
