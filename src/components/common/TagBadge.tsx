import type { HTMLAttributes } from 'react';
import '../Tutorial/KeywordTooltipText.css';
import './TagBadge.css';

type TagBadgeTone = 'faction' | 'world';

interface TagBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  label: string;
  description?: string;
  effects?: string[];
  tone?: TagBadgeTone;
  interactive?: boolean;
}

const DEFAULT_DESCRIPTIONS: Record<TagBadgeTone, string> = {
  faction: 'Faction tag representing special narrative abilities or drawbacks from the SWN rules.',
  world: 'World tag describing notable conditions, threats, or opportunities on this system.',
};

const toneThemeClass: Record<TagBadgeTone, string> = {
  faction: 'keyword-tooltip--tag',
  world: 'keyword-tooltip--asset',
};

export default function TagBadge({
  label,
  description,
  effects,
  tone = 'faction',
  className = '',
  interactive = true,
  ...rest
}: TagBadgeProps) {
  const tooltipCopy = description ?? DEFAULT_DESCRIPTIONS[tone];
  const combinedClassName = ['tag-badge', 'keyword-tooltip', toneThemeClass[tone], `tag-badge--${tone}`, className]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <span
      className={combinedClassName}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? `${label} tag: ${tooltipCopy}` : undefined}
      {...rest}
    >
      <span className="tag-badge__label">{label}</span>
      <span className="keyword-tooltip__tooltip" role="tooltip">
        <strong>{label}</strong>
        <span>{tooltipCopy}</span>
        {effects && effects.length > 0 && (
          <ul className="tag-badge__effects">
            {effects.map((effect) => (
              <li key={`${label}-${effect}`}>{effect}</li>
            ))}
          </ul>
        )}
      </span>
    </span>
  );
}


