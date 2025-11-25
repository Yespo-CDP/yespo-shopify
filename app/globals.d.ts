declare module "*.css";

// Polaris Web Components type declarations
declare namespace JSX {
  interface IntrinsicElements {
    "s-page": any;
    "s-section": any;
    "s-stack": any;
    "s-grid": any;
    "s-grid-item": any;
    "s-box": any;
    "s-text": any;
    "s-paragraph": any;
    "s-heading": any;
    "s-button": {
      interestFor?: string;
      accessibilityLabel?: string;
      variant?: "auto" | "primary" | "secondary" | "tertiary";
      [key: string]: any;
    };
    "s-text-field": any;
    "s-password-field": any;
    "s-email-field": any;
    "s-number-field": any;
    "s-select": any;
    "s-option": any;
    "s-checkbox": any;
    "s-switch": any;
    "s-link": any;
    "s-badge": any;
    "s-banner": any;
    "s-modal": any;
    "s-icon": any;
    "s-image": any;
    "s-thumbnail": any;
    "s-tooltip": any;
    "s-spinner": any;
    "s-divider": any;
    "s-form": any;
    "s-menu": any;
    "s-table": any;
    "s-list": any;
    "s-list-item": any;
    "s-ordered-list": any;
    "s-unordered-list": any;
    "s-clickable": any;
    "s-chip": any;
    "s-clickable-chip": any;
    "s-color-field": any;
    "s-color-picker": any;
    "s-date-field": any;
    "s-date-picker": any;
    "s-money-field": any;
    "s-search-field": any;
    "s-text-area": any;
    "s-url-field": any;
    "s-query-container": any;
  }
}
