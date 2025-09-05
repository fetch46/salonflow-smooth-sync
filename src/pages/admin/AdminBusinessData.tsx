
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, Calendar, Briefcase, Package, ShoppingCart, DollarSign, 
  FileText, Truck, Calculator, TrendingUp, BarChart3, Building, Search 
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";

interface TableStats {
  table_name: string;
  total_records: number;
  recent_records: number;
  last_updated?: string;
}

interface BusinessData {
  id: string;
  organization_name?: string;
  created_at: string;
  updated_at?: string;
  [key: string]: any;
}

const AdminBusinessData = () => {
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableData, setTableData] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrganization, setSelectedOrganization] = useState<string>("");
  const [organizations, setOrganizations] = useState<any[]>([]);

  const businessTables = useMemo(() => [
    { name: 'clients', label: 'Clients', icon: Users, description: 'Customer database' },
    { name: 'staff', label: 'Staff', icon: Users, description: 'Employee records' },
    { name: 'services', label: 'Services', icon: Briefcase, description: 'Service catalog' },
    { name: 'appointments', label: 'Appointments', icon: Calendar, description: 'Booking records' },
    { name: 'inventory_items', label: 'Inventory', icon: Package, description: 'Product catalog' },
    { name: 'sales', label: 'Sales', icon: ShoppingCart, description: 'Sales transactions' },
    { name: 'purchases', label: 'Purchases', icon: Truck, description: 'Purchase orders' },
    { name: 'expenses', label: 'Expenses', icon: DollarSign, description: 'Expense tracking' },
    { name: 'accounts', label: 'Accounts', icon: Calculator, description: 'Chart of accounts' },
    { name: 'suppliers', label: 'Suppliers', icon: Building, description: 'Vendor database' },
    { name: 'job_cards', label: 'Job Cards', icon: FileText, description: 'Service records' }
  ], []);

  const fetchTableStats = useCallback(async () => {
    try {
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // ProtectedRoute will handle redirect

      setLoading(true);
      const stats: TableStats[] = [];

      for (const table of businessTables) {
        try {
          // Get total count
          const { count: totalCount, error: totalError } = await supabase
            .from(table.name as any)
            .select('*', { count: 'exact', head: true });

          if (totalError) throw totalError;

          // Get recent count (last 7 days)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          const { count: recentCount, error: recentError } = await supabase
            .from(table.name as any)
            .select('*', { count: 'exact', head: true })
            .gte('created_at', sevenDaysAgo.toISOString());

          if (recentError) throw recentError;

          // Get last updated record
          const { data: lastRecord, error: lastError } = await supabase
            .from(table.name as any)
            .select('updated_at, created_at')
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(1);

          if (lastError) throw lastError;

           const record = Array.isArray(lastRecord) && lastRecord.length > 0 ? lastRecord[0] : null;
           stats.push({
             table_name: table.name,
             total_records: totalCount || 0,
             recent_records: recentCount || 0,
             last_updated: record ? 
               ((record as any).updated_at || (record as any).created_at || undefined)
               : undefined
           });
        } catch (error) {
          console.error(`Error fetching stats for ${table.name}:`, error);
          stats.push({
            table_name: table.name,
            total_records: 0,
            recent_records: 0
          });
        }
      }

      setTableStats(stats);
    } catch (error) {
      console.error('Error fetching table stats:', error);
      toast.error('Failed to fetch table statistics');
    } finally {
      setLoading(false);
    }
  }, [businessTables]);

  const fetchOrganizations = useCallback(async () => {
    try {
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // ProtectedRoute will handle redirect

      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Could not load organizations');
    }
  }, []);

  const fetchTableData = useCallback(async (tableName: string) => {
    try {
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // ProtectedRoute will handle redirect

      setDataLoading(true);
      
      let query = supabase
        .from(tableName as any)
        .select(`
          *,
          organizations(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedOrganization) {
        query = query.eq('organization_id', selectedOrganization);
      }

      const { data, error } = await query;

      if (error) throw error;

      const transformedData = Array.isArray(data) ? data.map(record => {
        if (!record || typeof record !== 'object') return { id: '', organization_name: '', created_at: '' };
        const safeRecord = record as any;
        return {
          ...safeRecord,
          organization_name: safeRecord.organizations?.name
        };
      }) : [];

      setTableData(transformedData);
    } catch (error) {
      console.error(`Error fetching ${tableName} data:`, error);
      toast.error(`Failed to fetch ${tableName} data`);
    } finally {
      setDataLoading(false);
    }
  }, [selectedOrganization]);

  useEffect(() => {
    const loadData = async () => {
      // Check session before making any requests
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // ProtectedRoute will handle redirect

      try {
        await Promise.all([
          fetchTableStats(),
          fetchOrganizations()
        ]);
      } catch (error) {
        console.error('Failed to load initial data:', error);
        toast.error('Failed to load data');
      }
    };

    loadData();
  }, [fetchTableStats, fetchOrganizations]);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable);
    }
  }, [selectedTable, selectedOrganization, fetchTableData]);

  const getTableIcon = (tableName: string) => {
    const table = businessTables.find(t => t.name === tableName);
    return table?.icon || FileText;
  };

  const getTableLabel = (tableName: string) => {
    const table = businessTables.find(t => t.name === tableName);
    return table?.label || tableName;
  };

  const filteredData = tableData.filter(record => {
    if (!searchTerm) return true;
    
    const searchableFields = Object.values(record).join(' ').toLowerCase();
    return searchableFields.includes(searchTerm.toLowerCase());
  });

  const renderTableData = (data: BusinessData[]) => {
    if (!data.length) {
      return (
        <div className="text-center py-8 text-gray-500">
          No data found for this table
        </div>
      );
    }

    // Get all unique keys for table headers (excluding some system fields)
    const excludeFields = ['id', 'organization_id', 'organizations', 'created_at', 'updated_at'];
    const sampleRecord = data[0];
    const headers = Object.keys(sampleRecord).filter(key => 
      !excludeFields.includes(key) && 
      sampleRecord[key] !== null && 
      sampleRecord[key] !== undefined
    ).slice(0, 8); // Limit to 8 columns for readability

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map(header => (
              <TableHead key={header}>
                {header.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </TableHead>
            ))}
            <TableHead>Organization</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 50).map((record, index) => (
            <TableRow key={record.id || index}>
              {headers.map(header => (
                <TableCell key={header}>
                  {typeof record[header] === 'boolean' ? (
                    <Badge variant={record[header] ? "default" : "secondary"}>
                      {record[header] ? 'Yes' : 'No'}
                    </Badge>
                  ) : typeof record[header] === 'number' ? (
                    record[header].toLocaleString()
                  ) : (
                    String(record[header] || '').slice(0, 50) + 
                    (String(record[header] || '').length > 50 ? '...' : '')
                  )}
                </TableCell>
              ))}
              <TableCell>{record.organization_name || '-'}</TableCell>
              <TableCell>
                {record.created_at ? format(new Date(record.created_at), 'MMM dd, yyyy') : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Business Data Management</h1>
            <p className="text-gray-500 mt-1">Overview and management of all business data tables</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="data">Table Data</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {businessTables.map((table) => {
                const stats = tableStats.find(s => s.table_name === table.name);
                const Icon = table.icon;
                
                return (
                  <Card key={table.name} className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          setSelectedTable(table.name);
                          (document.querySelector('[value="data"]') as HTMLElement | null)?.click();
                        }}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {table.label}
                      </CardTitle>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {loading ? '...' : (stats?.total_records || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {table.description}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-green-600">
                          +{stats?.recent_records || 0} this week
                        </span>
                        {stats?.last_updated && (
                          <span className="text-xs text-gray-500">
                            Updated {format(new Date(stats.last_updated), 'MMM dd')}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data">
            <div className="space-y-4">
              {/* Table Selection and Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Select Table</label>
                  <Select value={selectedTable} onValueChange={(v) => setSelectedTable(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a table..." />
                    </SelectTrigger>
                    <SelectContent>
                      {businessTables.map(table => (
                        <SelectItem key={table.name} value={table.name}>
                          {table.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Filter by Organization</label>
                  <Select value={selectedOrganization} onValueChange={(v) => setSelectedOrganization(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Organizations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Organizations</SelectItem>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Search Data</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search in table data..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Table Data Display */}
              {selectedTable ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {(() => {
                        const Icon = getTableIcon(selectedTable);
                        return <Icon className="h-5 w-5" />;
                      })()}
                      {getTableLabel(selectedTable)} Data
                    </CardTitle>
                    <CardDescription>
                      Showing {filteredData.length} records from {getTableLabel(selectedTable).toLowerCase()} table
                      {selectedOrganization && organizations.find(o => o.id === selectedOrganization) && 
                        ` for ${organizations.find(o => o.id === selectedOrganization)?.name}`
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dataLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {renderTableData(filteredData)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-32 text-gray-500">
                    Select a table to view its data
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminLayout>
  );
};

export default AdminBusinessData;
