
import { ProcessReviews } from '../components/ProcessReviews';
import { RandomRatingsButton } from '../components/RandomRatingsButton';
import { Separator } from '../components/ui/separator';

export default function Home() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Restaurant Reviews Processor</h1>
      
      <div className="flex justify-center mb-6">
        <RandomRatingsButton />
      </div>
      
      <Separator className="my-6" />
      
      <ProcessReviews />
    </div>
  );
}
