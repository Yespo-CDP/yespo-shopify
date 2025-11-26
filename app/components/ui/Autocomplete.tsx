import {type FC, useState,  useEffect} from "react";

/**
 * Props for the Autocomplete component
 */
interface AutocompleteProps {
  label: string;
  placeholder?: string;
  options: Array<{value: string; label: string}>;
  value?: string;
  onChange?: (value: string, label: string) => void;
  disabled?: boolean;
  id: string; // Unique identifier for each instance
}

/**
 * Autocomplete component based on s-search-field and s-popover
 * Shows filtered options in popover on focus
 */
const Autocomplete: FC<AutocompleteProps> = ({
  label,
  placeholder = "Search...",
  options,
  value = "",
  onChange,
  disabled = false,
  id,
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [selectedValue, setSelectedValue] = useState(value);
  const [selectedLabel, setSelectedLabel] = useState("");

  // Generate unique popover ID
  const popoverId = `autocomplete-popover-${id}`;

  // Filter options based on search value
  const filteredOptions = options.filter((option) =>
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

        <s-box
          padding="small-200"
        >
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
            <s-text >No results found</s-text>
          )}
        </s-box>
      </s-popover>
    </s-box>
  );
};

export default Autocomplete;


