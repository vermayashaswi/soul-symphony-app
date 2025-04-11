
import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const BlogPreview = () => {
  const { t } = useTranslation();
  
  // Dummy blog posts
  const blogPosts = [
    {
      title: "The Science Behind Voice Journaling",
      excerpt: "Discover how speaking your thoughts aloud can lead to deeper insights and emotional clarity.",
      date: "2023-05-15",
      image: "/lovable-uploads/blog-1.jpg",
      slug: "science-behind-voice-journaling"
    },
    {
      title: "5 Ways AI Can Improve Your Mental Health",
      excerpt: "Learn how artificial intelligence is revolutionizing personal wellness and emotional health tracking.",
      date: "2023-06-02",
      image: "/lovable-uploads/blog-2.jpg",
      slug: "ai-mental-health-improvements"
    },
    {
      title: "Building a Journaling Habit That Sticks",
      excerpt: "Practical tips for making journaling a consistent part of your daily routine.",
      date: "2023-06-20",
      image: "/lovable-uploads/blog-3.jpg",
      slug: "building-journaling-habit"
    }
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12">
          <div>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">
              {t('navbar.blog')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold">{t('blog.recentPosts')}</h2>
          </div>
          <Button variant="outline" asChild className="mt-4 md:mt-0">
            <Link to="/blog">
              {t('blog.allPosts')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {blogPosts.map((post, index) => (
            <motion.div 
              key={index}
              className="group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={`/blog/${post.slug}`} className="block">
                <div className="relative overflow-hidden rounded-xl mb-4 aspect-video">
                  <div className="absolute inset-0 bg-primary/10 group-hover:bg-primary/20 transition-colors z-10"></div>
                  <img 
                    src={post.image} 
                    alt={post.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{post.title}</h3>
                <p className="text-muted-foreground mb-2">{post.excerpt}</p>
                <span className="text-sm text-muted-foreground">{post.date}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogPreview;
