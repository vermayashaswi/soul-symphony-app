
import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import { blogPosts } from '@/utils/blog-utils';
import { TranslatableText } from '@/components/translation/TranslatableText';

const BlogPage = () => {
  // Featured post is the first blog post (about voice journaling benefits)
  const featuredPost = blogPosts[0];
  
  // Other blog posts (excluding the featured one)
  const otherPosts = blogPosts.slice(1);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <div className="pt-24 md:pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <TranslatableText text="SOuLO Blog" forceTranslate={true} />
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              <TranslatableText 
                text="Insights and guidance for your self-discovery journey through voice journaling"
                forceTranslate={true}
              />
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
                          <TranslatableText text={featuredPost.category} forceTranslate={true} />
                        </span>
                        <span className="text-sm text-muted-foreground">
                          <TranslatableText text={featuredPost.date} forceTranslate={true} />
                        </span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold mb-4 group-hover:text-primary transition-colors">
                        <TranslatableText text={featuredPost.title} forceTranslate={true} />
                      </h2>
                      <p className="text-muted-foreground mb-4">
                        <TranslatableText text={featuredPost.excerpt} forceTranslate={true} />
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="text-sm">
                            <TranslatableText text={featuredPost.author.name} forceTranslate={true} />
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="text-sm">
                            <TranslatableText text={featuredPost.readTime} forceTranslate={true} />
                          </span>
                        </div>
                      </div>
                      <Button className="w-full group">
                        <TranslatableText text="Read More" forceTranslate={true} />
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
            <h2 className="text-2xl md:text-3xl font-bold mb-8">
              <TranslatableText text="Latest Articles" forceTranslate={true} />
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {otherPosts.map((post, index) => (
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
                            <TranslatableText text={post.category} forceTranslate={true} />
                          </span>
                        </div>
                        <CardTitle className="text-xl hover:text-primary transition-colors line-clamp-2">
                          <TranslatableText text={post.title} forceTranslate={true} />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-0">
                        <CardDescription className="line-clamp-3">
                          <TranslatableText text={post.excerpt} forceTranslate={true} />
                        </CardDescription>
                      </CardContent>
                      <CardFooter className="pt-4">
                        <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>
                              <TranslatableText text={post.author.name} forceTranslate={true} />
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              <TranslatableText text={post.readTime} forceTranslate={true} />
                            </span>
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
