import {useState} from "react";
import {useFetcher} from "react-router";
import CategoryAutocomplete from "~/components/ui/CategoryAutocomplete";
import ProductTypeAutocomplete from "~/components/ui/ProductTypeAutocomplete";
import {useTranslation} from "react-i18next";
import {ProductTypeOption} from "~/services/get-product-types.server";

interface MappingData {
  type: 'product_type' | 'category';
  value: string;
  name: string;
}

interface CategoryTableRowProps {
  id: string;
  imageUrl?: string;
  title: string;
  productTypes: ProductTypeOption[];
  mappingData?: MappingData | null;
}

const CATEGORY_TYPE_OPTIONS = [
  {value: 'type', label: 'Type'},
  {value: 'category', label: 'Category'},
];

const CategoryTableRow = ({
  id,
  title,
  imageUrl,
  productTypes = [],
  mappingData = null
}: CategoryTableRowProps) => {
  const {t} = useTranslation();
  // Determine initial entity type from mapping data
  const initialEntityType = mappingData?.type === 'category' ? 'category' : 'type';

  const [selectedEntity, setSelectedEntity] = useState<string>(initialEntityType);
  const fetcher = useFetcher();

  // Handle saving collection mapping
  const handleSaveMapping = (entityType: string, entityValue: string, entityName: string) => {
    const formData = new FormData();
    formData.append("intent", "save");
    formData.append("collectionId", id);
    formData.append("entityType", entityType);
    formData.append("entityName", entityName);

    fetcher.submit(formData, { method: "post" });
  };

  // Handle deleting collection mapping
  const handleDeleteMapping = () => {
    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("collectionId", id);

    fetcher.submit(formData, { method: "post" });
  };

  return (
    <s-table-row>
      <s-table-cell >
        <s-stack direction={'inline'} gap={'small-200'} alignItems={'center'}>
          {
            imageUrl? (
              <s-thumbnail
                alt={title}
                src={imageUrl}
                size={"small"}
              />
            ) : (
              <s-stack border="base" borderRadius="base" blockSize="40px" inlineSize={'40px'} alignItems={'center'} justifyContent={'center'}>
                <s-icon type="image" color={'subdued'}/>
              </s-stack>
            )
          }
          <s-text>{title}</s-text>
        </s-stack>
      </s-table-cell>
      <s-table-cell >
        <s-stack direction={'inline'} gap={'small-200'} alignItems={'end'}>
          <s-box inlineSize={'50%'}>
            <s-select
              label={t("CategorySettings.selectEntity", "Select entity")}
              value={selectedEntity}
              onChange={(e: Event) => {
                const target = e.currentTarget as HTMLSelectElement;
                setSelectedEntity(target.value);
              }}
              disabled={fetcher.state === "submitting"}
            >
              {CATEGORY_TYPE_OPTIONS.map((option) => (
                <s-option key={option.value} value={option.value}>
                  {option.label}
                </s-option>
              ))}
            </s-select>
          </s-box>

          {selectedEntity === 'type' ? (
            <ProductTypeAutocomplete
              id={`${id}-type`}
              label={t("CategorySettings.selectType", "Select type")}
              placeholder={t("CategorySettings.searchTypes", "Search types")}
              options={productTypes}
              value={mappingData?.type === 'product_type' ? mappingData.value : ''}
              onChange={(value, label) => {
                handleSaveMapping('type', value, label);
              }}
              disabled={fetcher.state === "submitting"}
            />
          ) : (
            <CategoryAutocomplete
              id={`${id}-category`}
              label={t("CategorySettings.selectCategory", "Select category")}
              placeholder={t("CategorySettings.searchCategories", "Search categories")}
              categoryName={mappingData?.type === 'category' ? mappingData.value : ''}
              onChange={(value, name) => {
                handleSaveMapping('category', value, name);
              }}
              disabled={fetcher.state === "submitting"}
            />
          )}

          <s-button
            icon="delete"
            tone={'critical'}
            onClick={handleDeleteMapping}
            disabled={fetcher.state === "submitting" || !mappingData}
          />
        </s-stack>
      </s-table-cell>
    </s-table-row>
  )
}

export default CategoryTableRow;
