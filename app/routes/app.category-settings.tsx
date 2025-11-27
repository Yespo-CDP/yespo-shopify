import {useTranslation} from "react-i18next";
import {categoryPageLoaderHandler, categoryPageActionHandler} from "~/lib/category-settings.server";
import {useLoaderData, useSearchParams, useNavigate} from "react-router";
import CategoryTableRow from "~/components/ui/CategoryTableRow";

export const loader = categoryPageLoaderHandler;
export const action = categoryPageActionHandler;

export default function CategorySettingsPage() {
  const {t} = useTranslation();
  const {collections, pageInfo, limit, productTypes} = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const handleNextPage = () => {
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) return;

    const params = new URLSearchParams(searchParams);
    params.set("limit", String(limit));
    params.delete("before");
    params.set("after", pageInfo.endCursor);

    navigate(`?${params.toString()}`);
  };

  const handlePreviousPage = () => {
    if (!pageInfo.hasPreviousPage || !pageInfo.startCursor) return;

    const params = new URLSearchParams(searchParams);
    params.set("limit", String(limit));
    params.delete("after");
    params.set("before", pageInfo.startCursor);

    navigate(`?${params.toString()}`);
  };

  return (
    <s-page heading={t("CategorySettings.title")}>
      <s-link slot="breadcrumb-actions" href="/app">
        {t("CategorySettings.breadcrumbs.mainPage")}
      </s-link>

      <s-box paddingBlockEnd={'small-200'}>
        <s-button icon="caret-left" variant='tertiary' href='/app'>
          Back
        </s-button>
      </s-box>

      <s-section>
        <s-text>{t('CategorySettings.description')}</s-text>
      </s-section>

      <s-section padding="none">
        {
          collections.length === 0 ? (
            <s-text>{t("CategorySettings.collectionsEmpty")}</s-text>
          ) : (
            <s-table
              paginate
              hasPreviousPage={pageInfo.hasPreviousPage}
              hasNextPage={pageInfo.hasNextPage}
              onNextPage={handleNextPage}
              onPreviousPage={handlePreviousPage}
            >
              <s-table-header-row>
                <s-table-header listSlot="secondary">{t("CategorySettings.table.heading.collectionName")}</s-table-header>
                <s-table-header listSlot={'primary'}>{t("CategorySettings.table.heading.setUpValue")}</s-table-header>
              </s-table-header-row>

              <s-table-body>
                {
                  collections.map((collection) => {
                    // Extract metafields and parse JSON mapping
                    let mappingData = null;
                    const yespoMappingField = collection.metafield

                    if (yespoMappingField?.value) {
                      mappingData = JSON.parse(yespoMappingField.value);
                    }

                    return (
                      <CategoryTableRow
                        key={collection.id}
                        title={collection.title}
                        id={collection.id}
                        imageUrl={collection.image?.url}
                        productTypes={productTypes}
                        mappingData={mappingData}
                      />
                    );
                  })
                }
              </s-table-body>
            </s-table>
          )
        }
      </s-section>
    </s-page>
  );
}
