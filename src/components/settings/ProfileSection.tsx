
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Calendar,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TranslatableText } from '@/components/translation/TranslatableText';

export const ProfileSection: React.FC = () => {
  const { user } = useAuth();

  const formatJoinDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  // Simplified stats without complex profile loading
  const getBasicStats = () => {
    return {
      totalEntries: 0,
      streak: 0
    };
  };

  const stats = getBasicStats();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          <TranslatableText text="Profile" forceTranslate={true} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          <div className="h-24 w-24 relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src="" />
              <AvatarFallback className="text-2xl">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <h3 className="text-xl font-semibold">
                {user?.email?.split('@')[0] || 'User'}
              </h3>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <TranslatableText text="Entries" forceTranslate={true} />
                </div>
                <div className="text-lg font-semibold">{stats.totalEntries}</div>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <TranslatableText text="Streak" forceTranslate={true} />
                </div>
                <div className="text-lg font-semibold">{stats.streak} days</div>
              </div>
            </div>
            
            {user?.created_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <TranslatableText text="Joined" forceTranslate={true} />
                {formatJoinDate(user.created_at)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
