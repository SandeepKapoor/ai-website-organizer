export interface BookmarkCardData {
  id: string;
  title: string;
  url: string;
  domain: string;
  description: string | null;
  category: string;
  thumbnailUrl: string | null;
  thumbnailSource: string;
  favicon: string | null;
  folderPath: string;
  folderId: string | null;
  dateAdded: string;
  metadataStatus: string;
  thumbnailStatus: string;
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  parentFolderId: string | null;
  children: FolderNode[];
  bookmarkCount: number;
}
