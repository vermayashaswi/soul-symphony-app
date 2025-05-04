import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { staticTranslation } from '@/services/staticTranslationService';

const SoulNet = () => {
  const { getStaticTranslation } = useTranslation();
  const navigate = useNavigate();

  const handleExploreClick = () => {
    navigate('/journal');
  };

  return (
    <Card className="w-full max-w-md mx-auto my-8">
      <CardHeader>
        <CardTitle>{getStaticTranslation('SoulNet')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{getStaticTranslation('Connect with your inner self.')}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleExploreClick}>{getStaticTranslation('Explore')}</Button>
      </CardFooter>
    </Card>
  );
};

export default SoulNet;

