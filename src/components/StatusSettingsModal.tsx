import { useEffect, useCallback } from 'react';
import { useStatusSettingsStore } from '../store/useStatusSettingsStore';
import { ReminderType, StatusItemConfig } from '../types/userStatus';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export function StatusSettingsModal({ characterName }: { characterName?: string }) {
  const { 
    isOpen,
    activeCharacterName,
    isLoading, 
    config, 
    selectedId, 
    error,
    close, 
    submit, 
    setConfig, 
    setSelectedId,
    reset
  } = useStatusSettingsStore();

  const shouldOpen = isOpen && (!characterName || activeCharacterName === characterName);

  // Reset store on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  const handleAddStatus = useCallback(() => {
    const newId = `status_${Date.now()}`;
    setConfig(prev => [
      ...prev,
      {
        id: newId,
        label: 'New Status',
        icon: '🌟',
        onEnterMessage: 'Entering new status...',
        reminders: []
      }
    ]);
    setSelectedId(newId);
  }, [setConfig, setSelectedId]);

  const handleDeleteStatus = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfig(prev => {
      const newConfig = prev.filter(s => s.id !== id);
      if (selectedId === id) {
        setSelectedId(newConfig[0]?.id || null);
      }
      return newConfig;
    });
  }, [setConfig, selectedId, setSelectedId]);

  const updateSelectedStatus = useCallback((updater: (status: StatusItemConfig) => StatusItemConfig) => {
    setConfig(prev => prev.map(s => s.id === selectedId ? updater(s) : s));
  }, [setConfig, selectedId]);

  const handleAddReminder = useCallback(() => {
    updateSelectedStatus(status => ({
      ...status,
      reminders: [
        ...status.reminders,
        {
          id: `reminder_${Date.now()}`,
          type: 'interval',
          value: 60,
          message: 'Time for a break!'
        }
      ]
    }));
  }, [updateSelectedStatus]);

  const handleSave = useCallback(async () => {
    try {
      await submit(config);
      toast.success("Settings saved successfully", { duration: 2000 });
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message || "Failed to save");
      } else {
        toast.error("Failed to save");
      }
    }
  }, [submit, config]);

  const selectedStatus = config.find(s => s.id === selectedId);

  return (
    <Dialog open={shouldOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent 
        className="max-w-4xl p-0 overflow-hidden flex flex-col settings-modal" 
        aria-describedby="status-settings-description"
      >
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg font-bold">
            Custom Status & Reminders {activeCharacterName ? `(${activeCharacterName.charAt(0).toUpperCase() + activeCharacterName.slice(1)})` : ''}
          </DialogTitle>
          <DialogDescription id="status-settings-description" className="sr-only">
            Configure your work or break status here, along with corresponding reminders.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 h-[500px] min-h-0">
          {/* Sidebar */}
          <div className="w-64 border-r flex flex-col bg-muted/30">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {isLoading && config.length === 0 ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))
                ) : (
                  config.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors text-sm ${
                        s.id === selectedId 
                          ? 'bg-primary text-primary-foreground font-medium' 
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="text-lg">{s.icon}</span>
                        <span className="truncate">{s.label}</span>
                      </span>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDeleteStatus(s.id, e)}
                        className="opacity-0 hover:opacity-100 group-hover:opacity-100 p-1 hover:bg-destructive/20 hover:text-destructive rounded transition-all"
                      >
                        <X className="h-4 w-4" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="p-4 border-t bg-background">
              <Button variant="outline" className="w-full" onClick={handleAddStatus} disabled={isLoading}>
                <Plus className="mr-2 h-4 w-4" /> Add Status
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {error && (
              <div className="bg-destructive/10 text-destructive px-6 py-3 text-sm flex items-center justify-between border-b border-destructive/20">
                <span>{error}</span>
                <Button variant="ghost" size="sm" onClick={handleSave} className="h-8 text-destructive hover:text-destructive hover:bg-destructive/20">
                  Retry
                </Button>
              </div>
            )}
            
            <ScrollArea className="flex-1">
              {selectedStatus ? (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-9 space-y-2">
                      <Label htmlFor="status-label" className="text-sm">Status Name</Label>
                      <Input 
                        id="status-label"
                        value={selectedStatus.label}
                        onChange={e => updateSelectedStatus(s => ({ ...s, label: e.target.value }))}
                        placeholder="e.g.: Working"
                      />
                    </div>
                    <div className="col-span-3 space-y-2">
                      <Label htmlFor="status-icon" className="text-sm">Icon (Emoji)</Label>
                      <Input 
                        id="status-icon"
                        value={selectedStatus.icon}
                        onChange={e => updateSelectedStatus(s => ({ ...s, icon: e.target.value }))}
                        className="text-center"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="on-enter-message" className="text-sm">Message on Entry</Label>
                    <Input 
                      id="on-enter-message"
                      value={selectedStatus.onEnterMessage}
                      onChange={e => updateSelectedStatus(s => ({ ...s, onEnterMessage: e.target.value }))}
                      placeholder="e.g.: Time to focus! 💪"
                    />
                  </div>

                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Reminders</Label>
                      <Button variant="secondary" size="sm" onClick={handleAddReminder}>
                        <Plus className="mr-2 h-4 w-4" /> Add Rule
                      </Button>
                    </div>

                    {selectedStatus.reminders.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                        No reminders yet. Click the button to add one.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedStatus.reminders.map((r, index) => (
                          <div key={r.id} className="flex gap-3 items-start p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                            <div className="flex-1 space-y-3">
                              <div className="flex gap-3">
                                <div className="w-1/3">
                                  <Select 
                                    value={r.type} 
                                    onValueChange={(v: ReminderType) => updateSelectedStatus(s => {
                                      const newReminders = [...s.reminders];
                                      newReminders[index] = { 
                                        ...r, 
                                        type: v, 
                                        value: v === 'interval' ? 60 : '12:00' 
                                      };
                                      return { ...s, reminders: newReminders };
                                    })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="interval">Interval (mins)</SelectItem>
                                      <SelectItem value="fixed_time">Fixed Time</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex-1">
                                  <Input 
                                    type={r.type === 'interval' ? 'number' : 'time'}
                                    value={r.value}
                                    onChange={e => updateSelectedStatus(s => {
                                      const newReminders = [...s.reminders];
                                      newReminders[index] = { 
                                        ...r, 
                                        value: r.type === 'interval' ? Number(e.target.value) : e.target.value 
                                      };
                                      return { ...s, reminders: newReminders };
                                    })}
                                    min={r.type === 'interval' ? 1 : undefined}
                                  />
                                </div>
                              </div>
                              <Input 
                                value={r.message}
                                onChange={e => updateSelectedStatus(s => {
                                  const newReminders = [...s.reminders];
                                  newReminders[index] = { ...r, message: e.target.value };
                                  return { ...s, reminders: newReminders };
                                })}
                                placeholder="Reminder Message"
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => updateSelectedStatus(s => ({
                                ...s,
                                reminders: s.reminders.filter((_, i) => i !== index)
                              }))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Please select or add a status on the left
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="px-6 py-4 border-t bg-muted/10">
              <Button variant="outline" onClick={close} disabled={isLoading}>Cancel</Button>
              <Button onClick={handleSave} disabled={isLoading || config.length === 0}>
                {isLoading ? 'Saving...' : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Settings
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}