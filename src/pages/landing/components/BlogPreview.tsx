
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { OptimizedImage } from '@/utils/imageUtils';

const blogPosts = [
  {
    id: 1,
    title: "The Science Behind Voice Journaling",
    excerpt: "Discover how speaking your thoughts can lead to deeper insights and improved emotional clarity.",
    image: "/lovable-uploads/69a98431-43ec-41e5-93f1-7ddaf28e2884.png",
    category: "Wellness",
    date: "April 8, 2024"
  },
  {
    id: 2,
    title: "5 Ways to Build a Consistent Journaling Habit",
    excerpt: "Learn practical strategies to make journaling a daily practice that sticks for long-term benefits.",
    image: "/lovable-uploads/f1035a0b-8b30-4d38-9234-6560a14558de.png",
    category: "Self-Improvement",
    date: "April 5, 2024"
  },
  {
    id: 3,
    title: "How AI Can Help You Understand Your Emotions Better",
    excerpt: "Explore how artificial intelligence is revolutionizing the way we process and understand our feelings.",
    image: "/lovable-uploads/a6374f0f-2e81-45f4-8c42-dfe81f7fbf01.png",
    category: "Technology",
    date: "April 2, 2024"
  }
];

const BlogPreview = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">From Our Blog</h2>
            <p className="text-muted-foreground">Insights and guides for your self-discovery journey</p>
          </div>
          <Button variant="ghost" asChild className="mt-4 md:mt-0">
            <Link to="/blog" className="flex items-center gap-2">
              View All Posts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {blogPosts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link to={`/blog/${post.id}`}>
                <Card className="h-full overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative h-48 overflow-hidden">
                    <OptimizedImage 
                      src={post.image} 
                      alt={post.title} 
                      className="object-cover w-full h-full transform hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-primary/10 text-primary">
                        {post.category}
                      </span>
                      <span className="text-xs text-muted-foreground">{post.date}</span>
                    </div>
                    <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="line-clamp-3">{post.excerpt}</CardDescription>
                  </CardContent>
                  <CardFooter>
                    <Button variant="ghost" className="p-0 h-auto text-primary flex items-center gap-1 hover:gap-2 transition-all">
                      Read More <ArrowRight className="h-3 w-3" />
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogPreview;
