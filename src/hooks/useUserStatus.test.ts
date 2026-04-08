import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUserStatus } from './useUserStatus';
import { useUserStatusStore } from '../store/useUserStatusStore';

describe('useUserStatus timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUserStatusStore.setState({
      configs: {},
      activeStatusIds: {},
      statusMessages: {}
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger fixed time reminder', () => {
    const { result } = renderHook(() => useUserStatus('ethan'));

    // Set time to local 12:00:00
    vi.setSystemTime(new Date(new Date().setHours(12, 0, 0, 0)));

    act(() => {
      result.current.saveConfig([
        {
          id: 'status_2',
          label: 'Test',
          icon: '🧪',
          onEnterMessage: 'Enter',
          reminders: [
            {
              id: 'rem_2',
              type: 'fixed_time',
              value: '12:05', // 12:05
              message: 'Time to eat'
            }
          ]
        }
      ]);
    });

    act(() => {
      result.current.setActiveStatusId('status_2');
    });

    act(() => {
      vi.advanceTimersByTime(1); // onEnterMessage
    });
    expect(result.current.statusMessage).toBe('Enter');

    // Fast forward to 12:04:59
    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000);
      vi.advanceTimersByTime(1);
    });
    expect(result.current.statusMessage).toBeNull(); // enter message expired

    // Fast forward to 12:05:00
    act(() => {
      vi.advanceTimersByTime(1000); // 12:05:00
      vi.advanceTimersByTime(1);
    });

    expect(result.current.statusMessage).toBe('Time to eat');

    // Fast forward 30 seconds, shouldn't trigger again
    act(() => {
      vi.advanceTimersByTime(30 * 1000);
      vi.advanceTimersByTime(1);
    });
    
    // Status message should still be the reminder or cleared depending on duration, but we mainly want to ensure it doesn't repeatedly call setStatusMessage
    
    // Fast forward to 12:06:00
    act(() => {
      vi.advanceTimersByTime(30 * 1000);
      vi.advanceTimersByTime(1);
    });
    
    // Status message should be cleared by the 5000ms duration timeout which would have happened around 12:05:05
    expect(result.current.statusMessage).toBeNull();
  });

  it('should trigger interval reminder', () => {
    const { result } = renderHook(() => useUserStatus('ethan'));

    act(() => {
      result.current.saveConfig([
        {
          id: 'status_1',
          label: 'Test',
          icon: '🧪',
          onEnterMessage: 'Enter',
          reminders: [
            {
              id: 'rem_1',
              type: 'interval',
              value: 1, // 1 minute
              message: 'Interval fired'
            }
          ]
        }
      ]);
    });

    act(() => {
      result.current.setActiveStatusId('status_1');
    });

    // Fast forward 1 minute
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
      vi.advanceTimersByTime(1);
    });

    expect(result.current.statusMessage).toBe('Interval fired');
  });

  it('should manage independent state and timers for multiple characters', () => {
    const { result: ethanResult } = renderHook(() => useUserStatus('ethan'));
    const { result: lunaResult } = renderHook(() => useUserStatus('luna'));

    act(() => {
      ethanResult.current.saveConfig([
        {
          id: 'status_ethan',
          label: 'Ethan Status',
          icon: '👨',
          onEnterMessage: 'Ethan Enter',
          reminders: [
            { id: 'rem_ethan', type: 'interval', value: 1, message: 'Ethan Reminder' }
          ]
        }
      ]);
      lunaResult.current.saveConfig([
        {
          id: 'status_luna',
          label: 'Luna Status',
          icon: '👩',
          onEnterMessage: 'Luna Enter',
          reminders: [
            { id: 'rem_luna', type: 'interval', value: 2, message: 'Luna Reminder' }
          ]
        }
      ]);
    });

    act(() => {
      ethanResult.current.setActiveStatusId('status_ethan');
      lunaResult.current.setActiveStatusId('status_luna');
    });

    // Advance 1 minute -> Ethan triggers, Luna does not
    act(() => {
      vi.advanceTimersByTime(60 * 1000 + 1);
    });
    
    expect(ethanResult.current.statusMessage).toBe('Ethan Reminder');
    // Luna's enter message expired, so it's null (or hasn't triggered reminder yet)
    expect(lunaResult.current.statusMessage).toBeNull();

    // Advance 1 more minute -> Luna triggers
    act(() => {
      vi.advanceTimersByTime(60 * 1000 + 1);
    });

    expect(lunaResult.current.statusMessage).toBe('Luna Reminder');
  });
});
