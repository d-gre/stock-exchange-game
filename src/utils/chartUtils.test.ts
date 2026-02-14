import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColorType } from 'lightweight-charts';
import type { IChartApi } from 'lightweight-charts';
import {
  getDefaultChartOptions,
  getChartColors,
  createResizeHandler,
  setupResizeListeners,
} from './chartUtils';

/** Mock chart interface for testing */
interface MockChart {
  applyOptions: ReturnType<typeof vi.fn>;
  timeScale: () => { fitContent: ReturnType<typeof vi.fn> };
  remove?: ReturnType<typeof vi.fn>;
}

describe('chartUtils', () => {
  describe('getChartColors', () => {
    it('should return dark theme colors by default', () => {
      const colors = getChartColors('dark');

      expect(colors.background).toBe('#1a1a2e');
      expect(colors.textColor).toBe('#d1d4dc');
      expect(colors.gridColor).toBe('#2a2a4a');
      expect(colors.borderColor).toBe('#3a3a5a');
      expect(colors.upColor).toBe('#26a69a');
      expect(colors.downColor).toBe('#ef5350');
      expect(colors.lineColor).toBe('#00d4ff');
    });

    it('should return light theme colors', () => {
      const colors = getChartColors('light');

      expect(colors.background).toBe('#ffffff');
      expect(colors.textColor).toBe('#333333');
      expect(colors.gridColor).toBe('#e0e0e0');
      expect(colors.borderColor).toBe('#cccccc');
      expect(colors.upColor).toBe('#198754');
      expect(colors.downColor).toBe('#dc3545');
      expect(colors.lineColor).toBe('#0099cc');
    });

    it('should return area colors for dark theme', () => {
      const colors = getChartColors('dark');

      expect(colors.areaTopColor).toBe('rgba(0, 212, 255, 0.4)');
      expect(colors.areaBottomColor).toBe('rgba(0, 212, 255, 0.0)');
    });

    it('should return area colors for light theme', () => {
      const colors = getChartColors('light');

      expect(colors.areaTopColor).toBe('rgba(0, 153, 204, 0.3)');
      expect(colors.areaBottomColor).toBe('rgba(0, 153, 204, 0.0)');
    });

    it('should return medieval theme colors', () => {
      const colors = getChartColors('medieval');

      expect(colors.background).toBe('rgba(221, 208, 184, 0.2)');
      expect(colors.textColor).toBe('#1a1410');
      expect(colors.gridColor).toBe('#c8b898');
      expect(colors.borderColor).toBe('#8b7355');
      expect(colors.upColor).toBe('#2d5a3d');
      expect(colors.downColor).toBe('#8b2c2c');
      expect(colors.lineColor).toBe('#4a3728');
    });

    it('should return area colors for medieval theme', () => {
      const colors = getChartColors('medieval');

      expect(colors.areaTopColor).toBe('rgba(74, 55, 40, 0.3)');
      expect(colors.areaBottomColor).toBe('rgba(74, 55, 40, 0.0)');
    });
  });

  describe('getDefaultChartOptions', () => {
    it('should return chart options with correct size', () => {
      const options = getDefaultChartOptions({ width: 800, height: 600 });

      expect(options.width).toBe(800);
      expect(options.height).toBe(600);
    });

    it('should include dark theme layout options by default', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 });

      expect(options.layout).toEqual({
        background: { type: ColorType.Solid, color: '#1a1a2e' },
        textColor: '#d1d4dc',
      });
    });

    it('should include light theme layout options when specified', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 }, undefined, 'light');

      expect(options.layout).toEqual({
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333333',
      });
    });

    it('should include medieval theme layout options when specified', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 }, undefined, 'medieval');

      expect(options.layout).toEqual({
        background: { type: ColorType.Solid, color: 'rgba(221, 208, 184, 0.2)' },
        textColor: '#1a1410',
        fontFamily: "'Pirata One', serif",
      });
    });

    it('should include dark theme grid options by default', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 });

      expect(options.grid).toEqual({
        vertLines: { color: '#2a2a4a' },
        horzLines: { color: '#2a2a4a' },
      });
    });

    it('should include light theme grid options when specified', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 }, undefined, 'light');

      expect(options.grid).toEqual({
        vertLines: { color: '#e0e0e0' },
        horzLines: { color: '#e0e0e0' },
      });
    });

    it('should use dark theme border colors by default', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 });

      expect(options.rightPriceScale?.borderColor).toBe('#3a3a5a');
      expect(options.timeScale?.borderColor).toBe('#3a3a5a');
    });

    it('should use light theme border colors when specified', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 }, undefined, 'light');

      expect(options.rightPriceScale?.borderColor).toBe('#cccccc');
      expect(options.timeScale?.borderColor).toBe('#cccccc');
    });

    it('should use default timeScale values when not provided', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 });

      expect(options.timeScale?.borderColor).toBe('#3a3a5a');
      expect(options.timeScale?.timeVisible).toBe(true);
      expect(options.timeScale?.secondsVisible).toBe(false);
    });

    it('should use provided timeScale options', () => {
      const options = getDefaultChartOptions(
        { width: 100, height: 100 },
        { timeVisible: false, secondsVisible: true }
      );

      expect(options.timeScale?.timeVisible).toBe(false);
      expect(options.timeScale?.secondsVisible).toBe(true);
    });

    it('should handle partial timeScale options', () => {
      const options = getDefaultChartOptions(
        { width: 100, height: 100 },
        { timeVisible: false }
      );

      expect(options.timeScale?.timeVisible).toBe(false);
      expect(options.timeScale?.secondsVisible).toBe(false);
    });

    it('should include localization with timeFormatter', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 });

      expect(options.localization).toBeDefined();
      expect(typeof options.localization?.timeFormatter).toBe('function');
    });

    it('should include tickMarkFormatter in timeScale', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 });

      expect(typeof options.timeScale?.tickMarkFormatter).toBe('function');
    });

    it('should format time using local timezone (localization.timeFormatter)', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 });
      const timeFormatter = options.localization?.timeFormatter as (time: number) => string;

      // Test with a known UTC timestamp (e.g., 2024-01-15 12:00:00 UTC = 1705320000)
      const testTimestamp = 1705320000;
      const result = timeFormatter(testTimestamp);

      // The result should be a valid time string (format depends on locale)
      // Just check that it returns a string with time-like content
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Should contain a colon (time separator)
      expect(result).toMatch(/:/);
    });

    it('should format tick marks using local timezone (timeScale.tickMarkFormatter)', () => {
      const options = getDefaultChartOptions({ width: 100, height: 100 });
      const tickMarkFormatter = options.timeScale?.tickMarkFormatter as (time: number) => string;

      // Test with a known UTC timestamp
      const testTimestamp = 1705320000;
      const result = tickMarkFormatter(testTimestamp);

      // The result should be a valid time string
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Should contain a colon (time separator)
      expect(result).toMatch(/:/);
    });
  });

  describe('createResizeHandler', () => {
    const createMockChart = (): MockChart => ({
      applyOptions: vi.fn(),
      timeScale: vi.fn(() => ({
        fitContent: vi.fn(),
      })),
    });

    const createMockContainer = (width: number, height: number) =>
      ({
        clientWidth: width,
        clientHeight: height,
      }) as HTMLDivElement;

    it('should return a function', () => {
      const handler = createResizeHandler({
        container: createMockContainer(800, 600),
        chart: createMockChart() as unknown as IChartApi,
        autoHeight: false,
        fallbackHeight: 400,
      });

      expect(typeof handler).toBe('function');
    });

    it('should use fallbackHeight when autoHeight is false', () => {
      const mockChart = createMockChart();
      const handler = createResizeHandler({
        container: createMockContainer(800, 600),
        chart: mockChart as unknown as IChartApi,
        autoHeight: false,
        fallbackHeight: 400,
      });

      handler();

      expect(mockChart.applyOptions).toHaveBeenCalledWith({
        width: 800,
        height: 400,
      });
    });

    it('should use container height when autoHeight is true', () => {
      const mockChart = createMockChart();
      const handler = createResizeHandler({
        container: createMockContainer(800, 600),
        chart: mockChart as unknown as IChartApi,
        autoHeight: true,
        fallbackHeight: 400,
      });

      handler();

      expect(mockChart.applyOptions).toHaveBeenCalledWith({
        width: 800,
        height: 600,
      });
    });

    it('should use fallbackHeight when autoHeight is true but container height is 0', () => {
      const mockChart = createMockChart();
      const handler = createResizeHandler({
        container: createMockContainer(800, 0),
        chart: mockChart as unknown as IChartApi,
        autoHeight: true,
        fallbackHeight: 400,
      });

      handler();

      expect(mockChart.applyOptions).toHaveBeenCalledWith({
        width: 800,
        height: 400,
      });
    });

    it('should call timeScale().fitContent()', () => {
      const mockFitContent = vi.fn();
      const mockChart: MockChart = {
        applyOptions: vi.fn(),
        timeScale: vi.fn(() => ({
          fitContent: mockFitContent,
        })),
      };
      const handler = createResizeHandler({
        container: createMockContainer(800, 600),
        chart: mockChart as unknown as IChartApi,
        autoHeight: false,
        fallbackHeight: 400,
      });

      handler();

      expect(mockChart.timeScale).toHaveBeenCalled();
      expect(mockFitContent).toHaveBeenCalled();
    });
  });

  describe('setupResizeListeners', () => {
    const mockObserve = vi.fn();
    const mockDisconnect = vi.fn();
    let resizeObserverCallback: ResizeObserverCallback;

    beforeEach(() => {
      mockObserve.mockClear();
      mockDisconnect.mockClear();

      // Mock ResizeObserver - methods are called by setupResizeListeners via the ResizeObserver API
      const MockResizeObserver = function(this: ResizeObserver, callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      } as unknown as typeof ResizeObserver;
      MockResizeObserver.prototype.observe = function(target: Element) { mockObserve(target); };
      MockResizeObserver.prototype.disconnect = function() { mockDisconnect(); };
      MockResizeObserver.prototype.unobserve = function() { /* interface requirement */ };
      vi.stubGlobal('ResizeObserver', MockResizeObserver);
    });

    const createMockChartWithRemove = (): MockChart & { remove: ReturnType<typeof vi.fn> } => ({
      applyOptions: vi.fn(),
      timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
      remove: vi.fn(),
    });

    it('should add window resize listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const handleResize = vi.fn();

      setupResizeListeners(
        document.createElement('div'),
        createMockChartWithRemove() as unknown as IChartApi,
        handleResize
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', handleResize);
    });

    it('should create ResizeObserver and observe container', () => {
      const container = document.createElement('div');
      const handleResize = vi.fn();

      setupResizeListeners(container, createMockChartWithRemove() as unknown as IChartApi, handleResize);

      expect(mockObserve).toHaveBeenCalledWith(container);
    });

    it('should return cleanup function', () => {
      const cleanup = setupResizeListeners(
        document.createElement('div'),
        createMockChartWithRemove() as unknown as IChartApi,
        vi.fn()
      );

      expect(typeof cleanup).toBe('function');
    });

    it('should remove event listener on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const handleResize = vi.fn();

      const cleanup = setupResizeListeners(
        document.createElement('div'),
        createMockChartWithRemove() as unknown as IChartApi,
        handleResize
      );

      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', handleResize);
    });

    it('should disconnect ResizeObserver on cleanup', () => {
      const cleanup = setupResizeListeners(
        document.createElement('div'),
        createMockChartWithRemove() as unknown as IChartApi,
        vi.fn()
      );

      cleanup();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should remove chart on cleanup', () => {
      const mockChart = createMockChartWithRemove();

      const cleanup = setupResizeListeners(
        document.createElement('div'),
        mockChart as unknown as IChartApi,
        vi.fn()
      );

      cleanup();

      expect(mockChart.remove).toHaveBeenCalled();
    });

    it('should call handleResize when ResizeObserver triggers', () => {
      const handleResize = vi.fn();

      setupResizeListeners(
        document.createElement('div'),
        createMockChartWithRemove() as unknown as IChartApi,
        handleResize
      );

      // Simulate ResizeObserver callback
      resizeObserverCallback([], {} as ResizeObserver);

      expect(handleResize).toHaveBeenCalled();
    });
  });
});
