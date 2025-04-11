
import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import { useTranslation } from 'react-i18next';

const BlogPage = () => {
  const { t } = useTranslation();
  
  // Blog post data - this would ideally come from a CMS or API
  // We're hardcoding for demonstration but using translation keys
  const featuredPost = {
    id: 1,
    slug: 'why-voice-journaling-is-the-future',
    title: t('blog.featuredPost.title'),
    excerpt: t('blog.featuredPost.excerpt'),
    image: '/lovable-uploads/f1035a0b-8b30-4d38-9234-6560a14558de.png',
    date: t('blog.featuredPost.date'),
    author: t('blog.featuredPost.author'),
    readTime: t('blog.featuredPost.readTime'),
    category: t('blog.featuredPost.category')
  };

  const blogPosts = [
    {
      id: 2,
      slug: 'how-ai-enhances-your-journaling-experience',
      title: t('blog.posts.0.title'),
      excerpt: t('blog.posts.0.excerpt'),
      image: '/lovable-uploads/a6374f0f-2e81-45f4-8c42-dfe81f7fbf01.png',
      date: t('blog.posts.0.date'),
      author: t('blog.posts.0.author'),
      readTime: t('blog.posts.0.readTime'),
      category: t('blog.posts.0.category')
    },
    {
      id: 3,
      slug: 'benefits-of-daily-reflection-through-voice-journals',
      title: t('blog.posts.1.title'),
      excerpt: t('blog.posts.1.excerpt'),
      image: '/lovable-uploads/8dd08973-e7a2-4bef-a990-1e3ff0dede92.png',
      date: t('blog.posts.1.date'),
      author: t('blog.posts.1.author'),
      readTime: t('blog.posts.1.readTime'),
      category: t('blog.posts.1.category')
    },
    {
      id: 4,
      slug: 'voice-journaling-for-busy-professionals',
      title: t('blog.posts.2.title'),
      excerpt: t('blog.posts.2.excerpt'),
      image: '/lovable-uploads/cb710491-93f0-42be-a596-f64d80d9800e.png',
      date: t('blog.posts.2.date'),
      author: t('blog.posts.2.author'),
      readTime: t('blog.posts.2.readTime'),
      category: t('blog.posts.2.category')
    },
    {
      id: 5,
      slug: 'tracking-emotional-patterns-with-voice-journaling',
      title: t('blog.posts.3.title'),
      excerpt: t('blog.posts.3.excerpt'),
      image: '/lovable-uploads/a66f2232-4b39-4d46-ace5-19e4c81b1f05.png',
      date: t('blog.posts.3.date'),
      author: t('blog.posts.3.author'),
      readTime: t('blog.posts.3.readTime'),
      category: t('blog.posts.3.category')
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <div className="pt-24 md:pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('blog.pageTitle')}</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t('blog.pageSubtitle')}
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
                        {t('blog.readMore')}
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
            <h2 className="text-2xl md:text-3xl font-bold mb-8">{t('blog.latestArticles')}</h2>
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
