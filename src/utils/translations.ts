
import { useEffect, useState } from 'react';

// List of supported languages
export type SupportedLanguage = 
  'en' | // English
  'es' | // Spanish
  'fr' | // French
  'de' | // German
  'zh' | // Chinese
  'ja' | // Japanese
  'hi' | // Hindi
  'pt' | // Portuguese
  'ru' | // Russian
  'ar';  // Arabic

// Get current language from browser or localStorage
export const getCurrentLanguage = (): SupportedLanguage => {
  // Check localStorage first
  const savedLanguage = localStorage.getItem('preferredLanguage') as SupportedLanguage;
  if (savedLanguage && translations[savedLanguage]) {
    return savedLanguage;
  }
  
  // Check browser language
  const browserLang = navigator.language.split('-')[0] as SupportedLanguage;
  if (browserLang && translations[browserLang]) {
    return browserLang;
  }
  
  // Default to English
  return 'en';
};

// Interface for translation keys
export interface TranslationKeys {
  // Common
  appName: string;
  tagline: string;
  
  // Navigation
  nav: {
    home: string;
    features: string;
    pricing: string;
    blog: string;
    login: string;
    signup: string;
    tryNow: string;
  };
  
  // Homepage
  home: {
    hero: {
      title: string;
      subtitle: string;
      cta: string;
      exploreBlog: string;
    };
    mainTagline: string;
    features: {
      title: string;
      subtitle: string;
      voiceJournaling: {
        title: string;
        description: string;
      };
      aiAnalysis: {
        title: string;
        description: string;
      };
      emotionalTracking: {
        title: string;
        description: string;
      };
      aiAssistant: {
        title: string;
        description: string;
      };
    };
    process: {
      title: string;
      subtitle: string;
      steps: {
        record: {
          title: string;
          description: string;
        };
        analyze: {
          title: string;
          description: string;
        };
        insights: {
          title: string;
          description: string;
        };
      };
    };
    privacy: {
      title: string;
      description: string;
      points: string[];
    };
    download: {
      title: string;
      subtitle: string;
      android: string;
      ios: string;
    };
    testimonials: {
      title: string;
      subtitle: string;
    };
  };
  
  // Blog
  blog: {
    title: string;
    readMore: string;
    recentPosts: string;
  };
  
  // Pricing
  pricing: {
    title: string;
    subtitle: string;
    monthly: string;
    yearly: string;
    free: string;
    premium: string;
    features: string;
    getStarted: string;
    currentPlan: string;
  };
  
  // Footer
  footer: {
    company: string;
    product: string;
    resources: string;
    legal: string;
    privacyPolicy: string;
    termsOfService: string;
    copyright: string;
  };
}

// English translations (default)
const enTranslations: TranslationKeys = {
  appName: "SOuLO",
  tagline: "Express. Reflect. Grow.",
  
  nav: {
    home: "Home",
    features: "Features",
    pricing: "Pricing",
    blog: "Blog",
    login: "Login",
    signup: "Sign Up",
    tryNow: "Try Now"
  },
  
  home: {
    hero: {
      title: "Express. Reflect. Grow.",
      subtitle: "Discover yourself through voice journaling and AI-powered insights with SOuLO.",
      cta: "Download App",
      exploreBlog: "Explore Blog"
    },
    mainTagline: "Keep a journal and capture your day without writing down a single word!",
    features: {
      title: "How SOuLO Works",
      subtitle: "Our innovative approach combines voice journaling with AI technology to provide you with meaningful insights about yourself.",
      voiceJournaling: {
        title: "Voice Journaling",
        description: "Record your thoughts with voice and let SOuLO transcribe and analyze them automatically."
      },
      aiAnalysis: {
        title: "AI Analysis",
        description: "Gain insights into your patterns and emotions through advanced AI analysis."
      },
      emotionalTracking: {
        title: "Emotional Tracking",
        description: "Visualize your emotional journey over time with interactive charts."
      },
      aiAssistant: {
        title: "AI Assistant",
        description: "Chat with your journal and get personalized insights from your past entries."
      }
    },
    process: {
      title: "How It Works",
      subtitle: "Start your self-discovery journey in three simple steps",
      steps: {
        record: {
          title: "Record Your Thoughts",
          description: "Speak freely about your day, feelings, or any thoughts you want to capture. No writing required!"
        },
        analyze: {
          title: "AI Analyzes Your Entry",
          description: "Our AI transcribes your voice and analyzes the emotional patterns and key themes in your entry."
        },
        insights: {
          title: "Gain Personalized Insights",
          description: "Discover patterns, track emotional trends over time, and get personalized insights to support your growth."
        }
      }
    },
    privacy: {
      title: "Your Privacy Matters",
      description: "We prioritize the security and privacy of your personal data with enterprise-grade protection.",
      points: [
        "End-to-end encryption for all your journal entries",
        "Your data is never sold to third parties",
        "Advanced security measures to protect your information",
        "Full control over your data with export and delete options"
      ]
    },
    download: {
      title: "Start Your Journey Today",
      subtitle: "Download the SOuLO app and begin your self-discovery journey",
      android: "Get it on Google Play",
      ios: "Download on App Store"
    },
    testimonials: {
      title: "What Our Users Say",
      subtitle: "Join thousands of users who have transformed their self-reflection practice"
    }
  },
  
  blog: {
    title: "Our Blog",
    readMore: "Read More",
    recentPosts: "Recent Posts"
  },
  
  pricing: {
    title: "Simple, Transparent Pricing",
    subtitle: "Start free, upgrade when you need more features",
    monthly: "Monthly",
    yearly: "Yearly",
    free: "Free",
    premium: "Premium",
    features: "Features",
    getStarted: "Get Started",
    currentPlan: "Current Plan"
  },
  
  footer: {
    company: "Company",
    product: "Product",
    resources: "Resources",
    legal: "Legal",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    copyright: "© 2025 SOuLO. All rights reserved."
  }
};

// Spanish translations
const esTranslations: TranslationKeys = {
  appName: "SOuLO",
  tagline: "Expresa. Reflexiona. Crece.",
  
  nav: {
    home: "Inicio",
    features: "Características",
    pricing: "Precios",
    blog: "Blog",
    login: "Iniciar Sesión",
    signup: "Registrarse",
    tryNow: "Probar Ahora"
  },
  
  home: {
    hero: {
      title: "Expresa. Reflexiona. Crece.",
      subtitle: "Descúbrete a ti mismo a través del diario por voz y los conocimientos impulsados por IA con SOuLO.",
      cta: "Descargar Aplicación",
      exploreBlog: "Explorar Blog"
    },
    mainTagline: "¡Mantén un diario y captura tu día sin escribir una sola palabra!",
    features: {
      title: "Cómo Funciona SOuLO",
      subtitle: "Nuestro enfoque innovador combina el diario por voz con tecnología de IA para brindarte conocimientos significativos sobre ti mismo.",
      voiceJournaling: {
        title: "Diario por Voz",
        description: "Graba tus pensamientos con voz y deja que SOuLO los transcriba y analice automáticamente."
      },
      aiAnalysis: {
        title: "Análisis de IA",
        description: "Obtén conocimientos sobre tus patrones y emociones a través del análisis avanzado de IA."
      },
      emotionalTracking: {
        title: "Seguimiento Emocional",
        description: "Visualiza tu viaje emocional a lo largo del tiempo con gráficos interactivos."
      },
      aiAssistant: {
        title: "Asistente de IA",
        description: "Chatea con tu diario y obtén ideas personalizadas de tus entradas anteriores."
      }
    },
    process: {
      title: "Cómo Funciona",
      subtitle: "Comienza tu viaje de autodescubrimiento en tres simples pasos",
      steps: {
        record: {
          title: "Graba Tus Pensamientos",
          description: "Habla libremente sobre tu día, sentimientos o cualquier pensamiento que quieras capturar. ¡No se requiere escribir!"
        },
        analyze: {
          title: "La IA Analiza Tu Entrada",
          description: "Nuestra IA transcribe tu voz y analiza los patrones emocionales y temas clave en tu entrada."
        },
        insights: {
          title: "Obtén Conocimientos Personalizados",
          description: "Descubre patrones, rastrea tendencias emocionales a lo largo del tiempo y obtén conocimientos personalizados para apoyar tu crecimiento."
        }
      }
    },
    privacy: {
      title: "Tu Privacidad Importa",
      description: "Priorizamos la seguridad y privacidad de tus datos personales con protección de nivel empresarial.",
      points: [
        "Cifrado de extremo a extremo para todas tus entradas de diario",
        "Tus datos nunca se venden a terceros",
        "Medidas de seguridad avanzadas para proteger tu información",
        "Control total sobre tus datos con opciones de exportación y eliminación"
      ]
    },
    download: {
      title: "Comienza Tu Viaje Hoy",
      subtitle: "Descarga la aplicación SOuLO y comienza tu viaje de autodescubrimiento",
      android: "Obtener en Google Play",
      ios: "Descargar en App Store"
    },
    testimonials: {
      title: "Lo Que Dicen Nuestros Usuarios",
      subtitle: "Únete a miles de usuarios que han transformado su práctica de autoreflexión"
    }
  },
  
  blog: {
    title: "Nuestro Blog",
    readMore: "Leer Más",
    recentPosts: "Publicaciones Recientes"
  },
  
  pricing: {
    title: "Precios Simples y Transparentes",
    subtitle: "Comienza gratis, actualiza cuando necesites más funciones",
    monthly: "Mensual",
    yearly: "Anual",
    free: "Gratis",
    premium: "Premium",
    features: "Características",
    getStarted: "Comenzar",
    currentPlan: "Plan Actual"
  },
  
  footer: {
    company: "Empresa",
    product: "Producto",
    resources: "Recursos",
    legal: "Legal",
    privacyPolicy: "Política de Privacidad",
    termsOfService: "Términos de Servicio",
    copyright: "© 2025 SOuLO. Todos los derechos reservados."
  }
};

// French translations
const frTranslations: TranslationKeys = {
  appName: "SOuLO",
  tagline: "Exprime. Réfléchis. Grandis.",
  
  nav: {
    home: "Accueil",
    features: "Fonctionnalités",
    pricing: "Tarifs",
    blog: "Blog",
    login: "Connexion",
    signup: "S'inscrire",
    tryNow: "Essayer"
  },
  
  home: {
    hero: {
      title: "Exprime. Réfléchis. Grandis.",
      subtitle: "Découvrez-vous à travers le journal vocal et les analyses alimentées par l'IA avec SOuLO.",
      cta: "Télécharger l'App",
      exploreBlog: "Explorer le Blog"
    },
    mainTagline: "Tenez un journal et capturez votre journée sans écrire un seul mot !",
    features: {
      title: "Comment Fonctionne SOuLO",
      subtitle: "Notre approche innovante combine le journal vocal avec la technologie d'IA pour vous fournir des informations significatives sur vous-même.",
      voiceJournaling: {
        title: "Journal Vocal",
        description: "Enregistrez vos pensées avec votre voix et laissez SOuLO les transcrire et les analyser automatiquement."
      },
      aiAnalysis: {
        title: "Analyse par IA",
        description: "Obtenez des insights sur vos modèles et émotions grâce à l'analyse avancée par IA."
      },
      emotionalTracking: {
        title: "Suivi Émotionnel",
        description: "Visualisez votre parcours émotionnel au fil du temps avec des graphiques interactifs."
      },
      aiAssistant: {
        title: "Assistant IA",
        description: "Discutez avec votre journal et obtenez des informations personnalisées à partir de vos entrées précédentes."
      }
    },
    process: {
      title: "Comment Ça Marche",
      subtitle: "Commencez votre voyage de découverte de soi en trois étapes simples",
      steps: {
        record: {
          title: "Enregistrez Vos Pensées",
          description: "Parlez librement de votre journée, vos sentiments ou toute pensée que vous souhaitez capturer. Pas besoin d'écrire !"
        },
        analyze: {
          title: "L'IA Analyse Votre Entrée",
          description: "Notre IA transcrit votre voix et analyse les modèles émotionnels et les thèmes clés dans votre entrée."
        },
        insights: {
          title: "Obtenez des Insights Personnalisés",
          description: "Découvrez des modèles, suivez les tendances émotionnelles au fil du temps et obtenez des insights personnalisés pour soutenir votre croissance."
        }
      }
    },
    privacy: {
      title: "Votre Vie Privée Est Importante",
      description: "Nous priorisons la sécurité et la confidentialité de vos données personnelles avec une protection de niveau entreprise.",
      points: [
        "Chiffrement de bout en bout pour toutes vos entrées de journal",
        "Vos données ne sont jamais vendues à des tiers",
        "Mesures de sécurité avancées pour protéger vos informations",
        "Contrôle total sur vos données avec des options d'exportation et de suppression"
      ]
    },
    download: {
      title: "Commencez Votre Voyage Aujourd'hui",
      subtitle: "Téléchargez l'application SOuLO et commencez votre voyage de découverte de soi",
      android: "Obtenir sur Google Play",
      ios: "Télécharger sur App Store"
    },
    testimonials: {
      title: "Ce Que Disent Nos Utilisateurs",
      subtitle: "Rejoignez des milliers d'utilisateurs qui ont transformé leur pratique d'auto-réflexion"
    }
  },
  
  blog: {
    title: "Notre Blog",
    readMore: "Lire Plus",
    recentPosts: "Publications Récentes"
  },
  
  pricing: {
    title: "Prix Simple et Transparent",
    subtitle: "Commencez gratuitement, mettez à niveau lorsque vous avez besoin de plus de fonctionnalités",
    monthly: "Mensuel",
    yearly: "Annuel",
    free: "Gratuit",
    premium: "Premium",
    features: "Fonctionnalités",
    getStarted: "Commencer",
    currentPlan: "Plan Actuel"
  },
  
  footer: {
    company: "Entreprise",
    product: "Produit",
    resources: "Ressources",
    legal: "Légal",
    privacyPolicy: "Politique de Confidentialité",
    termsOfService: "Conditions d'Utilisation",
    copyright: "© 2025 SOuLO. Tous droits réservés."
  }
};

// All translations mapped by language code
export const translations: Record<SupportedLanguage, TranslationKeys> = {
  en: enTranslations,
  es: esTranslations,
  fr: frTranslations,
  // These would be filled in with actual translations
  de: enTranslations, // German (placeholder - using English for now)
  zh: enTranslations, // Chinese (placeholder - using English for now)
  ja: enTranslations, // Japanese (placeholder - using English for now) 
  hi: enTranslations, // Hindi (placeholder - using English for now)
  pt: enTranslations, // Portuguese (placeholder - using English for now)
  ru: enTranslations, // Russian (placeholder - using English for now)
  ar: enTranslations  // Arabic (placeholder - using English for now)
};
