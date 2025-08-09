import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  Star,
  Plus,
  ChevronRight,
  Activity,
  Target,
  Zap,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Receipt,
  UserCheck,
  Scissors,
  Eye,
  Settings,
  Bell,
  CheckCircle,
  AlertTriangle,
  Timer,
  MapPin,
  Crown,
  TrendingDown,
  RefreshCw,
  Calendar as CalendarIcon,
  Phone,
  Mail,
  MessageSquare
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { useSaas } from "@/lib/saas/context";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useNavigate } from "react-router-dom";

// Mock data - in a real app, this would come from your backend
const generateMockData = () => {
  const today = new Date();
  const yesterday = subDays(today, 1);
  const lastWeek = subDays(today, 7);
  
  return {
    todayStats: {
      revenue: 2847,
      yesterdayRevenue: 2540,
      appointments: 24,
      yesterdayAppointments: 22,
      newClients: 6,
      yesterdayNewClients: 5,
      staffUtilization: 87,
      yesterdayUtilization: 84,
      completionRate: 96,
      yesterdayCompletionRate: 94,
      avgServiceTime: 45,
      yesterdayAvgServiceTime: 48
    },
    monthlyStats: {
      totalRevenue: 45680,
      lastMonthRevenue: 42350,
      totalAppointments: 368,
      lastMonthAppointments: 345,
      newClients: 89,
      lastMonthNewClients: 76,
      clientRetention: 78,
      lastMonthRetention: 76
    }
  };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeRange, setTimeRange] = useState("today");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user, organization, subscriptionPlan } = useSaas();
  
  const mockData = useMemo(() => generateMockData(), []);

  
  useEffect(() => {
    console.log('Dashboard mounted');
    console.log('User:', user);
    console.log('Organization:', organization);
    console.log('Subscription Plan:', subscriptionPlan);
  }, [user, organization, subscriptionPlan]);

  const todayStats = [
    {
      title: "Today's Revenue",
             value: `${useOrganizationCurrency().symbol}${mockData.todayStats.revenue.toLocaleString()}` as string,
      previousValue: mockData.todayStats.yesterdayRevenue,
      change: ((mockData.todayStats.revenue - mockData.todayStats.yesterdayRevenue) / mockData.todayStats.yesterdayRevenue * 100),
      icon: DollarSign,
      gradient: "from-emerald-500 to-emerald-600",
      trend: "up"
    },
    {
      title: "Appointments",
      value: mockData.todayStats.appointments.toString(),
      previousValue: mockData.todayStats.yesterdayAppointments,
      change: ((mockData.todayStats.appointments - mockData.todayStats.yesterdayAppointments) / mockData.todayStats.yesterdayAppointments * 100),
      icon: Calendar,
      gradient: "from-blue-500 to-blue-600",
      trend: "up"
    },
    {
      title: "New Clients",
      value: mockData.todayStats.newClients.toString(),
      previousValue: mockData.todayStats.yesterdayNewClients,
      change: ((mockData.todayStats.newClients - mockData.todayStats.yesterdayNewClients) / mockData.todayStats.yesterdayNewClients * 100),
      icon: Users,
      gradient: "from-purple-500 to-purple-600",
      trend: "up"
    },
    {
      title: "Staff Utilization",
      value: `${mockData.todayStats.staffUtilization}%`,
      previousValue: mockData.todayStats.yesterdayUtilization,
      change: ((mockData.todayStats.staffUtilization - mockData.todayStats.yesterdayUtilization) / mockData.todayStats.yesterdayUtilization * 100),
      icon: TrendingUp,
      gradient: "from-amber-500 to-amber-600",
      trend: "up"
    },
    {
      title: "Completion Rate",
      value: `${mockData.todayStats.completionRate}%`,
      previousValue: mockData.todayStats.yesterdayCompletionRate,
      change: ((mockData.todayStats.completionRate - mockData.todayStats.yesterdayCompletionRate) / mockData.todayStats.yesterdayCompletionRate * 100),
      icon: CheckCircle,
      gradient: "from-green-500 to-green-600",
      trend: "up"
    },
    {
      title: "Avg Service Time",
      value: `${mockData.todayStats.avgServiceTime}min`,
      previousValue: mockData.todayStats.yesterdayAvgServiceTime,
      change: ((mockData.todayStats.avgServiceTime - mockData.todayStats.yesterdayAvgServiceTime) / mockData.todayStats.yesterdayAvgServiceTime * 100),
      icon: Timer,
      gradient: "from-cyan-500 to-cyan-600",
      trend: "down"
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
      status: "confirmed",
      avatar: "SJ",
      price: 165,
      isVip: true
    },
    {
      id: 2,
      client: "Emily Chen",
      service: "Manicure & Pedicure",
      staff: "Lisa Wong",
      time: "10:30 AM",
      duration: "1h 30min",
      status: "confirmed",
      avatar: "EC",
      price: 85,
      isVip: false
    },
    {
      id: 3,
      client: "Michael Brown",
      service: "Beard Trim & Styling",
      staff: "John Smith",
      time: "11:00 AM",
      duration: "45min",
      status: "pending",
      avatar: "MB",
      price: 45,
      isVip: false
    },
    {
      id: 4,
      client: "Anna Rodriguez",
      service: "Full Service Package",
      staff: "Maria Garcia",
      time: "2:00 PM",
      duration: "3h",
      status: "confirmed",
      avatar: "AR",
      price: 285,
      isVip: true
    },
    {
      id: 5,
      client: "David Kim",
      service: "Facial Treatment",
      staff: "Lisa Wong",
      time: "3:30 PM",
      duration: "1h",
      status: "confirmed",
      avatar: "DK",
      price: 95,
      isVip: false
    }
  ];

  const topStaff = [
    {
      name: "Maria Garcia",
      revenue: 1248,
      appointments: 8,
      rating: 4.9,
      specialties: ["Hair Color", "Styling"],
      completionRate: 98,
      avatar: "MG"
    },
    {
      name: "Lisa Wong",
      revenue: 892,
      appointments: 12,
      rating: 4.8,
      specialties: ["Nails", "Facial"],
      completionRate: 96,
      avatar: "LW"
    },
    {
      name: "John Smith",
      revenue: 707,
      appointments: 6,
      rating: 4.7,
      specialties: ["Men's Cuts", "Beard"],
      completionRate: 94,
      avatar: "JS"
    },
    {
      name: "Sophie Martinez",
      revenue: 654,
      appointments: 9,
      rating: 4.8,
      specialties: ["Massage", "Spa"],
      completionRate: 97,
      avatar: "SM"
    }
  ];

  const recentActivities = [
    {
      type: "appointment",
      message: "New appointment booked by Sarah Johnson",
      time: "5 minutes ago",
      icon: Calendar,
      color: "text-blue-600"
    },
    {
      type: "payment",
      message: "Payment received - $165 from Emily Chen",
      time: "12 minutes ago",
      icon: DollarSign,
      color: "text-green-600"
    },
    {
      type: "review",
      message: "New 5-star review from Michael Brown",
      time: "25 minutes ago",
      icon: Star,
      color: "text-amber-600"
    },
    {
      type: "staff",
      message: "Maria Garcia completed appointment",
      time: "35 minutes ago",
      icon: CheckCircle,
      color: "text-emerald-600"
    },
    {
      type: "inventory",
      message: "Low stock alert - Hair Color Kit",
      time: "1 hour ago",
      icon: AlertTriangle,
      color: "text-red-600"
    }
  ];

  const quickActions = [
    {
      title: "New Appointment",
      description: "Book appointment for client",
      icon: Calendar,
      color: "bg-blue-50 text-blue-600 hover:bg-blue-100",
      action: () => navigate("/appointments?create=1")
    },
    {
      title: "Add Client",
      description: "Register new customer",
      icon: Users,
      color: "bg-green-50 text-green-600 hover:bg-green-100",
      action: () => navigate("/clients?create=1")
    },
    {
      title: "Process Payment",
      description: "Handle transaction",
      icon: DollarSign,
      color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
      action: () => navigate("/pos")
    },
    {
      title: "View Reports",
      description: "Analytics & insights",
      icon: BarChart3,
      color: "bg-purple-50 text-purple-600 hover:bg-purple-100",
      action: () => navigate("/reports")
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "completed":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const refreshData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
  };

  // Error boundary
  if (error) {
    return (
      <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-red-700">Dashboard Error</h2>
          <p className="text-red-600">{error}</p>
          <Button onClick={() => setError(null)}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">


      {/* Modern Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl shadow-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-600">Welcome back! Here's your salon overview for today.</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={loading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Enhanced Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {todayStats.map((stat, index) => (
          <Card key={index} className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-100`} />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-white/80" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="flex items-center mt-1">
                {stat.change > 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-white/80 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-white/80 mr-1" />
                )}
                <p className="text-xs text-white/80">
                  {stat.change > 0 ? '+' : ''}{stat.change.toFixed(1)}% from yesterday
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Appointments - Enhanced */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Today's Schedule
                  </CardTitle>
                  <CardDescription>
                    {upcomingAppointments.length} appointments • ${upcomingAppointments.reduce((sum, apt) => sum + apt.price, 0).toLocaleString()} revenue
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {upcomingAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-medium text-sm">
                          {appointment.avatar}
                        </div>
                        {appointment.isVip && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                            <Crown className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-slate-900 truncate">
                            {appointment.client}
                          </h4>
                          <Badge className={`${getStatusColor(appointment.status)} text-xs border`}>
                            {appointment.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 truncate">
                          {appointment.service} • {appointment.staff}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center text-xs text-slate-500">
                            <Clock className="w-3 h-3 mr-1" />
                            {appointment.time} ({appointment.duration})
                          </div>
                          <div className="text-sm font-semibold text-slate-900">
                            ${appointment.price}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Top Performing Staff */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                Top Performers
              </CardTitle>
              <CardDescription>Today's leading staff members</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {topStaff.map((staff, index) => (
                  <div key={index} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-xs">
                          {staff.avatar}
                        </div>
                        {index === 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                            <Crown className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-slate-900 text-sm truncate">{staff.name}</h4>
                          <div className="flex items-center">
                            <Star className="w-3 h-3 text-amber-500 mr-1" />
                            <span className="text-xs text-slate-600">{staff.rating}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>${staff.revenue.toLocaleString()}</span>
                          <span>{staff.appointments} apts</span>
                          <span>{staff.completionRate}%</span>
                        </div>
                        <div className="mt-1">
                          <Progress value={staff.completionRate} className="h-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-violet-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className={`${action.color} border-0 flex-col h-auto p-3 space-y-1`}
                    onClick={action.action}
                  >
                    <action.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{action.title}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest updates and notifications</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                  <div className={`p-2 rounded-lg bg-slate-50 ${activity.color}`}>
                    <activity.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900">{activity.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Overview */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Performance Overview
            </CardTitle>
            <CardDescription>Key metrics and goals</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Monthly Revenue Goal</span>
                  <span className="text-sm text-slate-600">$45K / $50K</span>
                </div>
                <Progress value={90} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Client Satisfaction</span>
                  <span className="text-sm text-slate-600">4.8 / 5.0</span>
                </div>
                <Progress value={96} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Staff Efficiency</span>
                  <span className="text-sm text-slate-600">87%</span>
                </div>
                <Progress value={87} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Booking Rate</span>
                  <span className="text-sm text-slate-600">78%</span>
                </div>
                <Progress value={78} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;