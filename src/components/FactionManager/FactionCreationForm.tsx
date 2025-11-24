import { useState, type FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/store';
import { addFaction } from '../../store/slices/factionsSlice';
import type {
  FactionType,
  FactionTag,
  FactionGoalType,
  Faction,
} from '../../types/faction';
import {
  calculateFactionStats,
  generateFactionId,
  calculateStartingFacCreds,
} from '../../utils/factionCalculations';

const FACTION_TYPES: FactionType[] = [
  'Government',
  'Corporation',
  'Religion',
  'Criminal Organization',
  'Mercenary Group',
  'Rebel Movement',
  'Eugenics Cult',
  'Colony',
  'Regional Hegemon',
  'Other',
];

const FACTION_TAGS: FactionTag[] = [
  'Colonists',
  'Deep Rooted',
  'Eugenics Cult',
  'Exchange Consulate',
  'Fanatical',
  'Imperialists',
  'Machiavellian',
  'Mercenary Group',
  'Perimeter Agency',
  'Pirates',
  'Planetary Government',
  'Plutocratic',
  'Preceptor Archive',
  'Psychic Academy',
  'Savage',
  'Scavengers',
  'Secretive',
  'Technical Expertise',
  'Theocratic',
  'Warlike',
];

const FACTION_GOALS: FactionGoalType[] = [
  'Military Conquest',
  'Commercial Expansion',
  'Intelligence Coup',
  'Planetary Seizure',
  'Expand Influence',
  'Blood the Enemy',
  'Peaceable Kingdom',
  'Destroy the Foe',
  'Inside Enemy Territory',
  'Invincible Valor',
  'Wealth of Worlds',
];

interface FormData {
  name: string;
  type: FactionType | '';
  homeworld: string;
  tags: FactionTag[];
  goal: FactionGoalType | '';
}

export default function FactionCreationForm() {
  const dispatch = useDispatch<AppDispatch>();
  const systems = useSelector(
    (state: RootState) => state.sector.currentSector?.systems || []
  );

  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: '',
    homeworld: '',
    tags: [],
    goal: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {}
  );

  const handleInputChange = (
    field: keyof FormData,
    value: string | FactionTag[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleTagToggle = (tag: FactionTag) => {
    setFormData((prev) => {
      const newTags = prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag];
      // Limit to 2 tags max
      return { ...prev, tags: newTags.slice(0, 2) };
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Faction name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Faction name must be at least 3 characters';
    }

    if (!formData.type) {
      newErrors.type = 'Faction type is required';
    }

    if (!formData.homeworld) {
      newErrors.homeworld = 'Homeworld selection is required';
    }

    if (systems.length === 0) {
      newErrors.homeworld = 'No systems available. Please generate a sector first.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Calculate attributes based on type
    const attributes = calculateFactionStats(formData.type as FactionType);
    const startingFacCreds = calculateStartingFacCreds(attributes);

    // Create the faction object
    const newFaction: Faction = {
      id: generateFactionId(),
      name: formData.name.trim(),
      type: formData.type as FactionType,
      homeworld: formData.homeworld,
      attributes,
      facCreds: startingFacCreds,
      tags: formData.tags,
      goal: formData.goal
        ? {
            type: formData.goal as FactionGoalType,
            requirements: {},
            progress: {},
          }
        : null,
      assets: [],
    };

    // Dispatch to Redux store
    dispatch(addFaction(newFaction));

    // Reset form
    setFormData({
      name: '',
      type: '',
      homeworld: '',
      tags: [],
      goal: '',
    });
    setErrors({});
  };

  const previewAttributes =
    formData.type
      ? calculateFactionStats(formData.type as FactionType)
      : null;

  return (
    <form onSubmit={handleSubmit}>
        {/* Name Input */}
        <div className="form-group">
          <label htmlFor="faction-name">
            Faction Name <span className="required">*</span>
          </label>
          <input
            id="faction-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Enter faction name"
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        {/* Type Selection */}
        <div className="form-group">
          <label htmlFor="faction-type">
            Faction Type <span className="required">*</span>
          </label>
          <select
            id="faction-type"
            value={formData.type}
            onChange={(e) =>
              handleInputChange('type', e.target.value as FactionType)
            }
            className={errors.type ? 'error' : ''}
          >
            <option value="">Select a type</option>
            {FACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.type && <span className="error-message">{errors.type}</span>}
        </div>

        {/* Homeworld Selection */}
        <div className="form-group">
          <label htmlFor="faction-homeworld">
            Homeworld <span className="required">*</span>
          </label>
          <select
            id="faction-homeworld"
            value={formData.homeworld}
            onChange={(e) => handleInputChange('homeworld', e.target.value)}
            className={errors.homeworld ? 'error' : ''}
            disabled={systems.length === 0}
          >
            <option value="">
              {systems.length === 0
                ? 'No systems available - Generate a sector first'
                : 'Select a homeworld'}
            </option>
            {systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name} ({system.coordinates.x}, {system.coordinates.y})
              </option>
            ))}
          </select>
          {errors.homeworld && (
            <span className="error-message">{errors.homeworld}</span>
          )}
        </div>

        {/* Tags Selection */}
        <div className="form-group">
          <label>Faction Tags (select up to 2)</label>
          <div className="tags-container">
            {FACTION_TAGS.map((tag) => (
              <label key={tag} className="tag-checkbox">
                <input
                  type="checkbox"
                  checked={formData.tags.includes(tag)}
                  onChange={() => handleTagToggle(tag)}
                  disabled={
                    !formData.tags.includes(tag) && formData.tags.length >= 2
                  }
                />
                <span>{tag}</span>
              </label>
            ))}
          </div>
          {formData.tags.length > 0 && (
            <div className="selected-tags">
              Selected: {formData.tags.join(', ')}
            </div>
          )}
        </div>

        {/* Goal Selection */}
        <div className="form-group">
          <label htmlFor="faction-goal">Faction Goal (optional)</label>
          <select
            id="faction-goal"
            value={formData.goal}
            onChange={(e) =>
              handleInputChange('goal', e.target.value as FactionGoalType)
            }
          >
            <option value="">No goal (select later)</option>
            {FACTION_GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {goal}
              </option>
            ))}
          </select>
        </div>

        {/* Attribute Preview */}
        {previewAttributes && (
          <div className="attribute-preview">
            <h3>Preview Attributes</h3>
            <div className="attributes-grid">
              <div>
                <strong>HP:</strong> {previewAttributes.hp} /{' '}
                {previewAttributes.maxHp}
              </div>
              <div>
                <strong>Force:</strong> {previewAttributes.force}
              </div>
              <div>
                <strong>Cunning:</strong> {previewAttributes.cunning}
              </div>
              <div>
                <strong>Wealth:</strong> {previewAttributes.wealth}
              </div>
              <div>
                <strong>Starting FacCreds:</strong>{' '}
                {calculateStartingFacCreds(previewAttributes)}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button type="submit" className="submit-button">
          Create Faction
        </button>
      </form>
  );
}

