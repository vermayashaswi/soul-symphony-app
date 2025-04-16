
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
    avatar: string;
  };
  readTime: string;
  tags: string[];
}
