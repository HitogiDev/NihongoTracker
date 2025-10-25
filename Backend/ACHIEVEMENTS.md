# Achievement System Documentation

## Overview
The achievement system gamifies the user experience by rewarding users for reaching milestones and accomplishing specific goals in their Japanese immersion journey.

## Architecture

### Database Models

#### Achievement Model (`Backend/src/models/achievement.model.ts`)
Stores the definitions of all available achievements in the system.

**Key Fields:**
- `key`: Unique identifier (e.g., 'first_log', 'streak_30')
- `name`: Display name (e.g., 'First Steps', 'Week Warrior')
- `description`: User-facing description
- `icon`: Emoji or icon identifier
- `category`: Achievement category (general, reading, listening, anime, manga, vn, video, streak, level, social)
- `rarity`: Achievement rarity (C, B, A, S, SS, SSR) - gacha style
- `criteria`: Object defining unlock conditions
- `points`: Points awarded when unlocked
- `hidden`: Whether the achievement is secret

#### User Achievement Integration
User achievements are embedded in the User model:
- `achievements[]`: Array of unlocked achievements with unlock dates
- `achievementPoints`: Total points accumulated

### Achievement Categories

1. **GENERAL** - Overall activity (total logs, total XP)
2. **READING** - Reading-related activities (pages, characters, reading level)
3. **LISTENING** - Listening activities (hours, listening level)
4. **ANIME** - Anime watching (episodes)
5. **MANGA** - Manga reading
6. **VN** - Visual novel reading
7. **VIDEO** - Video watching
8. **STREAK** - Consecutive day streaks
9. **LEVEL** - User level milestones
10. **SOCIAL** - Club memberships and interactions

### Achievement Rarities (Gacha Style)

Achievements use a gacha-style rarity system inspired by popular games:

- **C (Common)** - 50-60% of achievements
  - Easy, early achievements (5-10 points)
  - First steps and beginner milestones
  - Examples: First log, first club join, reach level 10

- **B (Uncommon)** - 25-30% of achievements
  - Regular milestones (15-25 points)
  - Moderate effort required
  - Examples: 100 logs, 30-day streak, 1000 pages

- **A (Rare)** - 10-15% of achievements
  - Challenging milestones (40-60 points)
  - Significant effort required
  - Examples: 500 logs, 100-day streak, reach level 50

- **S (Super Rare)** - 5-8% of achievements
  - Difficult achievements (80-150 points)
  - Long-term dedication required
  - Examples: 1000 logs, 365-day streak, 5000 episodes

- **SS (Super Super Rare)** - 2-3% of achievements
  - Very difficult achievements (180-250 points)
  - Exceptional dedication required
  - Examples: Level 200, 10M characters read, 5000 hours

- **SSR (Super Super Rare+)** - <1% of achievements
  - Legendary achievements (300-500+ points)
  - Ultimate goals for the most dedicated users
  - Examples: 1000-day streak, 10,000 episodes, 1M XP

### Achievement Tiers

**Note:** This system uses **rarities** (C, B, A, S, SS, SSR) instead of traditional tiers. The rarity indicates how difficult the achievement is to obtain, similar to gacha games.

### Criteria Types

The achievement system supports various criteria types:

- `total_xp`: Overall experience points
- `category_xp`: Reading or listening XP
- `level_reached`: Overall user level
- `category_level`: Reading or listening level
- `streak_days`: Longest streak in days
- `total_logs`: Total number of logs created
- `category_logs`: Logs in specific categories (reading/listening)
- `episodes_watched`: Total anime episodes
- `pages_read`: Total pages read (manga, books)
- `chars_read`: Total characters read (VNs, books)
- `hours_listened`: Total listening hours
- `club_member`: Number of clubs joined
- `club_owner`: Number of clubs owned

## API Endpoints

### Public Endpoints
- `GET /api/achievements/public` - Get all non-hidden achievements

### User Endpoints (Authenticated)
- `GET /api/achievements/me` - Get current user's achievements with progress
- `POST /api/achievements/check` - Check and award new achievements
- `GET /api/achievements/:achievementId/progress` - Get progress for specific achievement
- `GET /api/achievements/user/:userId` - Get another user's achievements
- `GET /api/achievements/stats/:userId` - Get achievement statistics for a user

### Admin Endpoints
- `GET /api/achievements/all` - Get all achievements (including hidden)
- `POST /api/achievements` - Create new achievement
- `PATCH /api/achievements/:id` - Update achievement
- `DELETE /api/achievements/:id` - Delete achievement

## Usage

### Seeding Initial Achievements

```bash
# From Backend directory
npm run seed:achievements
```

This will populate the database with the initial set of achievements defined in `scripts/seedAchievements.ts`.

### Checking Achievements Programmatically

```typescript
import { checkAndAwardAchievements } from '../services/achievements.js';

// After a user action (e.g., creating a log)
const newAchievements = await checkAndAwardAchievements(userId);
if (newAchievements.length > 0) {
  // Notify user of new achievements
  console.log('Unlocked:', newAchievements.map(a => a.name));
}
```

### Getting Achievement Progress

```typescript
import { getUserAchievementsWithProgress } from '../services/achievements.js';

const { unlocked, locked } = await getUserAchievementsWithProgress(userId);
// unlocked: achievements user has earned
// locked: achievements still available with progress percentage
```

## Frontend Integration (TODO)

The frontend will need:

1. **Achievement Display Components**
   - Achievement card (shows icon, name, description, tier)
   - Achievement list (grid/list of achievements)
   - Progress bar for locked achievements

2. **Achievement Notification**
   - Toast/modal when new achievement is unlocked
   - Animation/confetti effect

3. **Achievement Stats Dashboard**
   - Total achievements unlocked
   - Completion percentage
   - Points accumulated
   - Breakdown by category/tier
   - Recent unlocks

4. **Profile Achievement Showcase**
   - Display selected achievements on profile
   - Achievement badges/pins

## Adding New Achievements

### Option 1: Via Seed Script (Recommended for initial setup)
Add to `Backend/src/scripts/seedAchievements.ts`:

```typescript
{
  key: 'unique_key',
  name: 'Achievement Name',
  description: 'Achievement description',
  icon: '🏆',
  category: AchievementCategory.READING,
  rarity: AchievementRarity.A,  // C, B, A, S, SS, or SSR
  criteria: {
    type: 'pages_read',
    threshold: 10000
  },
  points: 50,
  hidden: false,
}
```

### Option 2: Via API (Admin only)
```bash
POST /api/achievements
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "key": "unique_key",
  "name": "Achievement Name",
  "description": "Description",
  "icon": "🏆",
  "category": "reading",
  "rarity": "A",
  "criteria": {
    "type": "pages_read",
    "threshold": 10000
  },
  "points": 50,
  "hidden": false
}
```

## Achievement Check Triggers

Achievements should be checked when:
1. ✅ User creates a new log
2. ✅ User's XP/level changes
3. ✅ User's streak updates
4. User joins a club
5. User creates a club
6. Manual check via API endpoint

### Recommended Integration Points

Add achievement checks to:
- `controllers/logs.controller.ts` - After `createLog()` and `importLogs()`
- `controllers/club.controller.ts` - After joining/creating clubs
- Streak calculation service - After streak updates

Example:
```typescript
// In createLog function, after saving log
await log.save();
await updateStats(userId);

// Check for new achievements
import { checkAndAwardAchievements } from '../services/achievements.js';
const newAchievements = await checkAndAwardAchievements(userId);

// Return achievements in response
res.status(201).json({ 
  log, 
  newAchievements 
});
```

## Future Enhancements

- [ ] Achievement sharing on social media
- [ ] Rare/seasonal achievements
- [ ] Achievement leaderboards
- [ ] Custom user-created challenges
- [ ] Achievement rewards (badges, titles, perks)
- [ ] Retroactive achievement unlocking for existing users
- [ ] Achievement suggestions based on user activity
- [ ] Progressive achievements (multi-tier single achievement)
- [ ] Time-limited achievements
- [ ] Collaborative club achievements

## Database Indexes

The following indexes are automatically created:
- `Achievement.key` (unique)
- `User.achievements.achievement` (for lookup)

## Testing

Test achievement unlock:
```bash
# Get current user's achievements
GET /api/achievements/me

# Trigger achievement check
POST /api/achievements/check

# View progress on specific achievement
GET /api/achievements/<achievementId>/progress
```

## Notes

- Achievements are checked manually via API call, not automatically on every action
- Hidden achievements don't appear in public lists but can still be unlocked
- Achievement points can be used for future gamification features
- Users can only view their own detailed achievement progress (unless admin)
- Deleting an achievement removes it from all users
