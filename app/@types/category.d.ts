export interface CategoryPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  endCursor: string;
  startCursor: string;
}

interface Category {
  id: string;
  level: number;
  name: string;
  fullName: string;
  childrenIds: string[];
}

export interface CategoryResponse {
  taxonomy: {
    categories: {
      nodes: Category[];
      pageInfo: CategoryPageInfo
    }
  }
}
