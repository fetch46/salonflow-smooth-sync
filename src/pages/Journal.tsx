import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus } from "lucide-react";
import { useSaas } from "@/lib/saas";
import { JournalsList } from '@/components/journals/JournalsList';
import { JournalEntryModal } from '@/components/journals/JournalEntryModal';

export default function Journal() {
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const { organization } = useSaas();
  const { systemSettings } = useSaas();
  const appName = (systemSettings as any)?.app_name || 'AURA OS';

  useEffect(() => {
    document.title = `Journal | ${appName}`;
  }, [appName]);

  const handleJournalSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleOpenModal = () => {
    if (!organization?.id) {
      console.error('No organization found');
      return;
    }
    setModalOpen(true);
  };

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-background to-muted/20 min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg">
            <BookOpen className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Journal Entries</h1>
            <p className="text-muted-foreground">View and manage posted journal entries</p>
          </div>
        </div>
        <Button onClick={handleOpenModal}>
          <Plus className="w-4 h-4 mr-2" />
          New Journal Entry
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Posted Journal Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <JournalsList key={refreshKey} />
        </CardContent>
      </Card>

      <JournalEntryModal 
        open={modalOpen} 
        onOpenChange={setModalOpen}
        onSuccess={handleJournalSuccess}
      />
    </div>
  );
}