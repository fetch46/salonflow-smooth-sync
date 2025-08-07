import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  HelpCircle,
  Search,
  BookOpen,
  MessageCircle,
  Mail,
  Phone,
  Video,
  FileText,
  Star,
  ExternalLink,
  ChevronRight,
  Lightbulb,
  Settings,
  Users,
  Calendar,
  Package,
  DollarSign,
} from 'lucide-react';
import { useSaas } from '@/contexts/SaasContext';

const Help = () => {
  const { organization } = useSaas();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('getting-started');

  // Mock FAQ data
  const faqs = {
    'getting-started': [
      {
        question: 'How do I set up my salon for the first time?',
        answer: 'To set up your salon, go to Settings > Organization Setup and fill in your salon details, including name, address, and contact information. You can also upload your logo and set your business hours.',
        category: 'Setup',
        popular: true,
      },
      {
        question: 'How do I add my first staff member?',
        answer: 'Navigate to Staff > Add Staff Member. Fill in their details including name, email, phone, and role. You can assign them specific permissions and working hours.',
        category: 'Staff',
        popular: false,
      },
      {
        question: 'How do I create my first service?',
        answer: 'Go to Services > Add Service. Enter the service name, description, duration, and price. You can also assign staff members who can perform this service.',
        category: 'Services',
        popular: true,
      },
    ],
    'appointments': [
      {
        question: 'How do I book an appointment?',
        answer: 'Navigate to Appointments > New Appointment. Select the client, service, staff member, and preferred date/time. The system will show available slots.',
        category: 'Booking',
        popular: true,
      },
      {
        question: 'Can clients book appointments online?',
        answer: 'Yes! You can enable online booking by going to Settings > Online Booking. This allows clients to book appointments through your website or a booking link.',
        category: 'Online Booking',
        popular: true,
      },
      {
        question: 'How do I reschedule an appointment?',
        answer: 'Find the appointment in your calendar, click on it, and select "Reschedule". Choose a new date and time, then confirm the change.',
        category: 'Management',
        popular: false,
      },
    ],
    'clients': [
      {
        question: 'How do I add a new client?',
        answer: 'Go to Clients > Add Client. Enter their name, email, phone number, and any additional notes. You can also upload a photo and set preferences.',
        category: 'Management',
        popular: true,
      },
      {
        question: 'How do I view client history?',
        answer: 'Click on any client in the Clients list to view their profile. You\'ll see their appointment history, preferences, and any notes.',
        category: 'History',
        popular: false,
      },
    ],
    'billing': [
      {
        question: 'How do I create an invoice?',
        answer: 'After completing a service, go to the appointment and click "Create Invoice". Add any additional items, apply discounts, and send to the client.',
        category: 'Invoicing',
        popular: true,
      },
      {
        question: 'How do I track payments?',
        answer: 'All payments are automatically tracked in the system. Go to Accounts > Payments to view payment history and outstanding balances.',
        category: 'Payments',
        popular: false,
      },
    ],
  };

  const quickActions = [
    {
      title: 'Setup Guide',
      description: 'Complete setup walkthrough',
      icon: Settings,
      color: 'bg-blue-500',
      link: '#setup-guide',
    },
    {
      title: 'Video Tutorials',
      description: 'Learn with video guides',
      icon: Video,
      color: 'bg-purple-500',
      link: '#tutorials',
    },
    {
      title: 'Contact Support',
      description: 'Get help from our team',
      icon: MessageCircle,
      color: 'bg-green-500',
      link: '#contact',
    },
    {
      title: 'API Documentation',
      description: 'Developer resources',
      icon: FileText,
      color: 'bg-orange-500',
      link: '#api',
    },
  ];

  const popularTopics = [
    { title: 'Appointment Management', icon: Calendar, count: 15 },
    { title: 'Client Management', icon: Users, count: 12 },
    { title: 'Service Setup', icon: Package, count: 8 },
    { title: 'Billing & Payments', icon: DollarSign, count: 10 },
  ];

  const filteredFaqs = Object.entries(faqs).reduce((acc, [category, items]) => {
    if (searchQuery) {
      const filtered = items.filter(item =>
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[category] = filtered;
      }
    } else {
      acc[category] = items;
    }
    return acc;
  }, {} as typeof faqs);

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
              <HelpCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Help & Support</h1>
              <p className="text-slate-600">Find answers, tutorials, and get help when you need it</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
            <Mail className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg">
            <MessageCircle className="w-4 h-4 mr-2" />
            Live Chat
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Search for help articles, tutorials, or FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-3 text-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action, index) => (
          <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${action.color}`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">{action.title}</h3>
                  <p className="text-sm text-slate-600">{action.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Popular Topics */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Popular Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {popularTopics.map((topic, index) => (
              <div key={index} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <topic.icon className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{topic.title}</h4>
                  <p className="text-sm text-slate-600">{topic.count} articles</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* FAQ Section */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="clients">Clients</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>

            {Object.entries(filteredFaqs).map(([category, items]) => (
              <TabsContent key={category} value={category} className="space-y-4">
                {items.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <h3 className="text-lg font-medium mb-2">No results found</h3>
                      <p className="text-slate-600">Try adjusting your search terms or browse our categories</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Accordion type="single" collapsible className="space-y-4">
                    {items.map((faq, index) => (
                      <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            {faq.popular && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                <Star className="w-3 h-3 mr-1" />
                                Popular
                              </Badge>
                            )}
                            <span className="font-medium">{faq.question}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-4">
                          <div className="space-y-3">
                            <p className="text-slate-600">{faq.answer}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {faq.category}
                              </Badge>
                              <Button variant="ghost" size="sm" className="text-xs">
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Related Articles
                              </Button>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Support */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                Need More Help?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Live Chat</h4>
                    <p className="text-sm text-slate-600">Available 24/7</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Email Support</h4>
                    <p className="text-sm text-slate-600">support@salonsaas.com</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Phone className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Phone Support</h4>
                    <p className="text-sm text-slate-600">+1 (555) 123-4567</p>
                  </div>
                </div>
              </div>
              
              <Button className="w-full">
                <MessageCircle className="w-4 h-4 mr-2" />
                Start Live Chat
              </Button>
            </CardContent>
          </Card>

          {/* Tips & Tricks */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Pro Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-medium text-amber-800 mb-1">Keyboard Shortcuts</h4>
                  <p className="text-sm text-amber-700">Use Ctrl+N for new appointments, Ctrl+S for quick save</p>
                </div>
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-1">Auto-Save</h4>
                  <p className="text-sm text-blue-700">All changes are automatically saved as you work</p>
                </div>
                
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-1">Mobile App</h4>
                  <p className="text-sm text-green-700">Access your salon data on the go with our mobile app</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Status</span>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Operational
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database</span>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Operational
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email Service</span>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Operational
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Help;