import {useTranslation} from "react-i18next";
import {categoryPageLoaderHandler} from "~/lib/category-settings.server";
import {useLoaderData, useSearchParams} from "react-router";
import Autocomplete from "~/components/ui/Autocomplete";

export const loader = categoryPageLoaderHandler;

export default function CategorySettingsPage() {
  const {t} = useTranslation();
  const {collections, pageInfo, limit} = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  console.log('collections', collections)

  const entityOptions = [
    {value: 'type', label: 'Type'},
    {value: 'category', label: 'Category'},
  ]

  const typeOptions = [
    {value: '1', label: 'Type 1'},
    {value: '2', label: 'Type 2'},
    {value: '3', label: 'Type 3'},
    {value: '4', label: 'Type 4'},
  ]

  const categoryOptions = [
    {value: '1', label: 'Category 1'},
    {value: '2', label: 'Category 2'},
    {value: '3', label: 'Category 3'},
    {value: '4', label: 'Category 4'},
    {value: '5', label: 'Category 5'},
    {value: '6', label: 'Category 6'},
    {value: '7', label: 'Category 7'},
  ]



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
                    <s-table-row key={collection.id}>
                      <s-table-cell >
                        <s-stack direction={'inline'} gap={'small-200'} alignItems={'center'}>
                          {
                            collection.image?.url ? (
                              <s-thumbnail
                                alt={collection.title}
                                src={collection.image.url}
                                size={"small"}
                              />
                            ) : (
                              <s-stack border="base" borderRadius="base" blockSize="40px" inlineSize={'40px'} alignItems={'center'} justifyContent={'center'}>
                                <s-icon type="image" color={'subdued'}/>
                              </s-stack>
                            )
                          }
                          <s-text>{collection.title}</s-text>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        <s-stack direction={'inline'} gap={'small-200'} alignItems={'end'}>
                          <s-box inlineSize={'50%'}>
                            <s-select label={t("CategorySettings.selectEntity", "Select entity")}>
                              {entityOptions.map((option) => (
                                <s-option key={option.value} value={option.value}>
                                  {option.label}
                                </s-option>
                              ))}
                            </s-select>
                          </s-box>


                          <Autocomplete
                            id={collection.id}
                            label={t("CategorySettings.selectCategory", "Select category")}
                            placeholder={t("CategorySettings.searchPlaceholder", "Search categories")}
                            options={categoryOptions}
                            onChange={(value, label) => {
                              console.log(`Collection ${collection.id} - Selected:`, value, label);
                            }}
                          />
                        </s-stack>
                      </s-table-cell>
                    </s-table-row>
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
