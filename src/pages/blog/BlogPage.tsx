import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { blogPosts } from '@/data/blogPosts';
import Navbar from '@/components/Navbar';
import Footer from '@/components/website/Footer';

const BlogPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredPosts = blogPosts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
    post.category.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const categories = [...new Set(blogPosts.map(post => post.category))];
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-24 md:pt-32 pb-12 md:pb-20 bg-primary/5">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div 
            className="text-center max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">SOULo Blog</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Insights and guidance for your self-discovery journey through voice journaling.
            </p>
            
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="search"
                placeholder="Search articles..."
                className="pl-10 pr-4 py-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Categories */}
      <section className="py-8 border-b border-primary/10">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button 
              variant={searchQuery === '' ? "default" : "outline"} 
              size="sm"
              onClick={() => setSearchQuery('')}
            >
              All
            </Button>
            
            {categories.map((category) => (
              <Button 
                key={category}
                variant={searchQuery === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSearchQuery(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>
      
      {/* Featured Post */}
      {searchQuery === '' && (
        <section className="py-12 md:py-16">
          <div className="container mx-auto max-w-6xl px-4">
            <h2 className="text-2xl md:text-3xl font-bold mb-8">Featured Article</h2>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link to={`/blog/${blogPosts[0].slug}`} className="block group">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-card rounded-xl overflow-hidden border border-primary/10 hover:shadow-md transition-shadow">
                  <div className="aspect-video md:aspect-auto md:h-full overflow-hidden">
                    <img 
                      src={blogPosts[0].image}
                      alt={blogPosts[0].title}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  
                  <div className="p-6 md:p-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="outline" className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/10">
                        {blogPosts[0].category}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{blogPosts[0].date}</span>
                    </div>
                    
                    <h3 className="text-2xl md:text-3xl font-bold mb-3 group-hover:text-primary transition-colors">
                      {blogPosts[0].title}
                    </h3>
                    
                    <p className="text-muted-foreground mb-6">
                      {blogPosts[0].excerpt}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-full h-10 w-10 flex items-center justify-center text-primary font-medium">
                          {blogPosts[0].author.avatar}
                        </div>
                        <div>
                          <p className="font-medium">{blogPosts[0].author.name}</p>
                          <p className="text-sm text-muted-foreground">{blogPosts[0].author.role}</p>
                        </div>
                      </div>
                      
                      <span className="text-sm text-muted-foreground">{blogPosts[0].readTime}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        </section>
      )}
      
      {/* All Posts */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto max-w-6xl px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">
            {searchQuery ? `Search Results: ${filteredPosts.length} articles found` : 'Latest Articles'}
          </h2>
          
          {filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-medium mb-2">No articles found</h3>
              <p className="text-muted-foreground mb-4">Try adjusting your search terms or browse all articles.</p>
              <Button onClick={() => setSearchQuery('')}>View All Articles</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Link to={`/blog/${post.slug}`}>
                    <Card className="h-full overflow-hidden hover:shadow-md transition-shadow">
                      <div className="relative h-48 overflow-hidden">
                        <img 
                          src={post.image} 
                          alt={post.title} 
                          className="object-cover w-full h-full transform hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/10">
                            {post.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{post.date}</span>
                        </div>
                        <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">{post.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="line-clamp-3">{post.excerpt}</CardDescription>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-primary/10 rounded-full h-6 w-6 flex items-center justify-center text-primary text-xs font-medium">
                            {post.author.avatar}
                          </div>
                          <span className="text-sm">{post.author.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{post.readTime}</span>
                      </CardFooter>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
      
      {/* Newsletter Signup */}
      <section className="py-16 bg-primary/5">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Stay Updated</h2>
            <p className="text-muted-foreground mb-6">
              Get the latest articles, tips, and insights on voice journaling, emotional wellness, and personal growth.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <Input type="email" placeholder="Enter your email" className="flex-grow" />
              <Button>
                Subscribe
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default BlogPage;
