import { useState, type FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/store';
import { addFaction } from '../../store/slices/factionsSlice';
import type {
  FactionTag,
  FactionGoalType,
} from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import { 
  generateRandomFactionForSystem, 
  generateFactionFromTemplate, 
  getFactionTemplates 
} from '../../services/factionGenerator';

// Get available faction templates
const FACTION_TEMPLATES = getFactionTemplates();

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
  template: string; // Template name instead of type
  homeworld: string;
  useAutoGenerate: boolean; // Whether to auto-generate based on homeworld
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
    template: '',
    homeworld: '',
    useAutoGenerate: true,
    tags: [],
    goal: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {}
  );

  const handleInputChange = (
    field: keyof FormData,
    value: string | FactionTag[] | boolean
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

    if (!formData.useAutoGenerate && !formData.name.trim()) {
      newErrors.name = 'Faction name is required when not using auto-generate';
    } else if (!formData.useAutoGenerate && formData.name.trim().length < 3) {
      newErrors.name = 'Faction name must be at least 3 characters';
    }

    if (!formData.useAutoGenerate && !formData.template) {
      newErrors.template = 'Faction template is required when not using auto-generate';
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

    const selectedSystem = systems.find(s => s.id === formData.homeworld);
    if (!selectedSystem) {
      setErrors({ homeworld: 'Selected homeworld not found' });
      return;
    }

    let newFaction;

    if (formData.useAutoGenerate) {
      // Auto-generate faction based on homeworld characteristics
      newFaction = generateRandomFactionForSystem(selectedSystem);
    } else {
      // Use selected template
      newFaction = generateFactionFromTemplate(
        formData.template,
        selectedSystem,
        formData.name.trim() || undefined
      );
    }

    // Override tags if manually selected
    if (formData.tags.length > 0) {
      newFaction.tags = formData.tags;
    }

    // Set goal if specified
    if (formData.goal) {
      newFaction.goal = {
        type: formData.goal as FactionGoalType,
        requirements: {},
        progress: {},
      };
    }

    // Dispatch to Redux store
    dispatch(addFaction(newFaction));

    // Reset form
    setFormData({
      name: '',
      template: '',
      homeworld: '',
      useAutoGenerate: true,
      tags: [],
      goal: '',
    });
    setErrors({});
  };

  // Get preview attributes from selected template
  const selectedTemplate = FACTION_TEMPLATES.find(t => t.name === formData.template);
  const previewAttributes = selectedTemplate?.attributes || null;

  return (
    <form onSubmit={handleSubmit}>
        {/* Auto-Generate Toggle */}
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={formData.useAutoGenerate}
              onChange={(e) => handleInputChange('useAutoGenerate', e.target.checked)}
            />
            <span style={{ marginLeft: '8px' }}>Auto-generate faction based on homeworld</span>
          </label>
          <p style={{ fontSize: '0.9em', color: '#888', marginTop: '4px' }}>
            When enabled, the faction will be automatically generated to match the homeworld's characteristics
          </p>
        </div>

        {/* Name Input (only if not auto-generating) */}
        {!formData.useAutoGenerate && (
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
        )}

        {/* Template Selection (only if not auto-generating) */}
        {!formData.useAutoGenerate && (
          <div className="form-group">
            <label htmlFor="faction-template">
              Faction Template <span className="required">*</span>
            </label>
            <select
              id="faction-template"
              value={formData.template}
              onChange={(e) => handleInputChange('template', e.target.value)}
              className={errors.template ? 'error' : ''}
            >
              <option value="">Select a template</option>
              {FACTION_TEMPLATES.map((template) => (
                <option key={template.name} value={template.name}>
                  {template.name}
                </option>
              ))}
            </select>
            {errors.template && <span className="error-message">{errors.template}</span>}
            {selectedTemplate && (
              <p style={{ fontSize: '0.9em', color: '#888', marginTop: '4px' }}>
                {selectedTemplate.description}
              </p>
            )}
          </div>
        )}

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
            {systems.map((system: StarSystem) => (
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
                {10} {/* Default starting credits */}
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

