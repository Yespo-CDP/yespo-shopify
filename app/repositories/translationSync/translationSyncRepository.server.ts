import type {
  TranslationSyncCreate,
  TranslationSyncRecord,
} from "~/@types/translationSync";

export default interface TranslationSyncRepository {
  getByKeys(
    shopId: number,
    keys: Array<{ productId: string; locale: string; marketId: string }>,
  ): Promise<TranslationSyncRecord[]>;

  createOrUpdate(data: TranslationSyncCreate): Promise<TranslationSyncRecord>;
}
