import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, RotateCcw, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useOrganizationCurrency } from '@/lib/saas/hooks';

interface JournalEntry {
  id: string;
  entry_date: string;
  memo: string;
  total_debit: number;
  total_credit: number;
  created_at: string;
}

export function JournalsList() {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { format: formatMoney } = useOrganizationCurrency();

  const loadJournals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setJournals(data || []);
    } catch (err) {
      console.error('Failed to load journals:', err);
      toast({ title: 'Error', description: 'Failed to load journal entries', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJournals();
  }, []);

  const handleEdit = (journalId: string) => {
    navigate(`/journal/edit/${journalId}`);
  };

  const handleReverse = async (journal: JournalEntry) => {
    if (!confirm('Are you sure you want to create a reversing entry?')) return;
    
    try {
      // For now, just show a message that this feature is coming soon
      toast({ title: 'Coming Soon', description: 'Reversing entries feature will be available soon' });
    } catch (err) {
      console.error('Failed to create reversing entry:', err);
      toast({ title: 'Error', description: 'Failed to create reversing entry', variant: 'destructive' });
    }
  };

  const handleDelete = async (journalId: string) => {
    if (!confirm('Are you sure you want to delete this journal entry? This action cannot be undone.')) return;
    
    try {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', journalId);
      
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Journal entry deleted successfully' });
      loadJournals();
    } catch (err) {
      console.error('Failed to delete journal:', err);
      toast({ title: 'Error', description: 'Failed to delete journal entry', variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading journal entries...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {journals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No journal entries found
                </TableCell>
              </TableRow>
            ) : (
              journals.map((journal) => (
                <TableRow key={journal.id}>
                  <TableCell>{new Date(journal.entry_date).toLocaleDateString()}</TableCell>
                  <TableCell className="max-w-xs truncate">{journal.memo}</TableCell>
                  <TableCell className="text-right">{formatMoney(journal.total_debit)}</TableCell>
                  <TableCell className="text-right">{formatMoney(journal.total_credit)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={journal.total_debit === journal.total_credit ? 'default' : 'destructive'}>
                      {journal.total_debit === journal.total_credit ? 'Balanced' : 'Unbalanced'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEdit(journal.id)}
                        title="Edit Journal"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleReverse(journal)}
                        title="Create Reversing Entry"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDelete(journal.id)}
                        title="Delete Journal"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}