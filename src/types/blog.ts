
export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  date: string;
  author: {
    name: string;
    role?: string;
    avatar?: string;
  };
  tags: string[];
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
