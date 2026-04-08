import { useEffect, useMemo } from "react";
import { StatusItemConfig } from "../types/userStatus";
import { MESSAGE_DISPLAY_DURATION_MS } from "../constants/userStatus";
import { useUserStatusStore } from "../store/useUserStatusStore";

export function useUserStatus(characterName: string) {
  const initializeConfig = useUserStatusStore((state) => state.initializeConfig);
  const configs = useUserStatusStore((state) => state.configs);
  const activeStatusIds = useUserStatusStore((state) => state.activeStatusIds);
  const statusMessages = useUserStatusStore((state) => state.statusMessages);
  
  const saveConfigGlobal = useUserStatusStore((state) => state.setConfig);
  const setActiveStatusIdGlobal = useUserStatusStore((state) => state.setActiveStatusId);
  const setStatusMessageGlobal = useUserStatusStore((state) => state.setStatusMessage);

  useEffect(() => {
    initializeConfig(characterName);
  }, [characterName, initializeConfig]);

  const rawConfig = configs[characterName];
  const config = useMemo(() => rawConfig || [], [rawConfig]);
  const activeStatusId = activeStatusIds[characterName] || null;
  const statusMessage = statusMessages[characterName] || null;

  const saveConfig = useMemo(() => 
    (newConfig: StatusItemConfig[]) => saveConfigGlobal(characterName, newConfig),
    [characterName, saveConfigGlobal]
  );
  
  const setActiveStatusId = useMemo(() => 
    (id: string | null) => setActiveStatusIdGlobal(characterName, id),
    [characterName, setActiveStatusIdGlobal]
  );
  
  const setStatusMessage = useMemo(() => 
    (msg: string | null) => setStatusMessageGlobal(characterName, msg),
    [characterName, setStatusMessageGlobal]
  );
  
  // NOTE: This effect runs for each character to manage their specific timers
  useEffect(() => {
    let clearMessageTimeout: NodeJS.Timeout;
    const timerIds: NodeJS.Timeout[] = [];

    const showMessage = (msg: string, durationMs: number = MESSAGE_DISPLAY_DURATION_MS.DEFAULT) => {
      // Use setTimeout to avoid synchronous setState warning in useEffect
      setTimeout(() => setStatusMessage(msg), 0);
      if (clearMessageTimeout) clearTimeout(clearMessageTimeout);
      clearMessageTimeout = setTimeout(() => {
        setStatusMessage(null);
      }, durationMs);
    };

    if (activeStatusId) {
      const currentStatus = config.find(s => s.id === activeStatusId);
      if (currentStatus && currentStatus.onEnterMessage) {
        showMessage(currentStatus.onEnterMessage);
      }
    } else {
      setTimeout(() => setStatusMessage(null), 0);
    }

    // Setup reminders for ALL statuses in config
    config.forEach(status => {
      status.reminders.forEach(reminder => {
        if (reminder.type === 'interval' && typeof reminder.value === 'number') {
          const intervalId = setInterval(() => {
            showMessage(reminder.message, MESSAGE_DISPLAY_DURATION_MS.REMINDER);
          }, reminder.value * 60 * 1000);
          timerIds.push(intervalId);
        } else if (reminder.type === 'fixed_time' && typeof reminder.value === 'string') {
          // Parse target time
          const [targetHourStr, targetMinuteStr] = reminder.value.split(':');
          const targetHour = parseInt(targetHourStr, 10);
          const targetMinute = parseInt(targetMinuteStr, 10);
          
          if (isNaN(targetHour) || isNaN(targetMinute)) return;

          // We check every second, but only trigger once when the minute changes
          // to prevent multiple triggers within the same minute or missing it
          // if setInterval is delayed
          let lastTriggeredMinute = -1;

          const intervalId = setInterval(() => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            
            if (
              currentHour === targetHour && 
              currentMinute === targetMinute && 
              lastTriggeredMinute !== currentMinute
            ) {
              showMessage(reminder.message, MESSAGE_DISPLAY_DURATION_MS.REMINDER);
              lastTriggeredMinute = currentMinute;
            } else if (currentMinute !== targetMinute) {
              // Reset the trigger lock once the minute has passed
              // so it can trigger again tomorrow
              lastTriggeredMinute = -1;
            }
          }, 1000); // Check every second to be precise
          
          // Initial check
          const now = new Date();
          if (now.getHours() === targetHour && now.getMinutes() === targetMinute) {
            showMessage(reminder.message, MESSAGE_DISPLAY_DURATION_MS.REMINDER);
            lastTriggeredMinute = targetMinute;
          }

          timerIds.push(intervalId);
        }
      });
    });

    return () => {
      if (clearMessageTimeout) clearTimeout(clearMessageTimeout);
      timerIds.forEach(id => clearInterval(id));
    };
  }, [activeStatusId, config, setStatusMessage]);

  return { config, saveConfig, activeStatusId, setActiveStatusId, statusMessage };
}
