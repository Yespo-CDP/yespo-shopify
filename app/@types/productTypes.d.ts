export interface ProductTypesPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  endCursor: string;
  startCursor: string;
}

export interface ProductTypesResponse {
  productTypes: {
    nodes: string[];
    pageInfo: ProductTypesPageInfo
  };
}
