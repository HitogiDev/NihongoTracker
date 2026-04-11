import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';

const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'NihongoTracker API',
    description:
      'API documentation for NihongoTracker — a Japanese immersion tracking platform. Authenticate using either JWT cookies (browser sessions) or API keys via the `X-API-Key` header.',
    version: '0.1.0',
    contact: {
      name: 'NihongoTracker',
      url: 'https://nihongotracker.app',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API Base',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication & registration' },
    { name: 'Users', description: 'User profiles, rankings & settings' },
    { name: 'Logs', description: 'Immersion log CRUD, import & stats' },
    { name: 'Media', description: 'Media search, details & reviews' },
    { name: 'Goals', description: 'Daily & long-term goals' },
    { name: 'Clubs', description: 'Club management & media votings' },
    { name: 'Tags', description: 'User tag management' },
    { name: 'Changelogs', description: 'Application changelogs' },
    { name: 'Text Sessions', description: 'TextHooker session management' },
    { name: 'Patreon', description: 'Patreon integration & badges' },
    { name: 'API Keys', description: 'API key generation & management' },
    { name: 'Upload', description: 'File uploads (avatars, banners)' },
    { name: 'Admin', description: 'Admin dashboard & moderation' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'jwt',
        description: 'JWT token stored in a cookie (browser sessions)',
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description:
          'API key for programmatic access. Generate one via POST /api/api-keys',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          stack: { type: 'string', description: 'Only in development' },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string' },
          avatar: { type: 'string' },
          banner: { type: 'string' },
          about: { type: 'string' },
          verified: { type: 'boolean' },
          roles: {
            type: 'array',
            items: { type: 'string', enum: ['user', 'admin', 'mod'] },
          },
          stats: { $ref: '#/components/schemas/UserStats' },
          settings: { $ref: '#/components/schemas/UserSettings' },
          titles: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UserStats: {
        type: 'object',
        properties: {
          userLevel: { type: 'number' },
          userXp: { type: 'number' },
          userXpToNextLevel: { type: 'number' },
          userXpToCurrentLevel: { type: 'number' },
          readingXp: { type: 'number' },
          readingLevel: { type: 'number' },
          readingXpToNextLevel: { type: 'number' },
          readingXpToCurrentLevel: { type: 'number' },
          listeningXp: { type: 'number' },
          listeningLevel: { type: 'number' },
          listeningXpToNextLevel: { type: 'number' },
          listeningXpToCurrentLevel: { type: 'number' },
          currentStreak: { type: 'number' },
          longestStreak: { type: 'number' },
          lastStreakDate: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },
      UserSettings: {
        type: 'object',
        properties: {
          blurAdultContent: { type: 'boolean' },
          hideUnmatchedLogsAlert: { type: 'boolean' },
          timezone: { type: 'string' },
          hiddenRecentMedia: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      Log: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'reading',
              'anime',
              'vn',
              'game',
              'video',
              'manga',
              'audio',
              'movie',
              'other',
              'tv show',
            ],
          },
          mediaId: { type: 'string' },
          mediaTitle: { type: 'string' },
          xp: { type: 'number' },
          private: { type: 'boolean' },
          isAdult: { type: 'boolean' },
          description: { type: 'string' },
          episodes: { type: 'number' },
          pages: { type: 'number' },
          chars: { type: 'number' },
          time: { type: 'number' },
          date: { type: 'string', format: 'date-time' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      CreateLog: {
        type: 'object',
        required: ['type', 'date'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'reading',
              'anime',
              'vn',
              'game',
              'video',
              'manga',
              'audio',
              'movie',
              'other',
              'tv show',
            ],
          },
          mediaData: {
            type: 'object',
            properties: {
              contentId: { type: 'string' },
              contentTitleNative: { type: 'string' },
              contentTitleEnglish: { type: 'string' },
              contentTitleRomaji: { type: 'string' },
              contentImage: { type: 'string' },
              type: { type: 'string' },
            },
          },
          description: { type: 'string' },
          episodes: { type: 'number' },
          pages: { type: 'number' },
          chars: { type: 'number' },
          time: { type: 'number' },
          date: { type: 'string', format: 'date-time' },
          private: { type: 'boolean' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      Media: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          contentId: { type: 'string' },
          title: {
            type: 'object',
            properties: {
              contentTitleNative: { type: 'string' },
              contentTitleRomaji: { type: 'string' },
              contentTitleEnglish: { type: 'string' },
            },
          },
          contentImage: { type: 'string' },
          coverImage: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'anime',
              'manga',
              'reading',
              'vn',
              'game',
              'video',
              'movie',
              'tv show',
            ],
          },
          episodes: { type: 'number' },
          episodeDuration: { type: 'number' },
          genres: { type: 'array', items: { type: 'string' } },
          chapters: { type: 'number' },
          volumes: { type: 'number' },
          isAdult: { type: 'boolean' },
        },
      },
      MediaReview: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          mediaContentId: { type: 'string' },
          mediaType: { type: 'string' },
          summary: { type: 'string' },
          content: { type: 'string' },
          rating: { type: 'number' },
          hasSpoilers: { type: 'boolean' },
          likes: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Tag: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      DailyGoal: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          type: {
            type: 'string',
            enum: ['time', 'chars', 'episodes', 'pages'],
          },
          target: { type: 'number' },
          isActive: { type: 'boolean' },
        },
      },
      LongTermGoal: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          type: {
            type: 'string',
            enum: ['time', 'chars', 'episodes', 'pages'],
          },
          totalTarget: { type: 'number' },
          targetDate: { type: 'string', format: 'date-time' },
          displayTimeframe: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
          },
          startDate: { type: 'string', format: 'date-time' },
          isActive: { type: 'boolean' },
        },
      },
      Club: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          avatar: { type: 'string' },
          banner: { type: 'string' },
          isPublic: { type: 'boolean' },
          level: { type: 'number' },
          totalXp: { type: 'number' },
          tags: { type: 'array', items: { type: 'string' } },
          memberLimit: { type: 'number' },
          memberCount: { type: 'number' },
          isActive: { type: 'boolean' },
        },
      },
      ApiKeyResponse: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          keyPrefix: { type: 'string', example: 'ntk_abc12345' },
          key: {
            type: 'string',
            description: 'The full API key — only returned on creation',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ApiKeyListItem: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          keyPrefix: { type: 'string', example: 'ntk_abc12345' },
          lastUsedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Changelog: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          version: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['feature', 'improvement', 'bugfix', 'breaking'],
                },
                description: { type: 'string' },
              },
            },
          },
          date: { type: 'string', format: 'date-time' },
          published: { type: 'boolean' },
        },
      },
    },
  },
  paths: {
    // ──────────────── Auth ────────────────
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password', 'passwordConfirmation'],
                properties: {
                  username: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                  passwordConfirmation: { type: 'string', format: 'password' },
                  timezone: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User created' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with username/email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['login', 'password'],
                properties: {
                  login: {
                    type: 'string',
                    description: 'Username or email',
                  },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful — sets JWT cookie',
          },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout (clears JWT cookie)',
        responses: {
          200: { description: 'Logged out' },
        },
      },
    },
    '/auth/verify': {
      get: {
        tags: ['Auth'],
        summary: 'Verify current JWT token',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Token is valid' },
          401: { description: 'Invalid or expired token' },
        },
      },
    },
    '/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email address with token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: {
                  token: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Email verified' },
          400: { description: 'Invalid or expired token' },
        },
      },
    },
    '/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Resend verification email',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Verification email sent' },
          429: { description: 'Rate limited' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset email',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Reset email sent if account exists' },
        },
      },
    },
    '/auth/reset-password/{token}': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password using token',
        parameters: [
          {
            name: 'token',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password', 'passwordConfirmation'],
                properties: {
                  password: { type: 'string', format: 'password' },
                  passwordConfirmation: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset successful' },
          400: { description: 'Invalid or expired token' },
        },
      },
    },
    '/auth/stats': {
      get: {
        tags: ['Auth'],
        summary: 'Get public platform statistics',
        responses: {
          200: {
            description: 'Public stats (total users, logs, etc.)',
          },
        },
      },
    },

    // ──────────────── Users ────────────────
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'Get all users (paginated)',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'List of users',
          },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update current user profile',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  newPassword: { type: 'string' },
                  newPasswordConfirm: { type: 'string' },
                  about: { type: 'string' },
                  timezone: { type: 'string' },
                  blurAdultContent: { type: 'string' },
                  avatar: { type: 'string', format: 'binary' },
                  banner: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User updated' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/users/search': {
      get: {
        tags: ['Users'],
        summary: 'Search users',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Search results' },
        },
      },
    },
    '/users/compare': {
      get: {
        tags: ['Users'],
        summary: 'Compare stats between users',
        parameters: [
          {
            name: 'users',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Comma-separated usernames',
          },
        ],
        responses: {
          200: { description: 'Comparison data' },
        },
      },
    },
    '/users/ranking': {
      get: {
        tags: ['Users'],
        summary: 'Get user rankings',
        parameters: [
          {
            name: 'period',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: { description: 'Ranking data' },
        },
      },
    },
    '/users/ranking/media': {
      get: {
        tags: ['Users'],
        summary: 'Get medium-specific rankings',
        parameters: [
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Medium ranking data' },
        },
      },
    },
    '/users/{username}': {
      get: {
        tags: ['Users'],
        summary: 'Get user profile by username',
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'User profile',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          404: { description: 'User not found' },
        },
      },
    },
    '/users/{username}/ranking-summary': {
      get: {
        tags: ['Users'],
        summary: 'Get ranking summary for a user',
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Ranking summary' },
        },
      },
    },
    '/users/{username}/logs': {
      get: {
        tags: ['Users'],
        summary: 'Get logs for a user',
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' },
          },
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'User logs' },
        },
      },
    },
    '/users/{username}/stats': {
      get: {
        tags: ['Users'],
        summary: 'Get detailed stats for a user',
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'User statistics' },
        },
      },
    },
    '/users/{username}/dashboard': {
      get: {
        tags: ['Users'],
        summary: 'Get dashboard data for a user',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Dashboard hours data' },
        },
      },
    },
    '/users/{username}/recentlogs': {
      get: {
        tags: ['Users'],
        summary: 'Get recent logs for a user',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Recent logs' },
        },
      },
    },
    '/users/{username}/immersionlist': {
      get: {
        tags: ['Users'],
        summary: "Get a user's immersion list",
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Immersion list' },
        },
      },
    },
    '/users/media/status': {
      post: {
        tags: ['Users'],
        summary: 'Update media completion status',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  mediaId: { type: 'string' },
                  type: { type: 'string' },
                  completed: { type: 'boolean' },
                  source: { type: 'string', enum: ['manual', 'auto'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Status updated' },
        },
      },
    },
    '/users/settings/hidden-media': {
      patch: {
        tags: ['Users'],
        summary: 'Update hidden recent media list',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  hiddenRecentMedia: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Settings updated' },
        },
      },
    },
    '/users/cleardata': {
      post: {
        tags: ['Users'],
        summary: 'Clear all user data',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: {
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Data cleared' },
        },
      },
    },
    '/users/export/csv': {
      get: {
        tags: ['Users'],
        summary: 'Export logs as CSV',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: {
            description: 'CSV file download',
            content: { 'text/csv': {} },
          },
        },
      },
    },

    // ──────────────── Logs ────────────────
    '/logs': {
      post: {
        tags: ['Logs'],
        summary: 'Create a new log',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateLog' },
            },
          },
        },
        responses: {
          201: {
            description: 'Log created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Log' },
              },
            },
          },
          400: { description: 'Validation error' },
        },
      },
    },
    '/logs/import': {
      post: {
        tags: ['Logs'],
        summary: 'Import logs from external services',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  forced: { type: 'boolean' },
                  logs: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Logs imported' },
        },
      },
    },
    '/logs/logfileimport': {
      post: {
        tags: ['Logs'],
        summary: 'Import logs from a CSV file',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['logFileImport', 'logImportType'],
                properties: {
                  logFileImport: { type: 'string', format: 'binary' },
                  logImportType: {
                    type: 'string',
                    enum: ['tmw', 'manabe', 'vncr', 'other', 'kechimochi'],
                    description: 'Format of the uploaded file',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Logs imported from file' },
        },
      },
    },
    '/logs/assign-media': {
      put: {
        tags: ['Logs'],
        summary: 'Assign media to untracked logs',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  logIds: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  mediaData: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Media assigned' },
        },
      },
    },
    '/logs/untrackedlogs': {
      get: {
        tags: ['Logs'],
        summary: 'Get untracked logs (no media assigned)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Untracked logs' },
        },
      },
    },
    '/logs/stats/logscreen': {
      get: {
        tags: ['Logs'],
        summary: 'Get log screen statistics',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Log screen stats' },
        },
      },
    },
    '/logs/stats/media': {
      get: {
        tags: ['Logs'],
        summary: 'Get user media statistics',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'User media stats' },
        },
      },
    },
    '/logs/stats/media/global': {
      get: {
        tags: ['Logs'],
        summary: 'Get global media statistics',
        responses: {
          200: { description: 'Global media stats' },
        },
      },
    },
    '/logs/media/recent': {
      get: {
        tags: ['Logs'],
        summary: 'Get recently logged media',
        responses: {
          200: { description: 'Recent media logs' },
        },
      },
    },
    '/logs/feed': {
      get: {
        tags: ['Logs'],
        summary: 'Get global activity feed',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Global feed' },
        },
      },
    },
    '/logs/manabe-webhook': {
      post: {
        tags: ['Logs'],
        summary: 'Webhook for Manabe log imports',
        responses: {
          200: { description: 'Log imported' },
        },
      },
    },
    '/logs/sync-manabe-ids': {
      post: {
        tags: ['Logs'],
        summary: 'Sync Manabe IDs for existing logs',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'IDs synced' },
        },
      },
    },
    '/logs/{id}': {
      get: {
        tags: ['Logs'],
        summary: 'Get a specific log by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Log details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Log' },
              },
            },
          },
          404: { description: 'Log not found' },
        },
      },
      delete: {
        tags: ['Logs'],
        summary: 'Delete a log',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Log deleted' },
          404: { description: 'Log not found' },
        },
      },
      patch: {
        tags: ['Logs'],
        summary: 'Update a log',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  episodes: { type: 'number' },
                  pages: { type: 'number' },
                  chars: { type: 'number' },
                  time: { type: 'number' },
                  date: { type: 'string', format: 'date-time' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Log updated' },
        },
      },
    },

    // ──────────────── Media ────────────────
    '/media/search': {
      get: {
        tags: ['Media'],
        summary: 'Search media',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Search results' },
        },
      },
    },
    '/media/utils/avgcolor': {
      get: {
        tags: ['Media'],
        summary: 'Get average color of an image URL',
        parameters: [
          {
            name: 'url',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Average color data' },
        },
      },
    },
    '/media/youtube/video': {
      get: {
        tags: ['Media'],
        summary: 'Search for a YouTube video',
        parameters: [
          {
            name: 'url',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'YouTube video data' },
        },
      },
    },
    '/media/reviews/{reviewId}': {
      get: {
        tags: ['Media'],
        summary: 'Get a specific review by ID',
        parameters: [
          {
            name: 'reviewId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Review details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MediaReview' },
              },
            },
          },
          404: { description: 'Review not found' },
        },
      },
    },
    '/media/{mediaType}/{contentId}': {
      get: {
        tags: ['Media'],
        summary: 'Get media details',
        parameters: [
          {
            name: 'mediaType',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Media details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Media' },
              },
            },
          },
        },
      },
    },
    '/media/{mediaType}/{contentId}/reviews': {
      get: {
        tags: ['Media'],
        summary: 'Get reviews for media',
        parameters: [
          {
            name: 'mediaType',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Reviews list' },
        },
      },
      post: {
        tags: ['Media'],
        summary: 'Add a review for media',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'mediaType',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['summary', 'content'],
                properties: {
                  summary: { type: 'string' },
                  content: { type: 'string' },
                  rating: { type: 'number', minimum: 0, maximum: 10 },
                  hasSpoilers: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Review created' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/media/{mediaType}/{contentId}/reviews/{reviewId}': {
      put: {
        tags: ['Media'],
        summary: 'Edit a review',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'mediaType',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'reviewId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  summary: { type: 'string' },
                  content: { type: 'string' },
                  rating: { type: 'number' },
                  hasSpoilers: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Review updated' },
        },
      },
      delete: {
        tags: ['Media'],
        summary: 'Delete a review',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'mediaType',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'reviewId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Review deleted' },
        },
      },
    },
    '/media/{mediaType}/{contentId}/reviews/{reviewId}/like': {
      post: {
        tags: ['Media'],
        summary: 'Toggle like on a review',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'mediaType',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'reviewId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Like toggled' },
        },
      },
    },

    // ──────────────── Goals ────────────────
    '/goals/daily/{username}': {
      get: {
        tags: ['Goals'],
        summary: 'Get daily goals for a user',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Daily goals with progress' },
        },
      },
    },
    '/goals/daily': {
      post: {
        tags: ['Goals'],
        summary: 'Create a daily goal',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'target'],
                properties: {
                  type: {
                    type: 'string',
                    enum: ['time', 'chars', 'episodes', 'pages'],
                  },
                  target: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Goal created' },
        },
      },
    },
    '/goals/daily/{goalId}': {
      patch: {
        tags: ['Goals'],
        summary: 'Update a daily goal',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'goalId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  target: { type: 'number' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Goal updated' },
        },
      },
      delete: {
        tags: ['Goals'],
        summary: 'Delete a daily goal',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'goalId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Goal deleted' },
        },
      },
    },
    '/goals/long-term/{username}': {
      get: {
        tags: ['Goals'],
        summary: 'Get long-term goals for a user',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Long-term goals with progress' },
        },
      },
    },
    '/goals/long-term': {
      post: {
        tags: ['Goals'],
        summary: 'Create a long-term goal',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'type',
                  'totalTarget',
                  'targetDate',
                  'displayTimeframe',
                ],
                properties: {
                  type: {
                    type: 'string',
                    enum: ['time', 'chars', 'episodes', 'pages'],
                  },
                  totalTarget: { type: 'number' },
                  targetDate: { type: 'string', format: 'date-time' },
                  displayTimeframe: {
                    type: 'string',
                    enum: ['daily', 'weekly', 'monthly'],
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Goal created' },
        },
      },
    },
    '/goals/long-term/{goalId}': {
      patch: {
        tags: ['Goals'],
        summary: 'Update a long-term goal',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'goalId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  totalTarget: { type: 'number' },
                  targetDate: { type: 'string', format: 'date-time' },
                  displayTimeframe: { type: 'string' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Goal updated' },
        },
      },
      delete: {
        tags: ['Goals'],
        summary: 'Delete a long-term goal',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'goalId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Goal deleted' },
        },
      },
    },

    // ──────────────── Tags ────────────────
    '/tags': {
      post: {
        tags: ['Tags'],
        summary: 'Create a new tag',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'color'],
                properties: {
                  name: { type: 'string' },
                  color: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Tag created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Tag' },
              },
            },
          },
        },
      },
    },
    '/tags/user/{username}': {
      get: {
        tags: ['Tags'],
        summary: 'Get tags for a user',
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'User tags',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Tag' },
                },
              },
            },
          },
        },
      },
    },
    '/tags/{id}': {
      patch: {
        tags: ['Tags'],
        summary: 'Update a tag',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  color: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Tag updated' },
        },
      },
      delete: {
        tags: ['Tags'],
        summary: 'Delete a tag',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Tag deleted' },
        },
      },
    },

    // ──────────────── Clubs ────────────────
    '/clubs': {
      get: {
        tags: ['Clubs'],
        summary: 'Get all clubs (paginated, filterable)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' },
          },
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Club list' },
        },
      },
      post: {
        tags: ['Clubs'],
        summary: 'Create a new club',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  isPublic: { type: 'boolean' },
                  tags: { type: 'string', description: 'JSON array string' },
                  rules: { type: 'string' },
                  avatar: { type: 'string', format: 'binary' },
                  banner: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Club created' },
        },
      },
    },
    '/clubs/user/my-clubs': {
      get: {
        tags: ['Clubs'],
        summary: "Get the current user's clubs",
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: "User's clubs" },
        },
      },
    },
    '/clubs/{clubId}': {
      get: {
        tags: ['Clubs'],
        summary: 'Get club details',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Club details' },
        },
      },
      put: {
        tags: ['Clubs'],
        summary: 'Update club (leaders only)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  isPublic: { type: 'boolean' },
                  tags: { type: 'string' },
                  rules: { type: 'string' },
                  avatar: { type: 'string', format: 'binary' },
                  banner: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Club updated' },
        },
      },
    },
    '/clubs/{clubId}/recent-activity': {
      get: {
        tags: ['Clubs'],
        summary: 'Get recent club activity',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Recent activity entries' },
        },
      },
    },
    '/clubs/{clubId}/join': {
      post: {
        tags: ['Clubs'],
        summary: 'Join a club',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Joined or request sent' },
        },
      },
    },
    '/clubs/{clubId}/leave': {
      post: {
        tags: ['Clubs'],
        summary: 'Leave a club',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Left club' },
        },
      },
    },
    '/clubs/{clubId}/transfer-leadership': {
      post: {
        tags: ['Clubs'],
        summary: 'Transfer club leadership',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newLeaderId'],
                properties: {
                  newLeaderId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Leadership transferred' },
        },
      },
    },
    '/clubs/{clubId}/members/pending': {
      get: {
        tags: ['Clubs'],
        summary: 'Get pending join requests',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Pending requests' },
        },
      },
    },
    '/clubs/{clubId}/members/{memberId}': {
      post: {
        tags: ['Clubs'],
        summary: 'Approve or reject join request',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'memberId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: {
                    type: 'string',
                    enum: ['approve', 'reject'],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Request processed' },
        },
      },
    },
    '/clubs/{clubId}/members/{memberId}/kick': {
      post: {
        tags: ['Clubs'],
        summary: 'Kick a club member',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'memberId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Member kicked' },
        },
      },
    },
    '/clubs/{clubId}/media': {
      post: {
        tags: ['Clubs'],
        summary: 'Add media to club',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  mediaId: { type: 'string' },
                  mediaType: { type: 'string' },
                  title: { type: 'string' },
                  startDate: { type: 'string', format: 'date-time' },
                  endDate: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Media added' },
        },
      },
      get: {
        tags: ['Clubs'],
        summary: 'Get club media',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Club media list' },
        },
      },
    },
    '/clubs/{clubId}/media/{mediaId}': {
      put: {
        tags: ['Clubs'],
        summary: 'Edit club media',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'mediaId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Media updated' },
        },
      },
    },
    '/clubs/{clubId}/media/{mediaId}/logs': {
      get: {
        tags: ['Clubs'],
        summary: 'Get club member logs for specific media',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'mediaId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Media logs' },
        },
      },
    },
    '/clubs/{clubId}/media/{mediaId}/rankings': {
      get: {
        tags: ['Clubs'],
        summary: 'Get club member rankings for specific media',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'mediaId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Media rankings' },
        },
      },
    },
    '/clubs/{clubId}/media/{mediaId}/stats': {
      get: {
        tags: ['Clubs'],
        summary: 'Get club media statistics',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'mediaId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Media stats' },
        },
      },
    },
    '/clubs/{clubId}/rankings': {
      get: {
        tags: ['Clubs'],
        summary: 'Get overall club member rankings',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Member rankings' },
        },
      },
    },
    '/clubs/{clubId}/votings': {
      post: {
        tags: ['Clubs'],
        summary: 'Create a media voting session',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          201: { description: 'Voting created' },
        },
      },
      get: {
        tags: ['Clubs'],
        summary: 'Get media votings for a club',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Votings list' },
        },
      },
    },
    '/clubs/{clubId}/votings/{votingId}': {
      put: {
        tags: ['Clubs'],
        summary: 'Edit a media voting',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'votingId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Voting updated' },
        },
      },
      delete: {
        tags: ['Clubs'],
        summary: 'Delete a media voting',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'votingId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Voting deleted' },
        },
      },
    },
    '/clubs/{clubId}/votings/{votingId}/candidates': {
      post: {
        tags: ['Clubs'],
        summary: 'Add a candidate to a voting',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'votingId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Candidate added' },
        },
      },
    },
    '/clubs/{clubId}/votings/{votingId}/finalize': {
      post: {
        tags: ['Clubs'],
        summary: 'Finalize voting setup',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'votingId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Voting finalized' },
        },
      },
    },
    '/clubs/{clubId}/votings/{votingId}/vote/{candidateIndex}': {
      post: {
        tags: ['Clubs'],
        summary: 'Vote for a candidate',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'votingId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'candidateIndex',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: { description: 'Vote cast' },
        },
      },
    },
    '/clubs/{clubId}/votings/{votingId}/complete': {
      post: {
        tags: ['Clubs'],
        summary: 'Complete voting and select winner',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'votingId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Voting completed' },
        },
      },
    },

    // ──────────────── Changelogs ────────────────
    '/changelogs': {
      get: {
        tags: ['Changelogs'],
        summary: 'Get published changelogs',
        responses: {
          200: {
            description: 'Published changelogs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Changelog' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Changelogs'],
        summary: 'Create a changelog (admin only)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['version', 'title', 'description', 'changes'],
                properties: {
                  version: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  changes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        description: { type: 'string' },
                      },
                    },
                  },
                  published: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Changelog created' },
        },
      },
    },
    '/changelogs/admin/all': {
      get: {
        tags: ['Changelogs'],
        summary: 'Get all changelogs including drafts (admin only)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'All changelogs' },
        },
      },
    },
    '/changelogs/{id}': {
      get: {
        tags: ['Changelogs'],
        summary: 'Get a specific changelog',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Changelog details' },
        },
      },
      patch: {
        tags: ['Changelogs'],
        summary: 'Update a changelog (admin only)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Changelog updated' },
        },
      },
      delete: {
        tags: ['Changelogs'],
        summary: 'Delete a changelog (admin only)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Changelog deleted' },
        },
      },
    },

    // ──────────────── Text Sessions ────────────────
    '/texthooker/recent': {
      get: {
        tags: ['Text Sessions'],
        summary: 'Get recent text sessions',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Recent sessions' },
        },
      },
    },
    '/texthooker/room/{roomId}/exists': {
      get: {
        tags: ['Text Sessions'],
        summary: 'Check if a room exists',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'roomId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Room existence status' },
        },
      },
    },
    '/texthooker/{contentId}': {
      get: {
        tags: ['Text Sessions'],
        summary: 'Get session by content ID',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Session data' },
        },
      },
      delete: {
        tags: ['Text Sessions'],
        summary: 'Delete a session',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Session deleted' },
        },
      },
    },
    '/texthooker/{contentId}/lines': {
      post: {
        tags: ['Text Sessions'],
        summary: 'Add lines to a session',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Lines added' },
        },
      },
      delete: {
        tags: ['Text Sessions'],
        summary: 'Remove lines from a session',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Lines removed' },
        },
      },
    },
    '/texthooker/{contentId}/lines/all': {
      delete: {
        tags: ['Text Sessions'],
        summary: 'Clear all lines from a session',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'All lines cleared' },
        },
      },
    },
    '/texthooker/{contentId}/timer': {
      patch: {
        tags: ['Text Sessions'],
        summary: 'Update session timer',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Timer updated' },
        },
      },
    },
    '/texthooker/{contentId}/history': {
      post: {
        tags: ['Text Sessions'],
        summary: 'Add a session history entry',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'contentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'History entry added' },
        },
      },
    },

    // ──────────────── Patreon ────────────────
    '/patreon/status': {
      get: {
        tags: ['Patreon'],
        summary: 'Get Patreon status for current user',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Patreon status data' },
        },
      },
    },
    '/patreon/link': {
      post: {
        tags: ['Patreon'],
        summary: 'Link Patreon account',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Account linked' },
        },
      },
    },
    '/patreon/unlink': {
      post: {
        tags: ['Patreon'],
        summary: 'Unlink Patreon account',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Account unlinked' },
        },
      },
    },
    '/patreon/badge': {
      patch: {
        tags: ['Patreon'],
        summary: 'Update custom badge text',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customBadgeText: { type: 'string', maxLength: 20 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Badge text updated' },
        },
      },
    },
    '/patreon/badge-colors': {
      patch: {
        tags: ['Patreon'],
        summary: 'Update badge colors',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  badgeColor: { type: 'string' },
                  badgeTextColor: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Badge colors updated' },
        },
      },
    },
    '/patreon/oauth/init': {
      get: {
        tags: ['Patreon'],
        summary: 'Initiate Patreon OAuth2 flow',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          302: { description: 'Redirect to Patreon OAuth page' },
        },
      },
    },
    '/patreon/oauth/callback': {
      get: {
        tags: ['Patreon'],
        summary: 'Handle Patreon OAuth2 callback',
        parameters: [
          {
            name: 'code',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'state',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          302: { description: 'Redirect after OAuth completion' },
        },
      },
    },
    '/patreon/webhook': {
      post: {
        tags: ['Patreon'],
        summary: 'Patreon webhook endpoint',
        description:
          'Receives Patreon webhook events. Verified by signature header.',
        responses: {
          200: { description: 'Webhook processed' },
        },
      },
    },

    // ──────────────── API Keys ────────────────
    '/api-keys': {
      post: {
        tags: ['API Keys'],
        summary: 'Generate a new API key',
        description:
          'Creates a new API key. The raw key is returned ONLY in this response — store it securely.',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: {
                    type: 'string',
                    maxLength: 100,
                    description: 'A label for this API key',
                    example: 'My Script',
                  },
                  expiresAt: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Optional expiration date',
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'API key created — raw key returned once',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiKeyResponse' },
              },
            },
          },
          400: {
            description: 'Validation error or max keys reached',
          },
        },
      },
      get: {
        tags: ['API Keys'],
        summary: 'List your API keys',
        description:
          'Returns metadata for all your API keys. The raw key is never returned.',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: {
            description: 'API key list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ApiKeyListItem' },
                },
              },
            },
          },
        },
      },
    },
    '/api-keys/{id}': {
      delete: {
        tags: ['API Keys'],
        summary: 'Revoke an API key',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'API key ID to revoke',
          },
        ],
        responses: {
          200: { description: 'API key revoked' },
          404: { description: 'API key not found' },
        },
      },
    },

    // ──────────────── Upload ────────────────
    '/upload': {
      post: {
        tags: ['Upload'],
        summary: 'Upload an avatar image',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  avatar: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Upload result' },
        },
      },
    },
    '/upload/banner': {
      post: {
        tags: ['Upload'],
        summary: 'Upload a banner image',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  banner: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Upload result' },
        },
      },
    },

    // ──────────────── Admin ────────────────
    '/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Get admin dashboard stats',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Admin stats' },
          401: { description: 'Unauthorized (admin only)' },
        },
      },
    },
    '/admin/stats/patrons': {
      get: {
        tags: ['Admin'],
        summary: 'Get patron statistics',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Patron stats' },
        },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Get admin user list',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' },
          },
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Admin user list' },
        },
      },
    },
    '/admin/users/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Update a user by ID (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'User updated' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a user by ID (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'User deleted' },
        },
      },
    },
    '/admin/users/{id}/reset-password': {
      post: {
        tags: ['Admin'],
        summary: 'Reset a user password (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Password reset' },
        },
      },
    },
    '/admin/users/{id}/patreon': {
      post: {
        tags: ['Admin'],
        summary: 'Manually set Patreon status (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Patreon status set' },
        },
      },
    },
    '/admin/users/username/{username}/moderation': {
      get: {
        tags: ['Admin'],
        summary: 'Get user moderation data by username',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Moderation data' },
        },
      },
      patch: {
        tags: ['Admin'],
        summary: 'Update user moderation by username',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Moderation updated' },
        },
      },
    },
    '/admin/users/username/{username}/recalculate-streaks': {
      post: {
        tags: ['Admin'],
        summary: 'Recalculate streaks for a user (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Streaks recalculated' },
        },
      },
    },
    '/admin/logs': {
      get: {
        tags: ['Admin'],
        summary: 'Search logs (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Log search results' },
        },
      },
    },
    '/admin/logs/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete a log (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Log deleted' },
        },
      },
      put: {
        tags: ['Admin'],
        summary: 'Update a log (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Log updated' },
        },
      },
    },
    '/admin/patreon/sync': {
      post: {
        tags: ['Admin'],
        summary: 'Sync Patreon members (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Members synced' },
        },
      },
    },
    '/admin/recalculateStreaks': {
      get: {
        tags: ['Admin'],
        summary: 'Recalculate all user streaks (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Streaks recalculated' },
        },
      },
    },
    '/admin/recalculateStats': {
      get: {
        tags: ['Admin'],
        summary: 'Recalculate all user XP/stats (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Stats recalculated' },
        },
      },
    },
    '/admin/meilisearch/indexes': {
      get: {
        tags: ['Admin'],
        summary: 'Get Meilisearch indexes (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Index list' },
        },
      },
    },
    '/admin/meilisearch/indexes/{indexName}': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete a Meilisearch index (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'indexName',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Index deleted' },
        },
      },
    },
    '/admin/meilisearch/indexes/{indexName}/settings': {
      patch: {
        tags: ['Admin'],
        summary: 'Update Meilisearch index settings (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'indexName',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Settings updated' },
        },
      },
    },
    '/admin/meilisearch/sync': {
      post: {
        tags: ['Admin'],
        summary: 'Sync all Meilisearch indexes (admin)',
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        responses: {
          200: { description: 'Indexes synced' },
        },
      },
    },
  },
};

const router = Router();

router.use('/', swaggerUi.serve);
router.get(
  '/',
  swaggerUi.setup(swaggerDocument, {
    customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { font-size: 2rem; }
  `,
    customSiteTitle: 'NihongoTracker API Docs',
  })
);

export default router;
