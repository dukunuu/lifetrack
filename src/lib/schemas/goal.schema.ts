export const goalSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: [
    'name',
    'type',
    'target',
    'period',
    'aggregation',
    'rollover',
    'archived',
    'sortOrder',
  ],
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      description: 'Goal name',
      examples: ['Workout Volume', 'Water Intake', 'Steps'],
    },
    description: {
      type: 'string',
      description: 'Optional description for this goal',
    },
    trackerIds: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^tracker:[a-f0-9-]+$',
      },
      description: 'Trackers included in this goal (ignored if groupId is provided)',
    },
    fieldNames: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
      },
      description: 'Tracker fields to aggregate (leave empty to use all numeric fields)',
    },
    groupId: {
      type: 'string',
      pattern: '^group:[a-f0-9-]+$',
      description: 'Group ID for group-based goals',
    },
    type: {
      type: 'string',
      enum: ['target', 'cumulative', 'frequency', 'streak', 'duration'],
      description: 'Goal calculation type',
    },
    target: {
      type: 'number',
      minimum: 0,
      description: 'Goal target value',
    },
    targetUnit: {
      type: 'string',
      description: 'Target unit label',
      examples: ['kg', 'ml', 'sessions'],
    },
    period: {
      type: 'string',
      enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
      description: 'Goal period window',
    },
    startDate: {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      description: 'Custom period start date (YYYY-MM-DD)',
    },
    endDate: {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      description: 'Custom period end date (YYYY-MM-DD)',
    },
    aggregation: {
      type: 'string',
      enum: ['sum', 'count', 'average', 'max', 'min', 'latest'],
      description: 'Aggregation method for numeric values',
    },
    rollover: {
      type: 'boolean',
      description: 'Carry excess progress to next period',
      default: false,
    },
    icon: {
      type: 'string',
      description: 'Emoji icon for this goal',
    },
    color: {
      type: 'string',
      description: 'Hex color for this goal',
      pattern: '^#[0-9A-Fa-f]{6}$',
    },
    archived: {
      type: 'boolean',
      description: 'Whether this goal is archived',
      default: false,
    },
    pinned: {
      type: 'boolean',
      description: 'Whether this goal is pinned on the dashboard',
      default: false,
    },
    sortOrder: {
      type: 'number',
      description: 'Display order in lists',
      default: 0,
    },
  },
};
