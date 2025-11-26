import {Market} from "~/@types/market";

interface Image {
  url: string
}
export interface Collection {
  id: string;
  title: string;
  image: Image | null
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
