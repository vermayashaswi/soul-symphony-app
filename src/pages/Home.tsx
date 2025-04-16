
import { ProcessReviews } from '../components/ProcessReviews';

export default function Home() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Restaurant Reviews Processor</h1>
      <ProcessReviews />
    </div>
  );
}
