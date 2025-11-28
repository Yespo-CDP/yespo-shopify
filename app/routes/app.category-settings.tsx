import {useTranslation} from "react-i18next";
import {categoryPageLoaderHandler, categoryPageActionHandler} from "~/lib/category-settings.server";
import {useLoaderData, useSearchParams, useNavigate} from "react-router";
import CategoryTableRow from "~/components/ui/CategoryTableRow";
import {useState, useEffect} from "react";

export const loader = categoryPageLoaderHandler;
export const action = categoryPageActionHandler;

export default function CategorySettingsPage() {
  const {t} = useTranslation();
  const {collections, pageInfo, limit, productTypes} = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");

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

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentSearch = searchParams.get("search") || "";
      if (searchQuery !== currentSearch) {
        const params = new URLSearchParams(searchParams);
        params.set("limit", String(limit));
        params.delete("after");
        params.delete("before");

        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        } else {
          params.delete("search");
        }

        navigate(`?${params.toString()}`);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [searchQuery, searchParams, limit, navigate]);

  return (
    <s-page>
        <s-link slot="breadcrumb-actions" href="/app">
          {t("CategorySettings.breadcrumbs.mainPage")}
        </s-link>

        <s-box paddingBlockEnd={'small-200'}>
          <s-button icon='caret-left'  variant='tertiary' href='/app'>
            Back
          </s-button>
        </s-box>

      <s-section heading={t("CategorySettings.title")}>
        <s-text>{t('CategorySettings.description')}</s-text>
      </s-section>

      <s-section padding="none">
        <s-box padding={'small-200'}>
          <s-search-field
            label={t("CategorySettings.searchLabel")}
            value={searchQuery}
            onInput={(e: any) => setSearchQuery(e.target.value)}
            placeholder={t("CategorySettings.searchPlaceholder")}
          />
        </s-box>


        {
          collections.length === 0 ? (
            <s-box padding={'small-200'}>
              <s-text>{searchQuery ? t("CategorySettings.noResults") : t("CategorySettings.collectionsEmpty")}</s-text>
            </s-box>
          ) : (
              <s-table
                paginate
                hasPreviousPage={pageInfo.hasPreviousPage}
                hasNextPage={pageInfo.hasNextPage}
                onNextPage={handleNextPage}
                onPreviousPage={handlePreviousPage}
              >
              <s-table-header-row>
                <s-table-header>{t("CategorySettings.table.heading.collectionName")}</s-table-header>
                <s-table-header>{t("CategorySettings.table.heading.selectEntity")}</s-table-header>
                <s-table-header>
                  <div style={{textAlign: "center"}}>
                    {t("CategorySettings.table.heading.setUpValue")}
                  </div>
                </s-table-header>
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
