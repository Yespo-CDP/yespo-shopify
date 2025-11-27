import {useState} from "react";
import Autocomplete from "~/components/ui/Autocomplete";
import {useTranslation} from "react-i18next";
import {ProductTypeOption} from "~/services/get-product-types.server";
import {CategoryOption} from "~/services/get-categories.server";

interface CategoryTableRowProps {
  id: string;
  imageUrl?: string;
  title: string;
  productTypes: ProductTypeOption[];
  categories: CategoryOption[];
}

const CategoryTableRow = ({
  id,
  title,
  imageUrl,
  productTypes = [],
  categories = []
}: CategoryTableRowProps) => {
  const {t} = useTranslation();
  const [selectedEntity, setSelectedEntity] = useState<string>('type');

  const entityOptions = [
    {value: 'type', label: 'Type'},
    {value: 'category', label: 'Category'},
  ];

  // Select options based on entity type
  const autocompleteOptions = selectedEntity === 'type' ? productTypes : categories;
  const autocompleteLabel = selectedEntity === 'type' 
    ? t("CategorySettings.selectType", "Select type")
    : t("CategorySettings.selectCategory", "Select category");
  const autocompletePlaceholder = selectedEntity === 'type'
    ? t("CategorySettings.searchTypes", "Search types")
    : t("CategorySettings.searchCategories", "Search categories");


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
      <s-table-cell>
        <s-stack direction={'inline'} gap={'small-200'} alignItems={'end'}>
          <s-box inlineSize={'50%'}>
            <s-select
              label={t("CategorySettings.selectEntity", "Select entity")}
              value={selectedEntity}
              onChange={(e: Event) => {
                const target = e.currentTarget as HTMLSelectElement;
                setSelectedEntity(target.value);
              }}
            >
              {entityOptions.map((option) => (
                <s-option key={option.value} value={option.value}>
                  {option.label}
                </s-option>
              ))}
            </s-select>
          </s-box>

          <Autocomplete
            id={`${id}-${selectedEntity}`}
            label={autocompleteLabel}
            placeholder={autocompletePlaceholder}
            options={autocompleteOptions}
            onChange={(value, label) => {
              console.log(`Collection ${id} - Entity: ${selectedEntity}, Selected:`, value, label);
            }}
          />
        </s-stack>
      </s-table-cell>
    </s-table-row>
  )
}

export default CategoryTableRow;
