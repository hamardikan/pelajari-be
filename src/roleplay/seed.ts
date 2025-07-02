import type { Database } from '../config/database.js';
import type { Logger } from 'pino';
import { roleplayScenarios } from '../db/schema.js';
import { defaultRoleplayScenarios } from './seed-scenarios.js';

export async function seedRoleplayScenarios(db: Database, logger: Logger): Promise<void> {
  try {
    logger.info('Starting roleplay scenarios seeding...');

    for (const scenarioData of defaultRoleplayScenarios) {
      const scenarioWithAuthor = {
        ...scenarioData,
        authorId: 'system', // System-created scenarios
      };

      await db.insert(roleplayScenarios).values({
        data: scenarioWithAuthor,
      });

      logger.info({ title: scenarioData.title }, 'Seeded roleplay scenario');
    }

    logger.info({ count: defaultRoleplayScenarios.length }, 'Roleplay scenarios seeding completed');
  } catch (error) {
    logger.error({ error }, 'Failed to seed roleplay scenarios');
    throw error;
  }
} 