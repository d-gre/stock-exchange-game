import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { DebugModal } from './DebugModal';

const mockDispatch = vi.fn();
let mockUiState = { debugModalOpen: false, debugModalContent: '' };

vi.mock('../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: { ui: typeof mockUiState }) => unknown) =>
    selector({ ui: mockUiState }),
}));

vi.mock('../store/uiSlice', async () => {
  const actual = await vi.importActual('../store/uiSlice');
  return {
    ...actual,
    closeDebugModal: () => ({ type: 'ui/closeDebugModal' }),
  };
});

vi.mock('../hooks/useClickOutside', () => ({
  useClickOutside: vi.fn(),
}));

describe('DebugModal', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockUiState = { debugModalOpen: false, debugModalContent: '' };
  });

  describe('rendering', () => {
    it('should return null when modal is closed', () => {
      const { container } = render(<DebugModal />);
      expect(container.firstChild).toBeNull();
    });

    it('should render overlay when modal is open', () => {
      mockUiState = { debugModalOpen: true, debugModalContent: '{}' };
      render(<DebugModal />);
      expect(document.querySelector('.debug-modal__overlay')).toBeInTheDocument();
    });

    it('should render title', () => {
      mockUiState = { debugModalOpen: true, debugModalContent: '{}' };
      render(<DebugModal />);
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('should render debug content in pre element', () => {
      const content = '{"portfolio": {"cash": 10000}}';
      mockUiState = { debugModalOpen: true, debugModalContent: content };
      render(<DebugModal />);
      expect(document.querySelector('.debug-modal__code')).toHaveTextContent(content);
    });

    it('should render close button', () => {
      mockUiState = { debugModalOpen: true, debugModalContent: '{}' };
      render(<DebugModal />);
      expect(document.querySelector('.debug-modal__close')).toBeInTheDocument();
    });

    it('should render copy button', () => {
      mockUiState = { debugModalOpen: true, debugModalContent: '{}' };
      render(<DebugModal />);
      expect(document.querySelector('.debug-modal__copy-btn')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should dispatch closeDebugModal when clicking close button', () => {
      mockUiState = { debugModalOpen: true, debugModalContent: '{}' };
      render(<DebugModal />);

      fireEvent.click(document.querySelector('.debug-modal__close')!);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'ui/closeDebugModal' });
    });

    it('should copy content to clipboard when clicking copy button', async () => {
      const content = '{"test": true}';
      mockUiState = { debugModalOpen: true, debugModalContent: content };

      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      render(<DebugModal />);

      await act(async () => {
        fireEvent.click(document.querySelector('.debug-modal__copy-btn')!);
      });
      expect(writeTextMock).toHaveBeenCalledWith(content);
    });

    it('should show copied feedback after clicking copy button', async () => {
      mockUiState = { debugModalOpen: true, debugModalContent: '{}' };

      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      render(<DebugModal />);

      const copyBtn = document.querySelector('.debug-modal__copy-btn')!;
      const ariaLabelBefore = copyBtn.getAttribute('aria-label');

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      await waitFor(() => {
        expect(copyBtn.getAttribute('aria-label')).not.toBe(ariaLabelBefore);
      });
    });

    it('should handle clipboard failure gracefully', async () => {
      mockUiState = { debugModalOpen: true, debugModalContent: '{}' };

      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard blocked'));
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<DebugModal />);

      await act(async () => {
        fireEvent.click(document.querySelector('.debug-modal__copy-btn')!);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to copy:', expect.any(Error));
      });
      consoleSpy.mockRestore();
    });
  });
});
