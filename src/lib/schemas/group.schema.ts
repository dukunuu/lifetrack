export const groupSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      description: 'Display name for this group',
      examples: ['Fitness', 'Meals', 'Finances', 'Push Day', 'Chest'],
    },
    slug: {
      type: 'string',
      pattern: '^[a-z][a-z0-9-]*$',
      description: 'URL-safe identifier (auto-generated from name if not provided)',
      examples: ['fitness', 'meals', 'push-day', 'chest'],
    },
    parentId: {
      oneOf: [{ type: 'string', pattern: '^group:[a-f0-9-]+$' }, { type: 'null' }],
      description: 'ID of parent group (null for root groups)',
      examples: ['group:abc123', null],
    },
    description: {
      type: 'string',
      description: 'Optional description of what this group is for',
      examples: ['Track all fitness-related activities', 'Meal tracking and nutrition'],
    },
    icon: {
      type: 'string',
      description: 'Emoji icon for this group',
      examples: ['💪', '🍽️', '💰', '📊'],
    },
    color: {
      type: 'string',
      pattern: '^#[0-9A-Fa-f]{6}$',
      description: 'Hex color code (inherits from parent if not set)',
      examples: ['#7CB37C', '#B8A9C9', '#D4A857'],
    },
    allowsTrackers: {
      type: 'boolean',
      description: 'Whether trackers can be directly added to this group',
      default: true,
    },
    sortOrder: {
      type: 'number',
      description: 'Display order within parent',
      default: 0,
    },
    archived: {
      type: 'boolean',
      description: 'Whether this group is archived',
      default: false,
    },
  },
};
