import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColorType } from 'lightweight-charts';
import {
  getDefaultChartOptions,
  getChartColors,
  createResizeHandler,
  setupResizeListeners,
} from './chartUtils';

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

      expect(options.timeScale).toEqual({
        borderColor: '#3a3a5a',
        timeVisible: true,
        secondsVisible: false,
      });
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
  });

  describe('createResizeHandler', () => {
    const createMockChart = () => ({
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
        chart: createMockChart() as any,
        autoHeight: false,
        fallbackHeight: 400,
      });

      expect(typeof handler).toBe('function');
    });

    it('should use fallbackHeight when autoHeight is false', () => {
      const mockChart = createMockChart();
      const handler = createResizeHandler({
        container: createMockContainer(800, 600),
        chart: mockChart as any,
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
        chart: mockChart as any,
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
        chart: mockChart as any,
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
      const mockChart = {
        applyOptions: vi.fn(),
        timeScale: vi.fn(() => ({
          fitContent: mockFitContent,
        })),
      };
      const handler = createResizeHandler({
        container: createMockContainer(800, 600),
        chart: mockChart as any,
        autoHeight: false,
        fallbackHeight: 400,
      });

      handler();

      expect(mockChart.timeScale).toHaveBeenCalled();
      expect(mockFitContent).toHaveBeenCalled();
    });
  });

  describe('setupResizeListeners', () => {
    let mockObserve: ReturnType<typeof vi.fn>;
    let mockDisconnect: ReturnType<typeof vi.fn>;
    let resizeObserverCallback: ResizeObserverCallback;

    beforeEach(() => {
      mockObserve = vi.fn();
      mockDisconnect = vi.fn();

      class MockResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeObserverCallback = callback;
        }
        observe = mockObserve;
        disconnect = mockDisconnect;
        unobserve = vi.fn();
      }

      vi.stubGlobal('ResizeObserver', MockResizeObserver);
    });

    const createMockChart = () => ({
      remove: vi.fn(),
    });

    it('should add window resize listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const handleResize = vi.fn();

      setupResizeListeners(
        document.createElement('div'),
        createMockChart() as any,
        handleResize
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', handleResize);
    });

    it('should create ResizeObserver and observe container', () => {
      const container = document.createElement('div');
      const handleResize = vi.fn();

      setupResizeListeners(container, createMockChart() as any, handleResize);

      expect(mockObserve).toHaveBeenCalledWith(container);
    });

    it('should return cleanup function', () => {
      const cleanup = setupResizeListeners(
        document.createElement('div'),
        createMockChart() as any,
        vi.fn()
      );

      expect(typeof cleanup).toBe('function');
    });

    it('should remove event listener on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const handleResize = vi.fn();

      const cleanup = setupResizeListeners(
        document.createElement('div'),
        createMockChart() as any,
        handleResize
      );

      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', handleResize);
    });

    it('should disconnect ResizeObserver on cleanup', () => {
      const cleanup = setupResizeListeners(
        document.createElement('div'),
        createMockChart() as any,
        vi.fn()
      );

      cleanup();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should remove chart on cleanup', () => {
      const mockChart = createMockChart();

      const cleanup = setupResizeListeners(
        document.createElement('div'),
        mockChart as any,
        vi.fn()
      );

      cleanup();

      expect(mockChart.remove).toHaveBeenCalled();
    });

    it('should call handleResize when ResizeObserver triggers', () => {
      const handleResize = vi.fn();

      setupResizeListeners(
        document.createElement('div'),
        createMockChart() as any,
        handleResize
      );

      // Simulate ResizeObserver callback
      resizeObserverCallback([], {} as ResizeObserver);

      expect(handleResize).toHaveBeenCalled();
    });
  });
});
