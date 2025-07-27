import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { blogPosts, BlogPost } from '@/data/blogPosts';
import Navbar from '@/components/Navbar';
import Footer from '@/components/website/Footer';
import ReactMarkdown from 'react-markdown';

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  
  useEffect(() => {
    const foundPost = blogPosts.find(p => p.slug === slug);
    setPost(foundPost || null);
    
    if (foundPost) {
      // Find posts in the same category or with similar tags
      const related = blogPosts
        .filter(p => p.id !== foundPost.id)
        .filter(p => 
          p.category === foundPost.category || 
          p.tags.some(tag => foundPost.tags.includes(tag))
        )
        .slice(0, 3);
      
      setRelatedPosts(related);
    }
    
    // Scroll to top when post changes
    window.scrollTo(0, 0);
  }, [slug]);
  
  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto max-w-6xl px-4 pt-32 pb-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Post Not Found</h1>
          <p className="text-muted-foreground mb-6">The blog post you're looking for doesn't exist or has been moved.</p>
          <Button asChild>
            <Link to="/blog">Back to Blog</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <motion.section
        className="pt-24 md:pt-32 pb-12 bg-primary/5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto max-w-4xl px-4">
          <div className="mb-6">
            <Button variant="ghost" asChild className="pl-0 mb-2">
              <Link to="/blog" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Blog
              </Link>
            </Button>
            
            <motion.h1 
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {post.title}
            </motion.h1>
            
            {post.subtitle && (
              <motion.p 
                className="text-xl text-muted-foreground"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {post.subtitle}
              </motion.p>
            )}
          </div>
          
          <motion.div 
            className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{post.author.avatar}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{post.author.name}</p>
                {post.author.role && <p className="text-xs">{post.author.role}</p>}
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{post.date}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{post.readTime}</span>
            </div>
            
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/10">
              {post.category}
            </Badge>
          </motion.div>
        </div>
      </motion.section>
      
      {/* Featured Image */}
      <motion.div
        className="container mx-auto max-w-4xl px-4 -mt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg">
          <img 
            src={post.image} 
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      </motion.div>
      
      {/* Article Content */}
      <section className="py-12">
        <div className="container mx-auto max-w-3xl px-4">
          <motion.article 
            className="prose prose-lg dark:prose-invert max-w-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            {/* Security fix: Use React Markdown instead of dangerouslySetInnerHTML */}
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </motion.article>
          
          <div className="mt-12 pt-6 border-t border-primary/10">
            <h3 className="text-lg font-semibold mb-3">Tags:</h3>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="bg-primary/5 hover:bg-primary/10">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-12 bg-primary/5">
          <div className="container mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold mb-8">Related Articles</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost, index) => (
                <motion.div
                  key={relatedPost.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                >
                  <Link to={`/blog/${relatedPost.slug}`}>
                    <Card className="h-full overflow-hidden hover:shadow-md transition-shadow">
                      <div className="relative h-40 overflow-hidden">
                        <img 
                          src={relatedPost.image} 
                          alt={relatedPost.title} 
                          className="object-cover w-full h-full transform hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <CardContent className="p-4">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/10 mb-2">
                          {relatedPost.category}
                        </Badge>
                        <h3 className="font-bold mb-2 line-clamp-2">{relatedPost.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{relatedPost.excerpt}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
      
      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="bg-card border border-primary/10 rounded-xl p-8 md:p-10 text-center shadow-sm">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Start Your Journaling Journey?</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Download SOULo today and experience the benefits of voice journaling with AI-powered insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg">Download SOULo</Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/">Learn More</Link>
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

export default BlogPostPage;
