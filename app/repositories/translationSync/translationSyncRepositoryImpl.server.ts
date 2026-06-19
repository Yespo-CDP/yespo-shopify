import type { PrismaClient } from "@prisma/client";

import type {
  TranslationSyncCreate,
  TranslationSyncRecord,
} from "~/@types/translationSync";
import type TranslationSyncRepository from "./translationSyncRepository.server";

export default class TranslationSyncRepositoryImpl
  implements TranslationSyncRepository
{
  constructor(readonly database: PrismaClient) {}

  async getByKeys(
    shopId: number,
    keys: Array<{ productId: string; locale: string; marketId: string }>,
  ): Promise<TranslationSyncRecord[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.database.translationSync.findMany({
      where: {
        shopId,
        OR: keys.map((key) => ({
          productId: key.productId,
          locale: key.locale,
          marketId: key.marketId,
        })),
      },
    });
  }

  async createOrUpdate(
    data: TranslationSyncCreate,
  ): Promise<TranslationSyncRecord> {
    const shopId = data.shop?.connect?.id;
    if (!shopId) {
      throw new Error("shopId is required for TranslationSync upsert");
    }

    return this.database.translationSync.upsert({
      where: {
        shopId_productId_locale_marketId: {
          shopId,
          productId: data.productId,
          locale: data.locale,
          marketId: data.marketId ?? "",
        },
      },
      create: data,
      update: {
        contentHash: data.contentHash,
        updatedAt: data.updatedAt,
      },
    });
  }
}
