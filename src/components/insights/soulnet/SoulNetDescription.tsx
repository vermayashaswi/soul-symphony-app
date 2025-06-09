
import { TranslatableText } from '@/components/translation/TranslatableText';

const SoulNetDescription = () => {
  return (
    <div className="text-center mb-6">
      <h2 className="text-lg font-semibold mb-1">
        <TranslatableText text="Soul-Net" forceTranslate={true} />
      </h2>
      <p className="text-sm text-muted-foreground px-4">
        <TranslatableText text="Explore connections between life areas and emotions in your journal" forceTranslate={true} />
      </p>
    </div>
  );
};

export default SoulNetDescription;
