import type { HTMLAttributes, ReactNode } from 'react';
import { createElement, useMemo, useId } from 'react';
import './KeywordTooltipText.css';

type KeywordTheme = 'force' | 'cunning' | 'wealth' | 'asset' | 'tag';

type KeywordElement = 'p' | 'span' | 'div' | 'label';

interface KeywordTooltipTextProps extends HTMLAttributes<HTMLElement> {
  /**
   * Text content that should have keywords highlighted.
   */
  text: string;
  /**
   * Optional element to render as. Defaults to `<p>`.
   */
  as?: KeywordElement;
}

interface KeywordConfig {
  /**
   * Canonical keyword label.
   */
  label: string;
  /**
   * Tooltip copy describing the concept pulled from the SWN rules reference.
   */
  description: string;
  /**
   * Class suffix used for color-coding.
   */
  theme: KeywordTheme;
  /**
   * Accepted lowercase variants that should map to this keyword.
   */
  variants: string[];
}

const KEYWORD_DEFINITIONS: KeywordConfig[] = [
  {
    label: 'Force',
    description:
      'Represents a faction’s talent for direct violence and military coercion. Rated 1-8, with higher values reflecting disciplined armies, fleets, and security forces.',
    theme: 'force',
    variants: ['force', 'forces'],
  },
  {
    label: 'Cunning',
    description:
      'Measures espionage, infiltration, and counter-intelligence prowess. High Cunning factions excel at stealth operations, spies, and covert disruption.',
    theme: 'cunning',
    variants: ['cunning'],
  },
  {
    label: 'Wealth',
    description:
      'Captures economic strength, laboratories, industry, and logistics. Wealth fuels asset purchases, maintenance, and large-scale projects.',
    theme: 'wealth',
    variants: ['wealth'],
  },
  {
    label: 'Asset',
    description:
      'Assets are the tangible units—troops, facilities, ships, or influence—that factions deploy. They have costs, hit points, attacks, and special abilities.',
    theme: 'asset',
    variants: ['asset', 'assets'],
  },
  {
    label: 'Tag',
    description:
      'Tags are narrative traits that give factions unique bonuses or rules, such as Planetary Government, Fanatical, or Mercenary Group.',
    theme: 'tag',
    variants: ['tag', 'tags'],
  },
];

const KEYWORD_LOOKUP = KEYWORD_DEFINITIONS.reduce<Record<string, KeywordConfig>>((acc, config) => {
  config.variants.forEach((variant) => {
    acc[variant.toLowerCase()] = config;
  });
  return acc;
}, {});

const KEYWORD_REGEX = new RegExp(`\\b(${Object.keys(KEYWORD_LOOKUP).join('|')})\\b`, 'gi');

function renderSegment(segment: string, keyPrefix: string): ReactNode {
  if (!segment) {
    return null;
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  segment.replace(KEYWORD_REGEX, (match, _p1, offset) => {
    if (offset > lastIndex) {
      nodes.push(segment.slice(lastIndex, offset));
    }

    const normalized = match.toLowerCase();
    const keywordConfig = KEYWORD_LOOKUP[normalized];

    if (keywordConfig) {
      nodes.push(
        <span
          key={`${keyPrefix}-${normalized}-${offset}`}
          className={`keyword-tooltip keyword-tooltip--${keywordConfig.theme}`}
          tabIndex={0}
          role="button"
          aria-label={`${keywordConfig.label}: ${keywordConfig.description}`}
        >
          <span className="keyword-tooltip__label">{match}</span>
          <span className="keyword-tooltip__tooltip" role="tooltip">
            <strong>{keywordConfig.label}</strong>
            <span>{keywordConfig.description}</span>
          </span>
        </span>,
      );
    } else {
      nodes.push(match);
    }

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < segment.length) {
    nodes.push(segment.slice(lastIndex));
  }

  return nodes;
}

export function highlightKeywords(text: string, keyPrefix = 'keyword'): ReactNode {
  if (!text) {
    return text;
  }
  return renderSegment(text, keyPrefix);
}

const KeywordTooltipText = ({ text, as: Element = 'p', className = '', ...rest }: KeywordTooltipTextProps) => {
  const uniqueId = useId();
  const content = useMemo(() => highlightKeywords(text, uniqueId), [text, uniqueId]);
  const isBlockElement = Element === 'p' || Element === 'div';
  const combinedClassName = [
    'keyword-tooltip-text',
    isBlockElement ? 'keyword-tooltip-text--block' : 'keyword-tooltip-text--inline',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  return createElement(
    Element,
    {
      className: combinedClassName,
      ...rest,
    },
    content,
  );
};

export default KeywordTooltipText;

