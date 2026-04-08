import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStatusSettingsStore } from './useStatusSettingsStore';
import { StatusItemConfig } from '../types/userStatus';

describe('useStatusSettingsStore', () => {
  const mockConfig: StatusItemConfig[] = [
    {
      id: 'working',
      label: '工作',
      icon: '💻',
      onEnterMessage: '开始工作',
      reminders: []
    }
  ];

  beforeEach(() => {
    useStatusSettingsStore.getState().reset();
  });

  it('should have initial state', () => {
    const state = useStatusSettingsStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.config).toEqual([]);
    expect(state.selectedId).toBeNull();
  });

  it('should open modal with initial config', () => {
    const onSave = vi.fn();
    useStatusSettingsStore.getState().open(mockConfig, onSave);

    const state = useStatusSettingsStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.config).toEqual(mockConfig);
    expect(state.selectedId).toBe('working');
    expect(state.onSaveCallback).toBe(onSave);
  });

  it('should close modal', () => {
    useStatusSettingsStore.getState().open(mockConfig, vi.fn());
    useStatusSettingsStore.getState().close();

    const state = useStatusSettingsStore.getState();
    expect(state.isOpen).toBe(false);
  });

  it('should submit config successfully', async () => {
    const onSave = vi.fn();
    useStatusSettingsStore.getState().open(mockConfig, onSave);

    const promise = useStatusSettingsStore.getState().submit(mockConfig);
    
    expect(useStatusSettingsStore.getState().isLoading).toBe(true);
    
    await promise;

    const state = useStatusSettingsStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.isOpen).toBe(false);
    expect(state.error).toBeNull();
    expect(onSave).toHaveBeenCalledWith(mockConfig);
  });

  it('should handle validation error for empty label', async () => {
    useStatusSettingsStore.getState().open(mockConfig, vi.fn());

    const invalidConfig = [
      {
        ...mockConfig[0],
        label: ''
      }
    ];

    await expect(useStatusSettingsStore.getState().submit(invalidConfig)).rejects.toThrow();

    const state = useStatusSettingsStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toContain('Status name cannot be empty');
  });

  it('should handle validation error for too long label', async () => {
    useStatusSettingsStore.getState().open(mockConfig, vi.fn());

    const invalidConfig = [
      {
        ...mockConfig[0],
        label: '这是一个超过20个字符的非常非常长的状态名称测试'
      }
    ];

    await expect(useStatusSettingsStore.getState().submit(invalidConfig)).rejects.toThrow();

    const state = useStatusSettingsStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toContain('Cannot exceed 20 characters');
  });

  it('should handle simulated 500 error', async () => {
    useStatusSettingsStore.getState().open(mockConfig, vi.fn());

    const errorConfig = [
      {
        ...mockConfig[0],
        label: 'error_500'
      }
    ];

    await expect(useStatusSettingsStore.getState().submit(errorConfig)).rejects.toThrow();

    const state = useStatusSettingsStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toContain('500');
  });
});
