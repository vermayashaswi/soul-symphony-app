
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Edit, Save, X } from 'lucide-react';

interface Theme {
  id: number;
  name: string;
  description: string | null;
  display_order: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface NewTheme {
  name: string;
  description: string;
  display_order: number;
}

export default function ThemesManagement() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTheme, setNewTheme] = useState<NewTheme>({ name: '', description: '', display_order: 0 });
  const { toast } = useToast();

  useEffect(() => {
    fetchThemes();
  }, []);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        throw error;
      }

      setThemes(data || []);
    } catch (error) {
      console.error('Error fetching themes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch themes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTheme = async (id: number, updates: Partial<Theme>) => {
    try {
      const { error } = await supabase
        .from('themes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw error;
      }

      setThemes(prev => prev.map(theme => 
        theme.id === id ? { ...theme, ...updates } : theme
      ));

      toast({
        title: "Success",
        description: "Theme updated successfully",
      });
    } catch (error) {
      console.error('Error updating theme:', error);
      toast({
        title: "Error",
        description: "Failed to update theme",
        variant: "destructive",
      });
    }
  };

  const createTheme = async () => {
    if (!newTheme.name.trim()) {
      toast({
        title: "Error",
        description: "Theme name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('themes')
        .insert([{
          name: newTheme.name.trim(),
          description: newTheme.description.trim() || null,
          display_order: newTheme.display_order || themes.length + 1,
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setThemes(prev => [...prev, data].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
      setNewTheme({ name: '', description: '', display_order: 0 });
      setShowNewForm(false);

      toast({
        title: "Success",
        description: "Theme created successfully",
      });
    } catch (error) {
      console.error('Error creating theme:', error);
      toast({
        title: "Error",
        description: "Failed to create theme",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    await updateTheme(id, { is_active: isActive });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Themes Management</h1>
        <p className="text-muted-foreground">
          Manage the master categories used for journal entry classification. These themes are used by the AI to categorize journal entries.
        </p>
      </div>

      <div className="mb-6">
        <Button 
          onClick={() => setShowNewForm(!showNewForm)}
          className="mb-4"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Theme
        </Button>

        {showNewForm && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Create New Theme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="new-name">Theme Name</Label>
                <Input
                  id="new-name"
                  value={newTheme.name}
                  onChange={(e) => setNewTheme(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Work & Career"
                />
              </div>
              <div>
                <Label htmlFor="new-description">Description</Label>
                <Textarea
                  id="new-description"
                  value={newTheme.description}
                  onChange={(e) => setNewTheme(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this theme covers..."
                />
              </div>
              <div>
                <Label htmlFor="new-order">Display Order</Label>
                <Input
                  id="new-order"
                  type="number"
                  value={newTheme.display_order}
                  onChange={(e) => setNewTheme(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  placeholder="Display order (0 for auto)"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createTheme}>
                  <Save className="h-4 w-4 mr-2" />
                  Create Theme
                </Button>
                <Button variant="outline" onClick={() => setShowNewForm(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {themes.map((theme) => (
          <Card key={theme.id} className={theme.is_active ? '' : 'opacity-60'}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">{theme.name}</CardTitle>
                  <Badge variant={theme.is_active ? 'default' : 'secondary'}>
                    {theme.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {theme.display_order && (
                    <Badge variant="outline">
                      Order: {theme.display_order}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`active-${theme.id}`}
                      checked={theme.is_active}
                      onCheckedChange={(checked) => toggleActive(theme.id, checked)}
                    />
                    <Label htmlFor={`active-${theme.id}`}>Active</Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingId(editingId === theme.id ? null : theme.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {theme.description && (
                <CardDescription>{theme.description}</CardDescription>
              )}
            </CardHeader>
            
            {editingId === theme.id && (
              <CardContent>
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label>Theme Name</Label>
                    <Input
                      value={theme.name}
                      onChange={(e) => setThemes(prev => prev.map(t => 
                        t.id === theme.id ? { ...t, name: e.target.value } : t
                      ))}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={theme.description || ''}
                      onChange={(e) => setThemes(prev => prev.map(t => 
                        t.id === theme.id ? { ...t, description: e.target.value } : t
                      ))}
                    />
                  </div>
                  <div>
                    <Label>Display Order</Label>
                    <Input
                      type="number"
                      value={theme.display_order || 0}
                      onChange={(e) => setThemes(prev => prev.map(t => 
                        t.id === theme.id ? { ...t, display_order: parseInt(e.target.value) || 0 } : t
                      ))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        updateTheme(theme.id, {
                          name: theme.name,
                          description: theme.description,
                          display_order: theme.display_order
                        });
                        setEditingId(null);
                      }}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEditingId(null);
                        fetchThemes(); // Reset to original values
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">How Themes Work</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Themes are used by the AI to categorize journal entries automatically</li>
          <li>• Only active themes are available for selection during analysis</li>
          <li>• Display order determines how themes appear in lists</li>
          <li>• Changes to themes will affect future journal entry analysis</li>
          <li>• The generate-themes function uses these categories as the master list</li>
        </ul>
      </div>
    </div>
  );
}
