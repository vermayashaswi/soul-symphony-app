
import { TranslatableText } from '@/components/translation/TranslatableText';

const SoulNetDescription = () => {
  return (
    <div className="text-center mb-6">
      <h2 className="text-lg font-semibold mb-1">
        <TranslatableText text="SoulNet Visualization" />
      </h2>
      <p className="text-sm text-muted-foreground px-4">
        <TranslatableText text="Explore connections between entities and emotions in your journal" />
      </p>
    </div>
  );
};

export default SoulNetDescription;
