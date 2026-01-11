export const trackerSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['label', 'groupId', 'fields'],
  additionalProperties: false,
  properties: {
    label: {
      type: 'string',
      minLength: 1,
      description: 'Display name for this tracker',
      examples: ['Barbell Bench Press', 'Water Intake', 'Mood'],
    },
    tag: {
      type: 'string',
      pattern: '^[a-z][a-z0-9-]*$',
      description: 'URL-safe identifier (auto-generated from label if not provided)',
      examples: ['bench-press', 'water', 'mood'],
    },
    groupId: {
      type: 'string',
      pattern: '^group:[a-f0-9-]+$',
      description: 'ID of the primary group (format: group:uuid)',
      examples: ['group:abc123', 'group:xyz789'],
    },
    additionalGroupIds: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^group:[a-f0-9-]+$',
      },
      description: 'Additional groups this tracker belongs to',
    },
    icon: {
      type: 'string',
      description: 'Emoji icon for this tracker',
      examples: ['💪', '💧', '😊', '📊'],
    },
    aliases: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
      },
      description: 'Alternative names for quick-add syntax',
      examples: [
        ['bench', 'bp'],
        ['h2o', 'hydration'],
      ],
    },
    fields: {
      type: 'array',
      minItems: 1,
      description: 'Field definitions for this tracker',
      items: {
        type: 'object',
        required: ['name', 'label', 'type'],
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            pattern: '^[a-z][a-z0-9_]*$',
            description: 'Unique field identifier in snake_case',
            examples: ['weight', 'reps', 'sets', 'value'],
          },
          label: {
            type: 'string',
            minLength: 1,
            description: 'Human-readable label',
            examples: ['Weight', 'Reps', 'Sets', 'Value'],
          },
          type: {
            type: 'string',
            enum: ['number', 'text', 'duration', 'boolean', 'scale', 'counter', 'photo'],
            description: 'Field type',
          },
          unit: {
            type: 'string',
            description: 'Unit of measurement',
            examples: ['kg', 'lbs', 'ml', 'min', 'sec'],
          },
          min: {
            type: 'number',
            description: 'Minimum value',
          },
          max: {
            type: 'number',
            description: 'Maximum value',
          },
          step: {
            type: 'number',
            minimum: 0,
            exclusiveMinimum: true,
            description: 'Step increment',
            default: 1,
          },
          defaultValue: {
            oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'boolean' }],
            description: 'Default value for new entries',
          },
          scaleMin: {
            type: 'number',
            description: 'Minimum scale value (for scale type)',
            default: 1,
          },
          scaleMax: {
            type: 'number',
            description: 'Maximum scale value (for scale type)',
            default: 5,
          },
          scaleLabels: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Labels for scale values',
            examples: [{ '1': 'Poor', '5': 'Excellent' }],
          },
          maxPhotos: {
            type: 'number',
            minimum: 1,
            description: 'Maximum number of photos (for photo type)',
            default: 10,
          },
          maxSizeKB: {
            type: 'number',
            minimum: 1,
            description: 'Maximum photo size in KB',
            default: 2048,
          },
          compress: {
            type: 'boolean',
            description: 'Whether to compress photos',
            default: true,
          },
          targetWidth: {
            type: 'number',
            minimum: 100,
            description: 'Target width for photo compression',
            default: 1920,
          },
          required: {
            type: 'boolean',
            description: 'Whether this field is required',
            default: false,
          },
          sortOrder: {
            type: 'number',
            description: 'Display order',
            default: 0,
          },
        },
      },
    },
    sortOrder: {
      type: 'number',
      description: 'Display order in lists',
      default: 0,
    },
    archived: {
      type: 'boolean',
      description: 'Whether this tracker is archived',
      default: false,
    },
    pinned: {
      type: 'boolean',
      description: 'Whether to show in quick access',
      default: false,
    },
  },
};
