import {type FC, useState, useEffect} from "react";

interface ProductTypeOption {
  value: string;
  label: string;
}

interface ProductTypeAutocompleteProps {
  label: string;
  placeholder?: string;
  options: ProductTypeOption[];
  value?: string;
  onChange?: (value: string, label: string) => void;
  disabled?: boolean;
  id: string;
}

/**
 * Autocomplete component for selecting product types
 * Uses client-side filtering of provided options
 */
const ProductTypeAutocomplete: FC<ProductTypeAutocompleteProps> = ({
  label,
  placeholder = "Search types...",
  options,
  value = "",
  onChange,
  disabled = false,
  id,
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [selectedValue, setSelectedValue] = useState(value);
  const [selectedLabel, setSelectedLabel] = useState("");

  const popoverId = `type-autocomplete-${id}`;

  // Filter options based on search value (client-side)
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Handle option selection
  const handleOptionSelect = (optionValue: string, optionLabel: string) => {
    setSelectedValue(optionValue);
    setSelectedLabel(optionLabel);
    setSearchValue("");
    onChange?.(optionValue, optionLabel);
    
    console.log('[ProductTypeAutocomplete] Selected:', {
      value: optionValue,
      label: optionLabel
    });
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
    setSearchValue(target.value);
  };

  // Update selected label when value prop changes
  useEffect(() => {
    if (value) {
      const selectedOption = options.find((opt) => opt.value === value);
      if (selectedOption) {
        setSelectedValue(value);
        setSelectedLabel(selectedOption.label);
      }
    } else {
      setSelectedValue("");
      setSelectedLabel("");
    }
  }, [value, options]);

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
          {filteredOptions.length > 0 ? (
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

export default ProductTypeAutocomplete;

