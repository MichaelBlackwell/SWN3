import { useEffect } from 'react';
import './Notification.css';

export interface NotificationData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface NotificationProps {
  notification: NotificationData;
  onClose: (id: string) => void;
}

export default function Notification({ notification, onClose }: NotificationProps) {
  useEffect(() => {
    const duration = notification.duration || 3000;
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [notification.id, notification.duration, onClose]);

  return (
    <div
      className={`notification notification-${notification.type}`}
      onClick={() => onClose(notification.id)}
    >
      <div className="notification-content">
        {notification.type === 'success' && <span className="notification-icon">✓</span>}
        {notification.type === 'error' && <span className="notification-icon">✕</span>}
        {notification.type === 'info' && <span className="notification-icon">ℹ</span>}
        <span className="notification-message">{notification.message}</span>
      </div>
    </div>
  );
}













