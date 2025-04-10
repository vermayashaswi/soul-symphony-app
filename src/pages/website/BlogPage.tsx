
import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';

// Blog post data
const featuredPost = {
  id: 1,
  slug: 'why-voice-journaling-is-the-future',
  title: 'Why Voice Journaling Is The Future',
  excerpt: 'Discover how voice journaling is revolutionizing self-reflection and personal growth in our digital age.',
  image: '/lovable-uploads/f1035a0b-8b30-4d38-9234-6560a14558de.png',
  date: 'April 10, 2025',
  author: 'Sarah Johnson',
  readTime: '8 min read',
  category: 'Personal Growth'
};

const blogPosts = [
  {
    id: 2,
    slug: 'how-ai-enhances-your-journaling-experience',
    title: 'How AI Enhances Your Journaling Experience',
    excerpt: 'Explore the ways artificial intelligence can provide deeper insights into your thoughts and emotions.',
    image: '/lovable-uploads/a6374f0f-2e81-45f4-8c42-dfe81f7fbf01.png',
    date: 'April 8, 2025',
    author: 'Michael Chen',
    readTime: '9 min read',
    category: 'Technology'
  },
  {
    id: 3,
    slug: 'benefits-of-daily-reflection-through-voice-journals',
    title: 'Benefits of Daily Reflection Through Voice Journals',
    excerpt: 'Learn how daily voice journaling can improve your mental clarity, emotional well-being, and overall life satisfaction.',
    image: '/lovable-uploads/8dd08973-e7a2-4bef-a990-1e3ff0dede92.png',
    date: 'April 5, 2025',
    author: 'Emily Rodriguez',
    readTime: '10 min read',
    category: 'Wellness'
  },
  {
    id: 4,
    slug: 'voice-journaling-for-busy-professionals',
    title: 'Voice Journaling for Busy Professionals',
    excerpt: 'How busy professionals can incorporate voice journaling into their hectic schedules for better work-life balance.',
    image: '/lovable-uploads/cb710491-93f0-42be-a596-f64d80d9800e.png',
    date: 'April 2, 2025',
    author: 'James Wilson',
    readTime: '8 min read',
    category: 'Productivity'
  },
  {
    id: 5,
    slug: 'tracking-emotional-patterns-with-voice-journaling',
    title: 'Tracking Emotional Patterns with Voice Journaling',
    excerpt: 'Discover how voice journaling can help you identify and understand your emotional patterns over time.',
    image: '/lovable-uploads/a66f2232-4b39-4d46-ace5-19e4c81b1f05.png',
    date: 'March 30, 2025',
    author: 'Olivia Thompson',
    readTime: '9 min read',
    category: 'Mental Health'
  }
];

const BlogPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <div className="pt-24 md:pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">SOULo Blog</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Insights and guidance for your self-discovery journey through voice journaling.
            </p>
          </div>
          
          {/* Featured Post */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-16"
          >
            <Link to={`/blog/${featuredPost.slug}`} className="block group">
              <Card className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="aspect-video overflow-hidden">
                    <img 
                      src={featuredPost.image} 
                      alt={featuredPost.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6 md:p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium uppercase text-primary bg-primary/10 px-2 py-1 rounded-full">
                          {featuredPost.category}
                        </span>
                        <span className="text-sm text-muted-foreground">{featuredPost.date}</span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold mb-4 group-hover:text-primary transition-colors">
                        {featuredPost.title}
                      </h2>
                      <p className="text-muted-foreground mb-4">
                        {featuredPost.excerpt}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="text-sm">{featuredPost.author}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="text-sm">{featuredPost.readTime}</span>
                        </div>
                      </div>
                      <Button className="w-full group">
                        Read More
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
          
          {/* Blog Posts Grid */}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-8">Latest Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {blogPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Link to={`/blog/${post.slug}`} className="block h-full">
                    <Card className="h-full hover:shadow-md transition-shadow overflow-hidden">
                      <div className="aspect-video overflow-hidden">
                        <img 
                          src={post.image} 
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                        />
                      </div>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium uppercase text-primary bg-primary/10 px-2 py-1 rounded-full">
                            {post.category}
                          </span>
                        </div>
                        <CardTitle className="text-xl hover:text-primary transition-colors line-clamp-2">
                          {post.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-0">
                        <CardDescription className="line-clamp-3">
                          {post.excerpt}
                        </CardDescription>
                      </CardContent>
                      <CardFooter className="pt-4">
                        <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{post.author}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{post.readTime}</span>
                          </div>
                        </div>
                      </CardFooter>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default BlogPage;
