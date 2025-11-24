import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { selectAllLogs, type NarrativeLogEntry, type NarrativeLogType } from '../../store/slices/narrativeSlice';
import './NewsFeed.css';

/**
 * Formats a timestamp to a readable date/time string
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Gets the CSS class name for a log type
 */
function getLogTypeClassName(logType: NarrativeLogType): string {
  switch (logType) {
    case 'combat':
      return 'log-combat';
    case 'trade':
    case 'economic':
      return 'log-economic';
    case 'movement':
      return 'log-movement';
    case 'political':
      return 'log-political';
    case 'espionage':
      return 'log-espionage';
    case 'system':
      return 'log-system';
    case 'general':
    default:
      return 'log-general';
  }
}

/**
 * Gets an icon/emoji for a log type
 */
function getLogTypeIcon(logType: NarrativeLogType): string {
  switch (logType) {
    case 'combat':
      return '⚔️';
    case 'trade':
    case 'economic':
      return '💰';
    case 'movement':
      return '🚀';
    case 'political':
      return '🏛️';
    case 'espionage':
      return '🕵️';
    case 'system':
      return '⚙️';
    case 'general':
    default:
      return '📰';
  }
}

interface NewsFeedProps {
  maxHeight?: string; // Optional: override default max height
  showTimestamp?: boolean; // Optional: show/hide timestamps (default: true)
}

export default function NewsFeed({ maxHeight, showTimestamp = true }: NewsFeedProps) {
  const logs = useSelector((state: RootState) => selectAllLogs(state));

  return (
    <div className="news-feed" style={maxHeight ? { maxHeight } : undefined}>
      <div className="news-feed-header">
        <h3 className="news-feed-title">News Feed</h3>
        {logs.length > 0 && (
          <span className="news-feed-count">{logs.length} event{logs.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      
      {logs.length === 0 ? (
        <div className="news-feed-empty">
          <p className="news-feed-empty-text">No events yet</p>
          <p className="news-feed-empty-hint">News will appear here as factions take actions</p>
        </div>
      ) : (
        <div className="news-feed-content">
          {logs.map((log: NarrativeLogEntry) => (
            <div key={log.id} className={`news-feed-item ${getLogTypeClassName(log.type)}`}>
              <div className="news-feed-item-icon">{getLogTypeIcon(log.type)}</div>
              <div className="news-feed-item-content">
                <div className="news-feed-item-text">{log.text}</div>
                {showTimestamp && (
                  <div className="news-feed-item-timestamp">{formatTimestamp(log.timestamp)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}






