
export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  date: string;
  author: string;
  readTime: string;
  translations?: {
    [languageCode: string]: {
      title?: string;
      excerpt?: string;
      content?: string;
      category?: string;
    }
  };
}
