import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  Star,
  Plus,
  ChevronRight
} from "lucide-react";

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const todayStats = [
    {
      title: "Today's Revenue",
      value: "$2,847",
      change: "+12%",
      icon: DollarSign,
      color: "text-success"
    },
    {
      title: "Appointments",
      value: "24",
      change: "+8%",
      icon: Calendar,
      color: "text-primary"
    },
    {
      title: "New Clients",
      value: "6",
      change: "+15%",
      icon: Users,
      color: "text-warning"
    },
    {
      title: "Staff Utilization",
      value: "87%",
      change: "+3%",
      icon: TrendingUp,
      color: "text-success"
    }
  ];

  const upcomingAppointments = [
    {
      id: 1,
      client: "Sarah Johnson",
      service: "Hair Cut & Color",
      staff: "Maria Garcia",
      time: "10:00 AM",
      duration: "2h",
      status: "confirmed"
    },
    {
      id: 2,
      client: "Emily Chen",
      service: "Manicure",
      staff: "Lisa Wong",
      time: "10:30 AM",
      duration: "1h",
      status: "confirmed"
    },
    {
      id: 3,
      client: "Michael Brown",
      service: "Beard Trim",
      staff: "John Smith",
      time: "11:00 AM",
      duration: "30min",
      status: "pending"
    },
    {
      id: 4,
      client: "Anna Rodriguez",
      service: "Full Service",
      staff: "Maria Garcia",
      time: "2:00 PM",
      duration: "3h",
      status: "confirmed"
    }
  ];

  const topStaff = [
    {
      name: "Maria Garcia",
      revenue: "$1,248",
      appointments: 8,
      rating: 4.9
    },
    {
      name: "Lisa Wong",
      revenue: "$892",
      appointments: 12,
      rating: 4.8
    },
    {
      name: "John Smith",
      revenue: "$707",
      appointments: 6,
      rating: 4.7
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-success/10 text-success";
      case "pending":
        return "bg-warning/10 text-warning";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's what's happening at your salon today.
          </p>
        </div>
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          <Button variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            Today: {selectedDate.toLocaleDateString()}
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {todayStats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className={stat.color}>{stat.change}</span> from yesterday
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Appointments */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Today's Appointments</CardTitle>
                  <CardDescription>
                    {upcomingAppointments.length} appointments scheduled
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground">
                          {appointment.client}
                        </h4>
                        <Badge className={getStatusColor(appointment.status)}>
                          {appointment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {appointment.service} • {appointment.staff}
                      </p>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Clock className="w-3 h-3 mr-1" />
                        {appointment.time} ({appointment.duration})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performing Staff */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Top Staff Today</CardTitle>
              <CardDescription>Performance leaders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topStaff.map((staff, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-foreground">{staff.name}</h4>
                        <div className="flex items-center">
                          <Star className="w-3 h-3 text-warning mr-1" />
                          <span className="text-sm text-muted-foreground">
                            {staff.rating}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{staff.revenue} revenue</span>
                        <span>{staff.appointments} appointments</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" />
                Add New Client
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                Block Time Slot
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <DollarSign className="w-4 h-4 mr-2" />
                Process Payment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;