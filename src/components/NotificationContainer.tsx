import { useState, useCallback, useEffect } from 'react';
import Notification, { type NotificationData } from './Notification';
import { audioManager, type SoundEffectId } from '../services/AudioManager';

let notificationIdCounter = 0;
const generateNotificationId = () => `notification-${++notificationIdCounter}-${Date.now()}`;

// Global notification queue
let notificationQueue: NotificationData[] = [];
let setNotificationQueueState: React.Dispatch<React.SetStateAction<NotificationData[]>> | null = null;

// Map notification types to sound effects
const notificationSounds: Record<string, SoundEffectId> = {
  success: 'notify_success',
  error: 'notify_error',
  warning: 'notify_warning',
  info: 'notify_info',
};

export const showNotification = (
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  duration?: number
) => {
  const notification: NotificationData = {
    id: generateNotificationId(),
    message,
    type,
    duration,
  };

  // Play notification sound
  const soundId = notificationSounds[type] || 'notify_info';
  audioManager.playSfx(soundId);

  if (setNotificationQueueState) {
    setNotificationQueueState((prev: NotificationData[]) => [...prev, notification]);
  } else {
    notificationQueue.push(notification);
  }
};

export default function NotificationContainer() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  // Register the setter globally
  useEffect(() => {
    setNotificationQueueState = setNotifications;
    // Process any queued notifications
    if (notificationQueue.length > 0) {
      setNotifications([...notificationQueue]);
      notificationQueue = [];
    }
    return () => {
      setNotificationQueueState = null;
    };
  }, []);

  const handleClose = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          notification={notification}
          onClose={handleClose}
        />
      ))}
    </div>
  );
}

