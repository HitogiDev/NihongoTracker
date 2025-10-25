import Achievement from '../models/achievement.model.js';
import { AchievementCategory, AchievementRarity } from '../types.js';

/**
 * Seed initial achievements into the database
 * This should be run once to populate the achievements collection
 *
 * Rarity Distribution (Gacha Style):
 * C (Common) - 50-60% - Easy, early achievements
 * B (Uncommon) - 25-30% - Regular milestones
 * A (Rare) - 10-15% - Challenging milestones
 * S (Super Rare) - 5-8% - Difficult achievements
 * SS (Super Super Rare) - 2-3% - Very difficult
 * SSR (Super Super Rare+) - <1% - Legendary achievements
 */
export async function seedAchievements() {
  const achievements = [
    // General Achievements (C-S rarities)
    {
      key: 'first_log',
      name: 'First Steps',
      description: 'Log your first immersion activity',
      icon: '🎯',
      category: AchievementCategory.GENERAL,
      rarity: AchievementRarity.C,
      criteria: { type: 'total_logs' as const, threshold: 1 },
      points: 5,
      hidden: false,
    },
    {
      key: 'log_enthusiast',
      name: 'Log Enthusiast',
      description: 'Create 100 logs',
      icon: '📝',
      category: AchievementCategory.GENERAL,
      rarity: AchievementRarity.B,
      criteria: { type: 'total_logs' as const, threshold: 100 },
      points: 15,
      hidden: false,
    },
    {
      key: 'log_master',
      name: 'Log Master',
      description: 'Create 500 logs',
      icon: '📚',
      category: AchievementCategory.GENERAL,
      rarity: AchievementRarity.A,
      criteria: { type: 'total_logs' as const, threshold: 500 },
      points: 40,
      hidden: false,
    },
    {
      key: 'log_legend',
      name: 'Log Legend',
      description: 'Create 1000 logs',
      icon: '👑',
      category: AchievementCategory.GENERAL,
      rarity: AchievementRarity.S,
      criteria: { type: 'total_logs' as const, threshold: 1000 },
      points: 80,
      hidden: false,
    },

    // Level Achievements (C-SS rarities)
    {
      key: 'level_10',
      name: 'Novice',
      description: 'Reach level 10',
      icon: '⭐',
      category: AchievementCategory.LEVEL,
      rarity: AchievementRarity.C,
      criteria: { type: 'level_reached' as const, threshold: 10 },
      points: 10,
      hidden: false,
    },
    {
      key: 'level_25',
      name: 'Intermediate',
      description: 'Reach level 25',
      icon: '⭐⭐',
      category: AchievementCategory.LEVEL,
      rarity: AchievementRarity.B,
      criteria: { type: 'level_reached' as const, threshold: 25 },
      points: 20,
      hidden: false,
    },
    {
      key: 'level_50',
      name: 'Advanced',
      description: 'Reach level 50',
      icon: '⭐⭐⭐',
      category: AchievementCategory.LEVEL,
      rarity: AchievementRarity.A,
      criteria: { type: 'level_reached' as const, threshold: 50 },
      points: 50,
      hidden: false,
    },
    {
      key: 'level_100',
      name: 'Master',
      description: 'Reach level 100',
      icon: '💫',
      category: AchievementCategory.LEVEL,
      rarity: AchievementRarity.S,
      criteria: { type: 'level_reached' as const, threshold: 100 },
      points: 100,
      hidden: false,
    },
    {
      key: 'level_200',
      name: 'Transcendent',
      description: 'Reach level 200',
      icon: '✨',
      category: AchievementCategory.LEVEL,
      rarity: AchievementRarity.SS,
      criteria: { type: 'level_reached' as const, threshold: 200 },
      points: 200,
      hidden: false,
    },

    // Streak Achievements (C-SSR rarities)
    {
      key: 'streak_7',
      name: 'Week Warrior',
      description: 'Maintain a 7-day streak',
      icon: '🔥',
      category: AchievementCategory.STREAK,
      rarity: AchievementRarity.C,
      criteria: { type: 'streak_days' as const, threshold: 7 },
      points: 10,
      hidden: false,
    },
    {
      key: 'streak_30',
      name: 'Monthly Dedication',
      description: 'Maintain a 30-day streak',
      icon: '🔥🔥',
      category: AchievementCategory.STREAK,
      rarity: AchievementRarity.B,
      criteria: { type: 'streak_days' as const, threshold: 30 },
      points: 25,
      hidden: false,
    },
    {
      key: 'streak_100',
      name: 'Century Streak',
      description: 'Maintain a 100-day streak',
      icon: '🔥🔥🔥',
      category: AchievementCategory.STREAK,
      rarity: AchievementRarity.A,
      criteria: { type: 'streak_days' as const, threshold: 100 },
      points: 60,
      hidden: false,
    },
    {
      key: 'streak_365',
      name: 'Year of Dedication',
      description: 'Maintain a 365-day streak',
      icon: '💥',
      category: AchievementCategory.STREAK,
      rarity: AchievementRarity.S,
      criteria: { type: 'streak_days' as const, threshold: 365 },
      points: 120,
      hidden: false,
    },
    {
      key: 'streak_1000',
      name: 'Eternal Flame',
      description: 'Maintain a 1000-day streak',
      icon: '🌟',
      category: AchievementCategory.STREAK,
      rarity: AchievementRarity.SSR,
      criteria: { type: 'streak_days' as const, threshold: 1000 },
      points: 300,
      hidden: false,
    },

    // Reading Achievements (C-SS rarities)
    {
      key: 'reading_level_10',
      name: 'Reading Initiate',
      description: 'Reach reading level 10',
      icon: '📖',
      category: AchievementCategory.READING,
      rarity: AchievementRarity.C,
      criteria: {
        type: 'category_level' as const,
        category: 'reading',
        threshold: 10,
      },
      points: 10,
      hidden: false,
    },
    {
      key: 'reading_level_25',
      name: 'Reading Adept',
      description: 'Reach reading level 25',
      icon: '📚',
      category: AchievementCategory.READING,
      rarity: AchievementRarity.B,
      criteria: {
        type: 'category_level' as const,
        category: 'reading',
        threshold: 25,
      },
      points: 20,
      hidden: false,
    },
    {
      key: 'reading_level_50',
      name: 'Reading Expert',
      description: 'Reach reading level 50',
      icon: '📕',
      category: AchievementCategory.READING,
      rarity: AchievementRarity.A,
      criteria: {
        type: 'category_level' as const,
        category: 'reading',
        threshold: 50,
      },
      points: 50,
      hidden: false,
    },
    {
      key: 'reading_level_100',
      name: 'Reading Master',
      description: 'Reach reading level 100',
      icon: '📜',
      category: AchievementCategory.READING,
      rarity: AchievementRarity.S,
      criteria: {
        type: 'category_level' as const,
        category: 'reading',
        threshold: 100,
      },
      points: 100,
      hidden: false,
    },
    {
      key: 'chars_100k',
      name: 'Character Counter',
      description: 'Read 100,000 characters',
      icon: '💯',
      category: AchievementCategory.READING,
      rarity: AchievementRarity.B,
      criteria: { type: 'chars_read' as const, threshold: 100000 },
      points: 20,
      hidden: false,
    },
    {
      key: 'chars_1m',
      name: 'Million Character Club',
      description: 'Read 1,000,000 characters',
      icon: '🎊',
      category: AchievementCategory.READING,
      rarity: AchievementRarity.A,
      criteria: { type: 'chars_read' as const, threshold: 1000000 },
      points: 60,
      hidden: false,
    },
    {
      key: 'chars_10m',
      name: 'Character Collector',
      description: 'Read 10,000,000 characters',
      icon: '🏆',
      category: AchievementCategory.READING,
      rarity: AchievementRarity.SS,
      criteria: { type: 'chars_read' as const, threshold: 10000000 },
      points: 180,
      hidden: false,
    },
    {
      key: 'pages_1000',
      name: 'Page Turner',
      description: 'Read 1,000 pages',
      icon: '📄',
      category: AchievementCategory.READING,
      rarity: AchievementRarity.B,
      criteria: { type: 'pages_read' as const, threshold: 1000 },
      points: 20,
      hidden: false,
    },
    {
      key: 'pages_5000',
      name: 'Bookworm',
      description: 'Read 5,000 pages',
      icon: '🐛',
      category: AchievementCategory.READING,
      rarity: AchievementRarity.A,
      criteria: { type: 'pages_read' as const, threshold: 5000 },
      points: 55,
      hidden: false,
    },
    {
      key: 'pages_20000',
      name: 'Library Dweller',
      description: 'Read 20,000 pages',
      icon: '📚',
      category: AchievementCategory.READING,
      rarity: AchievementRarity.S,
      criteria: { type: 'pages_read' as const, threshold: 20000 },
      points: 140,
      hidden: false,
    },

    // Listening Achievements (C-SS rarities)
    {
      key: 'listening_level_10',
      name: 'Listening Initiate',
      description: 'Reach listening level 10',
      icon: '🎧',
      category: AchievementCategory.LISTENING,
      rarity: AchievementRarity.C,
      criteria: {
        type: 'category_level' as const,
        category: 'listening',
        threshold: 10,
      },
      points: 10,
      hidden: false,
    },
    {
      key: 'listening_level_25',
      name: 'Listening Adept',
      description: 'Reach listening level 25',
      icon: '🎵',
      category: AchievementCategory.LISTENING,
      rarity: AchievementRarity.B,
      criteria: {
        type: 'category_level' as const,
        category: 'listening',
        threshold: 25,
      },
      points: 20,
      hidden: false,
    },
    {
      key: 'listening_level_50',
      name: 'Listening Expert',
      description: 'Reach listening level 50',
      icon: '🎶',
      category: AchievementCategory.LISTENING,
      rarity: AchievementRarity.A,
      criteria: {
        type: 'category_level' as const,
        category: 'listening',
        threshold: 50,
      },
      points: 50,
      hidden: false,
    },
    {
      key: 'listening_level_100',
      name: 'Listening Master',
      description: 'Reach listening level 100',
      icon: '🎼',
      category: AchievementCategory.LISTENING,
      rarity: AchievementRarity.S,
      criteria: {
        type: 'category_level' as const,
        category: 'listening',
        threshold: 100,
      },
      points: 100,
      hidden: false,
    },
    {
      key: 'hours_100',
      name: 'Hundred Hours',
      description: 'Listen for 100 hours',
      icon: '⏰',
      category: AchievementCategory.LISTENING,
      rarity: AchievementRarity.B,
      criteria: { type: 'hours_listened' as const, threshold: 100 },
      points: 20,
      hidden: false,
    },
    {
      key: 'hours_500',
      name: 'Dedicated Listener',
      description: 'Listen for 500 hours',
      icon: '⏱️',
      category: AchievementCategory.LISTENING,
      rarity: AchievementRarity.A,
      criteria: { type: 'hours_listened' as const, threshold: 500 },
      points: 55,
      hidden: false,
    },
    {
      key: 'hours_1000',
      name: 'Thousand Hour Milestone',
      description: 'Listen for 1,000 hours',
      icon: '🎯',
      category: AchievementCategory.LISTENING,
      rarity: AchievementRarity.S,
      criteria: { type: 'hours_listened' as const, threshold: 1000 },
      points: 100,
      hidden: false,
    },
    {
      key: 'hours_5000',
      name: 'Audio Ascendant',
      description: 'Listen for 5,000 hours',
      icon: '👑',
      category: AchievementCategory.LISTENING,
      rarity: AchievementRarity.SS,
      criteria: { type: 'hours_listened' as const, threshold: 5000 },
      points: 250,
      hidden: false,
    },

    // Anime Achievements (C-SSR rarities)
    {
      key: 'episodes_100',
      name: 'Episode Enthusiast',
      description: 'Watch 100 episodes',
      icon: '📺',
      category: AchievementCategory.ANIME,
      rarity: AchievementRarity.C,
      criteria: { type: 'episodes_watched' as const, threshold: 100 },
      points: 10,
      hidden: false,
    },
    {
      key: 'episodes_500',
      name: 'Anime Addict',
      description: 'Watch 500 episodes',
      icon: '🎬',
      category: AchievementCategory.ANIME,
      rarity: AchievementRarity.B,
      criteria: { type: 'episodes_watched' as const, threshold: 500 },
      points: 25,
      hidden: false,
    },
    {
      key: 'episodes_1000',
      name: 'Binge Master',
      description: 'Watch 1,000 episodes',
      icon: '🍿',
      category: AchievementCategory.ANIME,
      rarity: AchievementRarity.A,
      criteria: { type: 'episodes_watched' as const, threshold: 1000 },
      points: 60,
      hidden: false,
    },
    {
      key: 'episodes_5000',
      name: 'Anime Connoisseur',
      description: 'Watch 5,000 episodes',
      icon: '🎭',
      category: AchievementCategory.ANIME,
      rarity: AchievementRarity.S,
      criteria: { type: 'episodes_watched' as const, threshold: 5000 },
      points: 150,
      hidden: false,
    },
    {
      key: 'episodes_10000',
      name: 'Otaku Legend',
      description: 'Watch 10,000 episodes',
      icon: '👾',
      category: AchievementCategory.ANIME,
      rarity: AchievementRarity.SSR,
      criteria: { type: 'episodes_watched' as const, threshold: 10000 },
      points: 350,
      hidden: false,
    },

    // Social Achievements (C-A rarities)
    {
      key: 'join_club',
      name: 'Social Butterfly',
      description: 'Join your first club',
      icon: '🦋',
      category: AchievementCategory.SOCIAL,
      rarity: AchievementRarity.C,
      criteria: { type: 'club_member' as const, threshold: 1 },
      points: 10,
      hidden: false,
    },
    {
      key: 'join_3_clubs',
      name: 'Club Hopper',
      description: 'Join 3 different clubs',
      icon: '🎪',
      category: AchievementCategory.SOCIAL,
      rarity: AchievementRarity.B,
      criteria: { type: 'club_member' as const, threshold: 3 },
      points: 20,
      hidden: false,
    },
    {
      key: 'join_5_clubs',
      name: 'Community Leader',
      description: 'Join 5 different clubs',
      icon: '🌐',
      category: AchievementCategory.SOCIAL,
      rarity: AchievementRarity.A,
      criteria: { type: 'club_member' as const, threshold: 5 },
      points: 40,
      hidden: false,
    },

    // Hidden/Secret Achievements (SSR rarity)
    {
      key: 'secret_dedication',
      name: 'Immersion Deity',
      description: 'A secret achievement for the truly dedicated...',
      icon: '⚡',
      category: AchievementCategory.GENERAL,
      rarity: AchievementRarity.SSR,
      criteria: { type: 'total_xp' as const, threshold: 1000000 },
      points: 500,
      hidden: true,
    },
  ];

  try {
    // Clear existing achievements (only in development)
    if (process.env.NODE_ENV !== 'production') {
      await Achievement.deleteMany({});
      console.log('Cleared existing achievements');
    }

    // Insert achievements, skipping duplicates
    for (const achievement of achievements) {
      const exists = await Achievement.findOne({ key: achievement.key });
      if (!exists) {
        await Achievement.create(achievement);
        console.log(
          `✅ Created achievement: ${achievement.name} (${achievement.rarity})`
        );
      } else {
        console.log(`⏭️  Skipped existing achievement: ${achievement.name}`);
      }
    }

    console.log(
      `\n🎉 Seeded ${achievements.length} achievements successfully!`
    );
    console.log('\nRarity Distribution:');
    console.log(
      `  C (Common): ${achievements.filter((a) => a.rarity === AchievementRarity.C).length}`
    );
    console.log(
      `  B (Uncommon): ${achievements.filter((a) => a.rarity === AchievementRarity.B).length}`
    );
    console.log(
      `  A (Rare): ${achievements.filter((a) => a.rarity === AchievementRarity.A).length}`
    );
    console.log(
      `  S (Super Rare): ${achievements.filter((a) => a.rarity === AchievementRarity.S).length}`
    );
    console.log(
      `  SS (Super Super Rare): ${achievements.filter((a) => a.rarity === AchievementRarity.SS).length}`
    );
    console.log(
      `  SSR (Ultra Rare): ${achievements.filter((a) => a.rarity === AchievementRarity.SSR).length}`
    );

    return achievements.length;
  } catch (error) {
    console.error('Error seeding achievements:', error);
    throw error;
  }
}
