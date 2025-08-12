import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Users, 
  CreditCard, 
  BarChart3, 
  CheckCircle, 
  Star,
  Clock,
  Smartphone,
  Shield,
  MapPin
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useOrganizationCurrency } from "@/lib/saas/hooks";

const Landing = () => {
  const features = [
    {
      icon: Calendar,
      title: "Online Booking",
      description: "24/7 online booking system with real-time availability"
    },
    {
      icon: Users,
      title: "Client Management",
      description: "Complete customer profiles and appointment history"
    },
    {
      icon: CreditCard,
      title: "POS System",
      description: "Integrated point-of-sale for seamless transactions"
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description: "Detailed insights into your salon's performance"
    }
  ];

  const defaultPlans = [
    {
      name: "Basic",
      price: "$29",
      period: "/month",
      description: "Perfect for small salons getting started",
      features: [
        "Up to 2 staff members",
        "Online booking",
        "Basic POS",
        "Customer management",
        "Email support"
      ],
      popular: false
    },
    {
      name: "Pro",
      price: "$79",
      period: "/month",
      description: "Ideal for growing salons",
      features: [
        "Up to 10 staff members",
        "Advanced analytics",
        "Inventory management",
        "Marketing tools",
        "Priority support",
        "Custom branding"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "$149",
      period: "/month",
      description: "For large salon chains",
      features: [
        "Unlimited staff",
        "Multi-location support",
        "Advanced reporting",
        "API access",
        "Dedicated support",
        "Custom integrations"
      ],
      popular: false
    }
  ];

  // Load subscription plans from Supabase and setup SEO
  type DbPlan = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price_monthly: number | null;
    price_yearly: number | null;
    features: Record<string, boolean> | null;
    is_active: boolean;
    sort_order: number | null;
    max_users: number | null;
    max_locations: number | null;
  };

  const [dbPlans, setDbPlans] = useState<DbPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);

  type FeaturedBiz = {
    id: string;
    name: string;
    category: string | null;
    city: string | null;
    country: string | null;
    logo_url: string | null;
    website_url: string | null;
    rating: number | null;
    review_count: number | null;
  };
  const [featured, setFeatured] = useState<FeaturedBiz[]>([]);

  type LandingSettings = {
    id: string;
    hero_title: string | null;
    hero_subtitle: string | null;
    highlights: string[] | null;
    pricing_copy: string | null;
    cta_primary_text: string | null;
    cta_secondary_text: string | null;
  };
  const [settings, setSettings] = useState<LandingSettings | null>(null);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [scrolled, setScrolled] = useState<boolean>(false);
  const { formatUsdCents } = useOrganizationCurrency();

  useEffect(() => {
    const loadPlans = async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select(
          "id, name, slug, description, price_monthly, price_yearly, features, is_active, sort_order, max_users, max_locations"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        setDbPlans(data as unknown as DbPlan[]);
      }
      setLoadingPlans(false);
    };

    const loadFeatured = async () => {
      const { data } = await supabase
        .from('business_listings')
        .select('id, name, category, city, country, logo_url, website_url, rating, review_count')
        .eq('is_active', true)
        .eq('is_featured', true)
        .limit(8);
      if (data) setFeatured(data as any);
    };

    const loadSettings = async () => {
      const { data } = await supabase
        .from('landing_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setSettings(data as any);
    };

    loadPlans();
    loadFeatured();
    loadSettings();

    // SEO: Title and meta description
    document.title = "AURA OS — Modern Salon Software";
    const desc =
      "All‑in‑one salon software for bookings, POS, and growth. Simple to start, powerful at scale.";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", desc);
    } else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toTitleCase = (s: string) =>
    s
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const plans = (dbPlans && dbPlans.length > 0)
    ? dbPlans.map((p) => ({
        name: p.name,
        description: p.description ?? "",
        priceMonthly: formatUsdCents((p.price_monthly ?? 0) as number),
        priceYearlyPerMonth: p.price_yearly ? formatUsdCents(Math.round((((p.price_yearly ?? 0) as number) / 12))) : undefined,
        periodLabel: billing === 'yearly' ? "/mo, billed yearly" : "/month",
        features: Object.entries(p.features ?? {})
          .filter(([, v]) => Boolean(v))
          .map(([k]) => toTitleCase(k)),
        popular: p.slug === "professional",
      }))
    : defaultPlans.map((p) => ({
        name: p.name,
        description: p.description,
        priceMonthly: p.price,
        priceYearlyPerMonth: undefined,
        periodLabel: billing === 'yearly' ? "/mo, billed yearly" : p.period,
        features: p.features,
        popular: p.popular,
      }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b transition-all ${scrolled ? 'bg-card/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md' : 'bg-transparent'}`}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">AURA OS</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
            <Link to="/businesses" className="text-muted-foreground hover:text-foreground transition-colors">Businesses</Link>
            <Link to="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_50%_-400px,hsl(var(--primary)/0.12),transparent)]" />
        <div className="container mx-auto max-w-6xl grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left">
            <Badge variant="secondary" className="mb-4">
              <Star className="w-3 h-3 mr-1" />
              Trusted by 10,000+ salons worldwide
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              {settings?.hero_title || (
                <>Streamline Your Salon <span className="text-primary block">Management</span></>
              )}
            </h1>
            <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto lg:mx-0">
              {settings?.hero_subtitle || (
                "The all-in-one platform for bookings, staff, inventory, and payments."
              )}
            </p>
            {!!(settings?.highlights?.length) && (
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-6">
                {settings!.highlights!.map((h, i) => (
                  <Badge key={i} variant="outline" className="text-sm">{h}</Badge>
                ))}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
              <Link to="/register">
                <Button size="lg" className="text-lg px-8 py-6">
                  {settings?.cta_primary_text || 'Get Started Free'}
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                  <Clock className="w-5 h-5 mr-2" />
                  {settings?.cta_secondary_text || 'Book a Demo'}
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex items-center justify-center lg:justify-start space-x-6 text-sm text-muted-foreground">
              <div className="flex items-center"><CheckCircle className="w-4 h-4 mr-1 text-success" />Setup in minutes</div>
              <div className="flex items-center"><CheckCircle className="w-4 h-4 mr-1 text-success" />No credit card</div>
              <div className="flex items-center"><CheckCircle className="w-4 h-4 mr-1 text-success" />Free 14-day trial</div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative rounded-xl border bg-card p-3 shadow-sm">
              <img src="/placeholder.svg" alt="Product preview" className="rounded-lg border" />
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-6xl mt-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 opacity-70">
            <div className="text-center text-sm">GlowBar</div>
            <div className="text-center text-sm">UrbanCuts</div>
            <div className="text-center text-sm">StyleHub</div>
            <div className="text-center text-sm">Bellezza</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Everything Your Salon Needs
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From online booking to inventory management, we've got you covered with 
              professional tools designed for salon success.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Additional Features */}
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            <Card className="p-6">
              <div className="flex items-center mb-4">
                <Smartphone className="w-8 h-8 text-primary mr-3" />
                <h3 className="text-xl font-semibold">Mobile Optimized</h3>
              </div>
              <p className="text-muted-foreground">
                Access your salon management tools from any device. Our responsive design 
                works perfectly on tablets and smartphones.
              </p>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center mb-4">
                <Shield className="w-8 h-8 text-primary mr-3" />
                <h3 className="text-xl font-semibold">Secure & Reliable</h3>
              </div>
              <p className="text-muted-foreground">
                Your data is protected with enterprise-grade security. 99.9% uptime 
                guarantee ensures your salon never stops running.
              </p>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center mb-4">
                <BarChart3 className="w-8 h-8 text-primary mr-3" />
                <h3 className="text-xl font-semibold">Grow Your Business</h3>
              </div>
              <p className="text-muted-foreground">
                Make data-driven decisions with detailed analytics and reporting. 
                Track performance and identify growth opportunities.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-foreground mb-3">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-muted-foreground">
              {settings?.pricing_copy || "Choose the plan that fits your salon's needs. All plans include our core features."}
            </p>
          </div>

          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-lg border bg-card p-1">
              <button
                className={`px-4 py-2 text-sm rounded-md ${billing === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => setBilling('monthly')}
              >
                Monthly
              </button>
              <button
                className={`px-4 py-2 text-sm rounded-md ${billing === 'yearly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => setBilling('yearly')}
              >
                Yearly
              </button>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'ring-2 ring-primary shadow-lg scale-105' : ''}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">{billing === 'yearly' ? (plan.priceYearlyPerMonth || plan.priceMonthly) : plan.priceMonthly}</span>
                    <span className="text-muted-foreground">{plan.periodLabel}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature: string, featureIndex: number) => (
                      <li key={featureIndex} className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-success mr-2 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/register">
                    <Button 
                      className="w-full" 
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                    >
                      Start Free Trial
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Businesses Section */}
      {featured.length > 0 && (
        <section className="py-20 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-4xl font-bold text-foreground mb-2">Featured Businesses</h2>
                <p className="text-muted-foreground">Explore salons using SalonSync</p>
              </div>
              <Link to="/businesses">
                <Button variant="outline">View All</Button>
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((b) => (
                <Card key={b.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt={b.name} className="w-8 h-8 rounded" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-primary/10" />
                      )}
                      <CardTitle className="text-lg">{b.name}</CardTitle>
                    </div>
                    {b.category && <CardDescription>{b.category}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{[b.city, b.country].filter(Boolean).join(', ')}</span>
                      </div>
                      {b.rating != null && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span>{b.rating.toFixed(1)} ({b.review_count ?? 0})</span>
                        </div>
                      )}
                    </div>
                    {b.website_url && (
                      <Link to={b.website_url} target="_blank">
                        <Button variant="outline" size="sm" className="mt-4 w-full">Visit</Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Transform Your Salon?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of salon owners who have streamlined their operations with SalonSync.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
                Start Your Free Trial
              </Button>
            </Link>
            <Link to="/register">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                Schedule Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know about getting started.</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Is there a free trial?</AccordionTrigger>
              <AccordionContent>
                Yes, all plans come with a 14-day free trial. No credit card required.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Can I switch plans later?</AccordionTrigger>
              <AccordionContent>
                Absolutely. You can upgrade or downgrade anytime from your billing settings.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Do you offer support?</AccordionTrigger>
              <AccordionContent>
                We provide email support on all plans and priority support on higher tiers.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">SalonSync</span>
              </div>
              <p className="text-muted-foreground">
                The complete salon management solution for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">System Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 SalonSync. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;