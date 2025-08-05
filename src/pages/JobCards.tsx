import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { JobCardForm } from "@/components/forms/JobCardForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, FileText, Calendar, User, DollarSign, Eye, Edit, Printer, Trash2, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";

interface JobCard {
  id: string;
  job_number: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  staff: { full_name: string } | null;
  client: { full_name: string } | null;
}

export default function JobCards() {
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobCards();
  }, []);

  const fetchJobCards = async () => {
    try {
      const { data, error } = await supabase
        .from("job_cards")
        .select(`
          id, job_number, start_time, end_time, status, total_amount, created_at,
          staff:staff_id (full_name),
          client:client_id (full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobCards(data || []);
    } catch (error) {
      console.error("Error fetching job cards:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJobCard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job card?')) return;
    
    try {
      const { error } = await supabase
        .from('job_cards')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchJobCards();
    } catch (error) {
      console.error('Error deleting job card:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'in_progress': { label: 'In Progress', variant: 'secondary' as const },
      'completed': { label: 'Completed', variant: 'default' as const },
      'cancelled': { label: 'Cancelled', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredJobCards = jobCards.filter(card =>
    card.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.staff?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: jobCards.length,
    completed: jobCards.filter(card => card.status === 'completed').length,
    inProgress: jobCards.filter(card => card.status === 'in_progress').length,
    totalRevenue: jobCards.reduce((sum, card) => sum + card.total_amount, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading job cards...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Job Cards</h1>
          <p className="text-muted-foreground">Manage and track service job cards</p>
        </div>
        <Button onClick={() => navigate('/job-cards/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Job Card
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Job Cards</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ksh {stats.totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Job Cards List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by job number, client, or technician..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Job Cards Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="w-[50px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobCards.map((jobCard) => (
                  <TableRow key={jobCard.id}>
                    <TableCell className="font-medium">{jobCard.job_number}</TableCell>
                    <TableCell>{jobCard.client?.full_name || "N/A"}</TableCell>
                    <TableCell>{jobCard.staff?.full_name || "N/A"}</TableCell>
                    <TableCell>
                      {jobCard.start_time 
                        ? format(new Date(jobCard.start_time), "MMM dd, yyyy") 
                        : format(new Date(jobCard.created_at), "MMM dd, yyyy")
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(jobCard.status)}</TableCell>
                    <TableCell>Ksh {jobCard.total_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/job-cards/${jobCard.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/job-cards/${jobCard.id}/edit`)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.print()}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteJobCard(jobCard.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredJobCards.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No job cards found matching your search." : "No job cards created yet."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}