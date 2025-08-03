import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input"; import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; import { Badge } from "@/components/ui/badge";

const clients = [ { name: "John Doe", phone: "+254712345678", status: "Active" }, { name: "Jane Smith", phone: "+254798765432", status: "Inactive" }, { name: "James Brown", phone: "+254701112233", status: "Active" }, { name: "Alice Blue", phone: "+254701998877", status: "Active" }, { name: "Peter Park", phone: "+254798811223", status: "Inactive" } ];

const Clients = () => { return ( <div className="p-6 mx-auto space-y-6 max-w-6xl"> <div> <h1 className="text-3xl font-bold text-foreground">Clients</h1> <p className="text-muted-foreground">View and manage your salon clients</p> </div>

{/* Dashboard Cards */}
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
    <Card className="shadow-lg border-t-4 border-primary">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-muted-foreground">Active Clients</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">3</div>
      </CardContent>
    </Card>
    <Card className="shadow-lg border-t-4 border-green-600">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-muted-foreground">Total Clients</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">5</div>
      </CardContent>
    </Card>
  </div>

  {/* Clients Table */}
  <Card className="shadow-md">
    <CardHeader>
      <CardTitle>Client List</CardTitle>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client, index) => (
            <TableRow key={index}>
              <TableCell>{client.name}</TableCell>
              <TableCell>{client.phone}</TableCell>
              <TableCell>
                <Badge variant={client.status === "Active" ? "default" : "outline"}>
                  {client.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline">View</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</div>

); };

export default Clients;

