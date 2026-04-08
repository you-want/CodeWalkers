import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusSettingsModal } from './StatusSettingsModal';
import { useStatusSettingsStore } from '../store/useStatusSettingsStore';
import { StatusItemConfig } from '../types/userStatus';
import { Toaster } from 'sonner';

// Mock ResizeObserver for ScrollArea component
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('StatusSettingsModal', () => {
  const mockConfig: StatusItemConfig[] = [
    {
      id: 'working',
      label: 'Working',
      icon: '💻',
      onEnterMessage: 'Start working',
      reminders: []
    }
  ];

  beforeEach(() => {
    useStatusSettingsStore.getState().reset();
  });

  it('should not render when closed', () => {
    render(<StatusSettingsModal />);
    expect(screen.queryByText('Custom Status & Reminders')).not.toBeInTheDocument();
  });

  it('should render correctly when opened', () => {
    useStatusSettingsStore.getState().open(mockConfig, vi.fn());
    
    render(<StatusSettingsModal />);
    
    expect(screen.getByText('Custom Status & Reminders')).toBeInTheDocument();
    expect(screen.getByText('Working')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Working')).toBeInTheDocument(); // Input value
    expect(screen.getByDisplayValue('💻')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Start working')).toBeInTheDocument();
  });

  it('should handle input changes', async () => {
    useStatusSettingsStore.getState().open(mockConfig, vi.fn());
    
    render(<StatusSettingsModal />);
    
    const labelInput = screen.getByLabelText('Status Name');
    fireEvent.change(labelInput, { target: { value: 'Working hard' } });
    
    expect(useStatusSettingsStore.getState().config[0].label).toBe('Working hard');
  });

  it('should add new status', async () => {
    useStatusSettingsStore.getState().open(mockConfig, vi.fn());
    
    render(<StatusSettingsModal />);
    
    const addButton = screen.getByText('Add Status');
    fireEvent.click(addButton);
    
    expect(useStatusSettingsStore.getState().config.length).toBe(2);
    expect(useStatusSettingsStore.getState().config[1].label).toBe('New Status');
  });

  it('should delete status', async () => {
    useStatusSettingsStore.getState().open(mockConfig, vi.fn());
    
    render(<StatusSettingsModal />);
    
    const deleteButtons = document.querySelectorAll('[role="button"]');
    // The first one is the X button on the sidebar item
    fireEvent.click(deleteButtons[0]);
    
    expect(useStatusSettingsStore.getState().config.length).toBe(0);
    expect(screen.getByText('Please select or add a status on the left')).toBeInTheDocument();
  });

  it('should handle submission successfully', async () => {
    const onSave = vi.fn();
    useStatusSettingsStore.getState().open(mockConfig, onSave);
    
    render(
      <>
        <Toaster />
        <StatusSettingsModal />
      </>
    );
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(mockConfig);
      expect(screen.queryByText('Custom Status & Reminders')).not.toBeInTheDocument(); // Modal closed
    });
  });

  it('should handle submission error and show retry', async () => {
    const errorConfig = [
      {
        ...mockConfig[0],
        label: '' // Empty label will trigger validation error
      }
    ];
    
    useStatusSettingsStore.getState().open(errorConfig, vi.fn());
    
    render(<StatusSettingsModal />);
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Validation failed/)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
