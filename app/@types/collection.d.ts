interface Image {
  url: string
}

interface Metafield {
  key: string;
  value: string;
}

export interface Collection {
  id: string;
  title: string;
  image: Image | null;
  metafield?: Metafield;
}

export interface CollectionPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  endCursor: string;
  startCursor: string;
}

export interface CollectionResponse {
  collections: {
    nodes: Collection[];
    pageInfo: CollectionPageInfo
  };
}
