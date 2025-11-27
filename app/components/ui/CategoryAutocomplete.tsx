import {type FC, useState, useEffect} from "react";
import {useFetcher} from "react-router";

interface CategoryOption {
  value: string;
  label: string;
}

interface CategoryAutocompleteProps {
  label: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string, name: string) => void;
  disabled?: boolean;
  id: string;
}

/**
 * Autocomplete component for selecting Shopify categories
 * Uses dynamic search with Shopify API
 * Displays only category name (not full path) in selected field
 */
const CategoryAutocomplete: FC<CategoryAutocompleteProps> = ({
  label,
  placeholder = "Search categories...",
  value = "",
  onChange,
  disabled = false,
  id,
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [selectedValue, setSelectedValue] = useState(value);
  const [selectedName, setSelectedName] = useState("");
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const fetcher = useFetcher();

  const popoverId = `category-autocomplete-${id}`;

  // Handle option selection
  const handleOptionSelect = (optionValue: string, optionLabel: string) => {
    // Extract only the name (last part after >)
    const nameParts = optionLabel.split('>').map(part => part.trim());
    const name = nameParts[nameParts.length - 1];
    
    setSelectedValue(optionValue);
    setSelectedName(name);
    
    // Set the name as search value and trigger search to refine results
    setSearchValue(name);
    
    console.log('[CategoryAutocomplete] Selected:', {
      id: optionValue,
      fullName: optionLabel,
      name: name
    });
    
    // Trigger search with the selected name
    fetcher.load(`/api/search-categories?search=${encodeURIComponent(name)}`);
    
    // Notify parent component
    onChange?.(optionValue, name);
  };

  // Handle reset
  const handleReset = () => {
    setSelectedValue("");
    setSelectedName("");
    setSearchValue("");
    setOptions([]);
    onChange?.("", "");
  };

  // Handle search input change
  const handleSearchChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const newSearchValue = target.value;
    setSearchValue(newSearchValue);

    // Trigger search when user types
    if (newSearchValue.trim().length > 0) {
      console.log('[CategoryAutocomplete] Searching for:', newSearchValue);
      fetcher.load(`/api/search-categories?search=${encodeURIComponent(newSearchValue)}`);
    } else {
      // Clear options if search is empty
      setOptions([]);
    }
  };

  // Update options when fetcher returns data
  useEffect(() => {
    if (fetcher.data && fetcher.data.categories) {
      console.log('[CategoryAutocomplete] Received categories:', fetcher.data.categories.length);
      setOptions(fetcher.data.categories);
    }
  }, [fetcher.data]);

  // Update selected name when value prop changes
  useEffect(() => {
    if (value && !selectedName) {
      // Try to find the name from current options
      const selectedOption = options.find((opt) => opt.value === value);
      if (selectedOption) {
        const nameParts = selectedOption.label.split('>').map(part => part.trim());
        const name = nameParts[nameParts.length - 1];
        setSelectedValue(value);
        setSelectedName(name);
      }
    }
  }, [value, options, selectedName]);

  return (
    <s-box>
      <s-stack direction={'inline'} gap={'small-200'} alignItems={'end'}>
        <s-box>
          <s-text-field
            label={label}
            value={selectedName}
            placeholder={placeholder}
            disabled={disabled}
            readOnly
          />
        </s-box>

        <s-button-group>
          <s-button
            slot="secondary-actions"
            commandFor={popoverId}
            icon="search"
            disabled={disabled}
          />
          <s-button
            slot="secondary-actions"
            icon="undo"
            onClick={handleReset}
            disabled={disabled || !selectedValue}
          />
        </s-button-group>
      </s-stack>

      <s-popover id={popoverId}>
        <s-box padding="small-200">
          <s-search-field
            label="Search"
            labelAccessibilityVisibility="exclusive"
            placeholder={placeholder}
            autocomplete={'on'}
            value={searchValue}
            onInput={handleSearchChange}
          />
        </s-box>

        <s-box padding="small-200">
          {fetcher.state === "loading" ? (
            <s-stack alignItems="center" gap="small-200">
              <s-spinner size="small" />
              <s-text tone="subdued">Loading...</s-text>
            </s-stack>
          ) : options.length > 0 ? (
            <s-stack gap="none">
              {options.map((option) => (
                <s-clickable
                  blockSize={'25px'}
                  key={option.value}
                  onClick={() => handleOptionSelect(option.value, option.label)}
                >
                  <s-text>{option.label}</s-text>
                </s-clickable>
              ))}
            </s-stack>
          ) : searchValue.trim().length > 0 ? (
            <s-text>No results found</s-text>
          ) : (
            <s-text tone="subdued">Start typing to search categories</s-text>
          )}
        </s-box>
      </s-popover>
    </s-box>
  );
};

export default CategoryAutocomplete;

