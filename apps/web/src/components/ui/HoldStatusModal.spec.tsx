import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HoldStatusModal, extractHoldReason } from './HoldStatusModal';

describe('HoldStatusModal & extractHoldReason', () => {
  describe('extractHoldReason', () => {
    it('extracts hold reason from formatted note', () => {
      const note = '[Hold reason]: Waiting for RO membrane replacement\nCustomer will be available after 5pm';
      const result = extractHoldReason(note);
      expect(result.reason).toBe('Waiting for RO membrane replacement');
      expect(result.fullNotes).toBe('Customer will be available after 5pm');
    });

    it('returns cleaned raw notes when no format prefix is present', () => {
      const note = 'Parts out of stock currently.';
      const result = extractHoldReason(note);
      expect(result.reason).toBe('Parts out of stock currently.');
      expect(result.fullNotes).toBeNull();
    });

    it('provides a friendly fallback when notes are null or empty', () => {
      const result = extractHoldReason(null);
      expect(result.reason).toBe('No detailed reason provided when placed on hold.');
    });
  });

  describe('HoldStatusModal Component', () => {
    const mockData = {
      serviceNumber: 'SRV-2026-001',
      jobCardNumber: 'JC-2026-001',
      technicianName: 'Suresh Kumar',
      technicianPhone: '9876543210',
      customerName: 'Anil Sharma',
      notes: '[Hold reason]: Water supply interrupted in society',
      updatedAt: '2026-10-01T10:00:00Z',
    };

    it('renders hold status details in the modal', () => {
      render(<HoldStatusModal isOpen={true} onClose={vi.fn()} data={mockData} />);

      expect(screen.getByText('Service On Hold')).toBeInTheDocument();
      expect(screen.getByText('Water supply interrupted in society')).toBeInTheDocument();
      expect(screen.getByText(/SRV-2026-001/)).toBeInTheDocument();
      expect(screen.getByText(/JC-2026-001/)).toBeInTheDocument();
      expect(screen.getByText(/Suresh Kumar/)).toBeInTheDocument();
      expect(screen.getByText(/Anil Sharma/)).toBeInTheDocument();
    });

    it('triggers onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<HoldStatusModal isOpen={true} onClose={onClose} data={mockData} />);

      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      fireEvent.click(closeButtons[0]);
      expect(onClose).toHaveBeenCalled();
    });

    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <HoldStatusModal isOpen={false} onClose={vi.fn()} data={mockData} />
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
