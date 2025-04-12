
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import { getBlogPostBySlug, getRelatedBlogPosts } from '@/data/blogData';
import { BlogPost } from '@/types/blog';
import { useTranslation } from 'react-i18next';

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (slug) {
      // Get post data from our data source
      const fetchedPost = getBlogPostBySlug(slug);
      setPost(fetchedPost);
      
      if (fetchedPost) {
        // Get related posts
        const related = getRelatedBlogPosts(fetchedPost.id, 3);
        setRelatedPosts(related);
      }
      
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
          <h1 className="text-3xl font-bold mb-4 crisp-text">{t('blog.postNotFound', 'Post Not Found')}</h1>
          <p className="text-muted-foreground mb-8 crisp-text">
            {t('blog.postNotFoundMessage', 'The article you're looking for doesn't exist or has been moved.')}
          </p>
          <Button asChild>
            <Link to="/blog">{t('blog.backToBlog', 'Back to Blog')}</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  // Get translated content based on current language
  const getTranslatedContent = () => {
    // This is a simplified example - in a real app, you would fetch translated content from your API
    // or have translations for each content piece
    if (i18n.language === 'en' || !post.translations) {
      return {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category
      };
    }
    
    const translations = post.translations?.[i18n.language];
    if (translations) {
      return {
        title: translations.title || post.title,
        excerpt: translations.excerpt || post.excerpt,
        content: translations.content || post.content,
        category: translations.category || post.category
      };
    }
    
    return {
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category
    };
  };

  const translatedContent = getTranslatedContent();
  const authorName = post.author.name || post.author;
  const authorInitial = authorName.charAt(0);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <article className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Link to="/blog" className="flex items-center text-primary hover:underline mb-8">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="crisp-text">{t('blog.backToBlog', 'Back to Blog')}</span>
            </Link>
            
            <div className="aspect-video overflow-hidden rounded-lg mb-8">
              <img 
                src={post.image} 
                alt={translatedContent.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
                <span className="text-xs font-medium uppercase text-primary bg-primary/10 px-2 py-1 rounded-full crisp-text">
                  {translatedContent.category}
                </span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="crisp-text">{post.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span className="crisp-text">{authorName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span className="crisp-text">{post.readTime}</span>
                </div>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold mb-4 crisp-text">{translatedContent.title}</h1>
              {post.subtitle && (
                <h2 className="text-xl text-muted-foreground mb-4 crisp-text">{post.subtitle}</h2>
              )}
              <p className="text-lg text-muted-foreground crisp-text">{translatedContent.excerpt}</p>
            </div>
            
            <div 
              className="prose prose-lg max-w-none crisp-text" 
              dangerouslySetInnerHTML={{ __html: translatedContent.content }}
            />
            
            {post.tags && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="text-lg font-semibold mb-3 crisp-text">Tags:</h3>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag, index) => (
                    <span key={index} className="bg-primary/5 text-primary px-3 py-1 rounded-full text-sm crisp-text">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="border-t border-gray-100 mt-12 pt-8">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold crisp-text">
                    {authorInitial}
                  </div>
                  <div>
                    <p className="font-medium crisp-text">{authorName}</p>
                    <p className="text-sm text-muted-foreground crisp-text">{post.author.role || t('blog.author', 'Author')}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button variant="outline" asChild>
                    <Link to="/blog">
                      <span className="crisp-text">{t('blog.moreArticles', 'More Articles')}</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
            
            {relatedPosts.length > 0 && (
              <div className="mt-16">
                <h2 className="text-2xl font-bold mb-8 crisp-text">{t('blog.relatedArticles', 'Related Articles')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedPosts.map((relatedPost) => (
                    <Link key={relatedPost.id} to={`/blog/${relatedPost.slug}`} className="block">
                      <div className="border border-gray-100 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        <div className="aspect-video overflow-hidden">
                          <img 
                            src={relatedPost.image} 
                            alt={relatedPost.title} 
                            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <div className="p-4">
                          <span className="text-xs font-medium uppercase text-primary bg-primary/10 px-2 py-1 rounded-full mb-2 inline-block crisp-text">
                            {relatedPost.category}
                          </span>
                          <h3 className="font-bold mb-2 line-clamp-2 crisp-text">{relatedPost.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 crisp-text">{relatedPost.excerpt}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
      
      <Footer />
    </div>
  );
};

export default BlogPostPage;
