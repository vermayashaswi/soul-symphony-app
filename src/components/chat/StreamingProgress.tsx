import React from 'react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/contexts/TranslationContext';

interface StreamingProgressProps {
  stage: string;
  message: string;
  progress?: number;
  estimatedCompletion?: number;
  data?: any;
}

export const StreamingProgress: React.FC<StreamingProgressProps> = ({
  stage,
  message,
  progress = 0,
  estimatedCompletion,
  data
}) => {
  const { translate, currentLanguage } = useTranslation();
  // Map backend stage names to translation keys and colors
  const getStageConfig = (stage: string) => {
    const stageMap = {
      'fast_track': { key: 'fastTrack', color: 'bg-emerald-500', icon: '⚡' },
      'cache_hit': { key: 'cacheCheck', color: 'bg-blue-500', icon: '💾' },
      'planning': { key: 'planning', color: 'bg-amber-500', icon: '🧠' },
      'embedding': { key: 'embedding', color: 'bg-purple-500', icon: '🔮' },
      'search_start': { key: 'searching', color: 'bg-orange-500', icon: '🔍' },
      'vector_search': { key: 'vectorSearch', color: 'bg-cyan-500', icon: '🔍' },
      'sql_search': { key: 'sqlSearch', color: 'bg-indigo-500', icon: '📊' },
      'parallel_search': { key: 'searching', color: 'bg-cyan-500', icon: '⚡🔍' },
      'response_generation': { key: 'generating', color: 'bg-pink-500', icon: '✍️' },
      'understanding': { key: 'understanding', color: 'bg-green-500', icon: '🤔' },
      'analyzing': { key: 'analyzing', color: 'bg-violet-500', icon: '📊' },
      'finalizing': { key: 'finalizing', color: 'bg-teal-500', icon: '✨' },
      'error': { key: 'error', color: 'bg-red-500', icon: '❌' },
      'complete': { key: 'complete', color: 'bg-green-600', icon: '✅' },
      'initializing': { key: 'initializing', color: 'bg-slate-500', icon: '⏳' },
      'connecting': { key: 'connecting', color: 'bg-blue-600', icon: '🔗' },
    };
    
    return stageMap[stage] || { key: 'processing', color: 'bg-gray-500', icon: '⏳' };
  };

  // Get translated message for the current stage
  const getTranslatedMessage = (stage: string, fallbackMessage: string) => {
    const stageConfig = getStageConfig(stage);
    
    // Define all messages directly here for now, avoiding async translation issues
    const allMessages = {
      'en': {
        'fastTrack': 'Quick response incoming...',
        'cacheCheck': 'Checking previous conversations...',
        'planning': 'Planning how to help you...',
        'embedding': 'Processing your question...',
        'searching': 'Finding relevant entries...',
        'vectorSearch': 'Searching through your entries...',
        'sqlSearch': 'Finding patterns in your data...',
        'generating': 'Crafting your response...',
        'understanding': 'Understanding your question...',
        'analyzing': 'Analyzing your journal data...',
        'finalizing': 'Finishing up...',
        'error': 'Something went wrong, please try again',
        'complete': 'Response ready!',
        'initializing': 'Getting started...',
        'connecting': 'Connecting to your journal...',
      },
      'es': {
        'fastTrack': 'Respuesta rápida en camino...',
        'cacheCheck': 'Revisando conversaciones anteriores...',
        'planning': 'Planeando cómo ayudarte...',
        'embedding': 'Procesando tu pregunta...',
        'searching': 'Buscando entradas relevantes...',
        'vectorSearch': 'Buscando en tus entradas...',
        'sqlSearch': 'Encontrando patrones en tus datos...',
        'generating': 'Creando tu respuesta...',
        'understanding': 'Entendiendo tu pregunta...',
        'analyzing': 'Analizando tus datos del diario...',
        'finalizing': 'Terminando...',
        'error': 'Algo salió mal, intenta de nuevo',
        'complete': '¡Respuesta lista!',
        'initializing': 'Comenzando...',
        'connecting': 'Conectando a tu diario...',
      },
      'fr': {
        'fastTrack': 'Réponse rapide en cours...',
        'cacheCheck': 'Vérification des conversations précédentes...',
        'planning': 'Planifier comment vous aider...',
        'embedding': 'Traitement de votre question...',
        'searching': 'Recherche d\'entrées pertinentes...',
        'vectorSearch': 'Recherche dans vos entrées...',
        'sqlSearch': 'Recherche de motifs dans vos données...',
        'generating': 'Création de votre réponse...',
        'understanding': 'Comprendre votre question...',
        'analyzing': 'Analyse de vos données de journal...',
        'finalizing': 'Finalisation...',
        'error': 'Quelque chose s\'est mal passé, veuillez réessayer',
        'complete': 'Réponse prête !',
        'initializing': 'Démarrage...',
        'connecting': 'Connexion à votre journal...',
      },
      'de': {
        'fastTrack': 'Schnelle Antwort kommt...',
        'cacheCheck': 'Überprüfe vorherige Gespräche...',
        'planning': 'Plane, wie ich Ihnen helfen kann...',
        'embedding': 'Verarbeite Ihre Frage...',
        'searching': 'Suche relevante Einträge...',
        'vectorSearch': 'Durchsuche Ihre Einträge...',
        'sqlSearch': 'Finde Muster in Ihren Daten...',
        'generating': 'Erstelle Ihre Antwort...',
        'understanding': 'Verstehe Ihre Frage...',
        'analyzing': 'Analysiere Ihre Tagebuchdaten...',
        'finalizing': 'Abschließen...',
        'error': 'Etwas ist schiefgelaufen, bitte versuchen Sie es erneut',
        'complete': 'Antwort bereit!',
        'initializing': 'Beginne...',
        'connecting': 'Verbinde mit Ihrem Tagebuch...',
      },
      'zh': {
        'fastTrack': '快速回复即将到来...',
        'cacheCheck': '检查之前的对话...',
        'planning': '计划如何帮助您...',
        'embedding': '处理您的问题...',
        'searching': '搜索相关条目...',
        'vectorSearch': '搜索您的条目...',
        'sqlSearch': '在您的数据中查找模式...',
        'generating': '生成您的回复...',
        'understanding': '理解您的问题...',
        'analyzing': '分析您的日记数据...',
        'finalizing': '完成中...',
        'error': '出了点问题，请重试',
        'complete': '回复准备就绪！',
        'initializing': '开始中...',
        'connecting': '连接到您的日记...',
      }
    };
    
    const languageMessages = allMessages[currentLanguage] || allMessages['en'];
    return languageMessages[stageConfig.key] || fallbackMessage;
  };

  const formatTimeEstimate = (timestamp: number) => {
    const remaining = Math.max(0, timestamp - Date.now());
    return `~${Math.ceil(remaining / 1000)}s`;
  };

  // Get current stage configuration
  const stageConfig = getStageConfig(stage);
  
  // Use translated message if available, otherwise fallback to provided message
  const displayMessage = React.useMemo(() => {
    return getTranslatedMessage(stage, message);
  }, [stage, message, currentLanguage]);

  return (
    <motion.div 
      className="bg-background/95 backdrop-blur-sm border rounded-lg p-4 space-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{stageConfig.icon}</span>
          <Badge variant="secondary" className="font-mono text-xs">
            {stage.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
        
        {estimatedCompletion && (
          <span className="text-xs text-muted-foreground ml-auto">
            {formatTimeEstimate(estimatedCompletion)}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-foreground">{displayMessage}</p>
        
        {progress > 0 && (
          <Progress value={progress} className="h-2" />
        )}
        
        {data && (
          <div className="text-xs text-muted-foreground space-y-1">
            {data.strategy && (
              <div>Strategy: <span className="font-medium">{data.strategy}</span></div>
            )}
            {data.searchMethod && (
              <div>Method: <span className="font-medium">{data.searchMethod}</span></div>
            )}
            {data.optimization && (
              <div>Optimization: <span className="font-medium">{data.optimization}</span></div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};