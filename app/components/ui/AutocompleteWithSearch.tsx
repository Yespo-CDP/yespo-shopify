import {type FC, useState, useEffect} from "react";
import {useFetcher} from "react-router";

/**
 * Props for the AutocompleteWithSearch component
 */
interface AutocompleteWithSearchProps {
  label: string;
  placeholder?: string;
  options: Array<{value: string; label: string}>;
  value?: string;
  onChange?: (value: string, label: string) => void;
  disabled?: boolean;
  id: string;
  enableDynamicSearch?: boolean; // Enable dynamic search for categories
}

/**
 * Autocomplete component with dynamic search support
 * For categories: fetches new options based on search input
 * For types: uses static options with client-side filtering
 */
const AutocompleteWithSearch: FC<AutocompleteWithSearchProps> = ({
  label,
  placeholder = "Search...",
  options: initialOptions,
  value = "",
  onChange,
  disabled = false,
  id,
  enableDynamicSearch = false,
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [selectedValue, setSelectedValue] = useState(value);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [options, setOptions] = useState(initialOptions);
  const fetcher = useFetcher();

  // Generate unique popover ID
  const popoverId = `autocomplete-popover-${id}`;

  // Filter options based on search value (client-side for types)
  const filteredOptions = enableDynamicSearch
    ? options
    : options.filter((option) =>
        option.label.toLowerCase().includes(searchValue.toLowerCase())
      );

  // Handle option selection
  const handleOptionSelect = (optionValue: string, optionLabel: string) => {
    setSelectedValue(optionValue);
    setSelectedLabel(optionLabel);
    setSearchValue("");
    onChange?.(optionValue, optionLabel);
  };

  // Handle reset
  const handleReset = () => {
    setSelectedValue("");
    setSelectedLabel("");
    setSearchValue("");
    onChange?.("", "");
  };

  // Handle search input change
  const handleSearchChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const newSearchValue = target.value;
    setSearchValue(newSearchValue);

    // Trigger dynamic search for categories
    if (enableDynamicSearch && newSearchValue.trim().length > 0) {
      console.log('[AutocompleteWithSearch] Searching for:', newSearchValue);
      fetcher.load(`/api/search-categories?search=${encodeURIComponent(newSearchValue)}`);
    }
  };

  // Update options when fetcher returns data (for dynamic search)
  useEffect(() => {
    if (enableDynamicSearch && fetcher.data) {
      console.log('[AutocompleteWithSearch] Fetcher data received:', fetcher.data);
      const newCategories = fetcher.data.categories || [];
      console.log('[AutocompleteWithSearch] Setting options:', newCategories.length);
      setOptions(newCategories);
    }
  }, [fetcher.data, enableDynamicSearch]);

  // Reset to initial options when search is cleared
  useEffect(() => {
    if (!enableDynamicSearch || searchValue.trim() === "") {
      setOptions(initialOptions);
    }
  }, [searchValue, initialOptions, enableDynamicSearch]);

  // Update selected label when value prop changes
  useEffect(() => {
    if (value) {
      const selectedOption = initialOptions.find((opt) => opt.value === value);
      if (selectedOption) {
        setSelectedValue(value);
        setSelectedLabel(selectedOption.label);
      }
    } else {
      setSelectedValue("");
      setSelectedLabel("");
    }
  }, [value, initialOptions]);

  return (
    <s-box>
      <s-stack direction={'inline'} gap={'small-200'} alignItems={'end'}>
        <s-box>
          <s-text-field
            label={label}
            value={selectedLabel}
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
          {fetcher.state === "loading" && enableDynamicSearch ? (
            <s-stack alignItems="center" gap="small-200">
              <s-spinner size="base" />
              <s-text>Loading...</s-text>
            </s-stack>
          ) : filteredOptions.length > 0 ? (
            <s-stack gap="none">
              {filteredOptions.map((option) => (
                <s-clickable
                  blockSize={'25px'}
                  key={option.value}
                  onClick={() => handleOptionSelect(option.value, option.label)}
                >
                  <s-text>{option.label}</s-text>
                </s-clickable>
              ))}
            </s-stack>
          ) : (
            <s-text>No results found</s-text>
          )}
        </s-box>
      </s-popover>
    </s-box>
  );
};

export default AutocompleteWithSearch;

