export type ThemeRole =
  | "MAIN"
  | "ARCHIVED"
  | "DEMO"
  | "DEVELOPMENT"
  | "LOCKED"
  | "UNPUBLISHED";

export interface ThemeFile {
  filename: string;
  body: {
    content: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  files: {
    nodes: ThemeFile[];
  };
  role: ThemeRole;
}

export interface ThemesResponse {
  data: {
    themes: {
      nodes: Theme[];
    };
  };
}
