
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import { getBlogPostBySlug } from '@/utils/blog-utils';
import { BlogPost } from '@/types/blog';
import { TranslatableText } from '@/components/translation/TranslatableText';

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      // In a real app, this would be an API call
      const fetchedPost = getBlogPostBySlug(slug);
      setPost(fetchedPost);
      setLoading(false);
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="pt-32 pb-16 container mx-auto px-4">
          <div className="flex justify-center items-center h-64">
            <div className="animate-pulse h-8 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="pt-32 pb-16 container mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">
            <TranslatableText text="Post Not Found" forceTranslate={true} />
          </h1>
          <p className="text-muted-foreground mb-8">
            <TranslatableText 
              text="The blog post you're looking for doesn't exist or has been moved."
              forceTranslate={true}
            />
          </p>
          <Button asChild>
            <Link to="/blog">
              <TranslatableText text="Back to Blog" forceTranslate={true} />
            </Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <article className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Link to="/blog" className="flex items-center text-primary hover:underline mb-8">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <TranslatableText text="Back to Blog" forceTranslate={true} />
            </Link>
            
            <div className="aspect-video overflow-hidden rounded-lg mb-8">
              <img 
                src={post.image} 
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
                <span className="text-xs font-medium uppercase text-primary bg-primary/10 px-2 py-1 rounded-full">
                  <TranslatableText text={post.category} forceTranslate={true} />
                </span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span><TranslatableText text={post.date} forceTranslate={true} /></span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span><TranslatableText text={post.author.name} forceTranslate={true} /></span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span><TranslatableText text={post.readTime} forceTranslate={true} /></span>
                </div>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                <TranslatableText text={post.title} forceTranslate={true} />
              </h1>
              <p className="text-lg text-muted-foreground">
                <TranslatableText text={post.excerpt} forceTranslate={true} />
              </p>
            </div>
            
            {/* For the content, we need to create a way to translate HTML content safely */}
            <div className="prose prose-lg max-w-none">
              <TranslatableText as="div" text={post.content} forceTranslate={true} />
            </div>
            
            <div className="border-t border-gray-100 mt-12 pt-8">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    {post.author.avatar}
                  </div>
                  <div>
                    <p className="font-medium">
                      <TranslatableText text={post.author.name} forceTranslate={true} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <TranslatableText text={post.author.role} forceTranslate={true} />
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button variant="outline" asChild>
                    <Link to="/blog">
                      <TranslatableText text="More Articles" forceTranslate={true} />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
      
      <Footer />
    </div>
  );
};

export default BlogPostPage;
