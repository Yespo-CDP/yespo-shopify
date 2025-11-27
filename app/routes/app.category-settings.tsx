import {useTranslation} from "react-i18next";
import {categoryPageLoaderHandler} from "~/lib/category-settings.server";
import {useLoaderData, useSearchParams} from "react-router";
import CategoryTableRow from "~/components/ui/CategoryTableRow";

export const loader = categoryPageLoaderHandler;

export default function CategorySettingsPage() {
  const {t} = useTranslation();
  const {collections, pageInfo, limit, productTypes, categories} = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const handleNextPageLink = () => {
    const params = new URLSearchParams(searchParams);
    params.set("limit", String(limit));

    // reset cursor
    params.delete("after");

    if (pageInfo.hasNextPage && pageInfo.endCursor) {
      params.set("after", pageInfo.endCursor);
    }

    return `?${params.toString()}`;
  };

  return (
    <s-page heading={t("CategorySettings.title")}>
      <s-link slot="breadcrumb-actions" href="/app">
        {t("CategorySettings.breadcrumbs.mainPage")}
      </s-link>

      <s-section>
        <s-text>Update your product information and settings.</s-text>
      </s-section>

      <s-section padding="none">

        {
          collections.length === 0 ? (
            <s-text>{t("CategorySettings.collectionsEmpty", "No collections found")}</s-text>
          ) : (
            <s-table paginate hasPreviousPage hasNextPage onNextPage={() => console.log("next")} onPreviousPage={() => console.log("prev")}>
              <s-table-header-row>
                <s-table-header listSlot="secondary">Collection Name</s-table-header>
                <s-table-header listSlot={'primary'}>Status</s-table-header>
              </s-table-header-row>

              <s-table-body>
                {
                  collections.map((collection) => (
                    <CategoryTableRow key={collection.id} title={collection.title} id={collection.id} imageUrl={collection.image?.url} productTypes={productTypes} categories={categories}/>
                  ))
                }
              </s-table-body>
            </s-table>
          )
        }
      </s-section>
    </s-page>
  );
}
