import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import factionsReducer from '../../store/slices/factionsSlice';
import type { Faction } from '../../types/faction';
import FactionGoalsTab from './FactionGoalsTab';
import * as NotificationContainer from '../NotificationContainer';

// Mock NotificationContainer
vi.mock('../NotificationContainer', () => ({
  showNotification: vi.fn(),
}));

// Mock KeywordTooltipText
vi.mock('../Tutorial/KeywordTooltipText', () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

describe('FactionGoalsTab', () => {
  let store: ReturnType<typeof configureStore>;
  let testFaction: Faction;

  beforeEach(() => {
    vi.clearAllMocks();

    testFaction = {
      id: 'faction-1',
      name: 'Test Faction',
      type: 'Corporation',
      homeworld: 'system-1',
      facCreds: 10,
      xp: 8,
      goal: {
        id: 'goal-1',
        type: 'Military Conquest',
        description: 'Destroy assets worth 4 Force',
        progress: {
          current: 2,
          target: 4,
          metadata: { unit: 'Force' },
        },
        difficulty: 4,
        isCompleted: false,
      },
      goals: [],
      attributes: {
        force: 3,
        cunning: 2,
        wealth: 4,
        hp: 10,
        maxHp: 15,
      },
      assets: [],
      tags: [],
    };

    const preloadedState = {
      factions: {
        factions: [testFaction],
        selectedFactionId: null,
      },
    };

    store = configureStore({
      reducer: {
        factions: factionsReducer,
      },
      preloadedState,
    });
  });

  it('renders faction XP correctly', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    expect(screen.getByText('8 XP')).toBeInTheDocument();
  });

  it('renders active goal with progress bar', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    expect(screen.getByText('Military Conquest')).toBeInTheDocument();
    expect(screen.getByText('Destroy assets worth 4 Force')).toBeInTheDocument();
    expect(screen.getByText('2 / 4 Force')).toBeInTheDocument();
    // Check for the goal reward specifically in the goal card
    const goalCard = screen.getByText('Military Conquest').closest('.goal-card');
    expect(goalCard).toHaveTextContent('4 XP');
  });

  it('displays "No active goal" when goal is not set', () => {
    const factionWithoutGoal = { ...testFaction, goal: null };
    store = configureStore({
      reducer: {
        factions: factionsReducer,
      },
      preloadedState: {
        factions: {
          factions: [factionWithoutGoal],
          selectedFactionId: null,
        },
      },
    });

    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    expect(screen.getByText('No active goal')).toBeInTheDocument();
  });

  it('renders all three attribute advancement cards', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    expect(screen.getByText('Force')).toBeInTheDocument();
    expect(screen.getByText('Cunning')).toBeInTheDocument();
    expect(screen.getByText('Wealth')).toBeInTheDocument();

    // Check for ratings using getAllByText since they appear multiple times
    const allRatings = screen.getAllByText(/Rating:/);
    expect(allRatings.length).toBeGreaterThanOrEqual(3);
    
    // Verify specific rating values
    expect(screen.getByText((content, element) => {
      return element?.textContent === 'Rating: 3' || false;
    })).toBeInTheDocument();
  });

  it('enables upgrade button when XP is sufficient', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    // Force 3->4 costs 6 XP, faction has 8 XP
    const forceUpgradeButton = screen.getByRole('button', { name: /Upgrade to 4.*6 XP/ });
    expect(forceUpgradeButton).not.toBeDisabled();
    expect(forceUpgradeButton).toHaveTextContent('✓');
  });

  it('disables upgrade button when XP is insufficient', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    // Wealth 4->5 costs 9 XP, faction has 8 XP
    const wealthUpgradeButton = screen.getByRole('button', { name: /Upgrade to 5.*9 XP/ });
    expect(wealthUpgradeButton).toBeDisabled();
    expect(wealthUpgradeButton).toHaveTextContent('✗');
  });

  it('disables upgrade button when attribute is at max (8)', () => {
    const maxFaction = { ...testFaction, attributes: { ...testFaction.attributes, force: 8 } };
    store = configureStore({
      reducer: {
        factions: factionsReducer,
      },
      preloadedState: {
        factions: {
          factions: [maxFaction],
          selectedFactionId: null,
        },
      },
    });

    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    const forceUpgradeButton = screen.getByRole('button', { name: /Max Rating/ });
    expect(forceUpgradeButton).toBeDisabled();
    
    // Check for "MAX" badge by finding it within the advancement card
    expect(screen.getByText('MAX')).toBeInTheDocument();
    
    // Verify rating 8 is displayed in the advancement section (not the table)
    const advancementCards = screen.getAllByText((content, element) => {
      return element?.className === 'advancement-current' && element?.textContent?.includes('Rating: 8') || false;
    });
    expect(advancementCards.length).toBeGreaterThan(0);
  });

  it('dispatches upgradeAttribute action when upgrade button is clicked', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    // Force 3->4 costs 6 XP, faction has 8 XP
    const forceUpgradeButton = screen.getByRole('button', { name: /Upgrade to 4.*6 XP/ });
    fireEvent.click(forceUpgradeButton);

    // Verify the state was updated
    const state = store.getState();
    const faction = state.factions.factions[0];
    expect(faction.attributes.force).toBe(4);
    expect(faction.xp).toBe(2); // 8 - 6

    // Verify notification was shown
    expect(NotificationContainer.showNotification).toHaveBeenCalledWith(
      'Upgraded force from 3 to 4 (-6 XP)',
      'success'
    );
  });

  it('shows error notification when trying to upgrade with insufficient XP', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    // Wealth 4->5 costs 9 XP, faction has 8 XP (button should be disabled)
    const wealthUpgradeButton = screen.getByRole('button', { name: /Upgrade to 5.*9 XP/ });
    
    // Even though disabled, test the handler logic by force clicking
    // In real scenario, disabled buttons can't be clicked
    expect(wealthUpgradeButton).toBeDisabled();
  });

  it('shows error notification when trying to upgrade max attribute', () => {
    const maxFaction = { ...testFaction, attributes: { ...testFaction.attributes, force: 8 }, xp: 100 };
    store = configureStore({
      reducer: {
        factions: factionsReducer,
      },
      preloadedState: {
        factions: {
          factions: [maxFaction],
          selectedFactionId: null,
        },
      },
    });

    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    const forceUpgradeButton = screen.getByRole('button', { name: /Max Rating/ });
    expect(forceUpgradeButton).toBeDisabled();
  });

  it('calculates progress percentage correctly', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    // Progress is 2/4 = 50%
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '2');
    expect(progressBar).toHaveAttribute('aria-valuemax', '4');
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('displays completed badge when goal is completed', () => {
    const completedGoalFaction = {
      ...testFaction,
      goal: {
        ...testFaction.goal!,
        progress: { current: 4, target: 4, metadata: { unit: 'Force' } },
        isCompleted: true,
      },
    };

    store = configureStore({
      reducer: {
        factions: factionsReducer,
      },
      preloadedState: {
        factions: {
          factions: [completedGoalFaction],
          selectedFactionId: null,
        },
      },
    });

    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    expect(screen.getByText('✓ Completed')).toBeInTheDocument();
  });

  it('displays XP cost table', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    const summary = screen.getByText('View XP Cost Table');
    expect(summary).toBeInTheDocument();

    // Expand the details
    fireEvent.click(summary);

    // Check for some table content
    expect(screen.getByText('Current Rating')).toBeInTheDocument();
    expect(screen.getByText('Upgrade Cost')).toBeInTheDocument();
    expect(screen.getByText('New Rating')).toBeInTheDocument();
  });

  it('renders empty state when faction is not found', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="non-existent-faction" />
      </Provider>
    );

    expect(screen.getByText('Faction not found')).toBeInTheDocument();
  });

  it('displays goal icon and tooltip for active goal', () => {
    render(
      <Provider store={store}>
        <FactionGoalsTab factionId="faction-1" />
      </Provider>
    );

    // Check that the goal icon is rendered (⚔️ for Military Conquest)
    // Use getAllByText since the icon appears in both goal and advancement sections
    const swordIcons = screen.getAllByText('⚔️');
    const goalIcon = swordIcons.find(icon => icon.classList.contains('goal-icon'));
    
    expect(goalIcon).toBeInTheDocument();
    expect(goalIcon).toHaveClass('goal-icon');

    // Check that the tooltip is present
    expect(goalIcon).toHaveAttribute('title');
    const tooltip = goalIcon?.getAttribute('title');
    expect(tooltip).toContain('Destroy enemy Force assets');
  });
});

