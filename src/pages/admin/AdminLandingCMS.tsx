import { useEffect, useMemo, useState } from 'react';
import { useSaas } from '@/lib/saas';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import SuperAdminLayout from '@/components/layout/SuperAdminLayout';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LandingSettings {
  id: string;
  brand_name: string | null;
  brand_logo_url: string | null;
  nav_links: { label: string; href: string }[] | null;
  hero_badge_text: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  highlights: string[] | null;
  partner_logos: { name?: string | null; logo_url?: string | null }[] | null;
  features_title: string | null;
  features_subtitle: string | null;
  features: { icon?: string | null; title: string; description?: string | null }[] | null;
  extra_features: { icon?: string | null; title: string; description?: string | null }[] | null;
  pricing_title: string | null;
  pricing_copy: string | null;
  billing_monthly_label: string | null;
  billing_yearly_label: string | null;
  plan_cta_label: string | null;
  most_popular_badge_text: string | null;
  featured_enabled: boolean | null;
  featured_title: string | null;
  featured_subtitle: string | null;
  cta_primary_text: string | null;
  cta_primary_link: string | null;
  cta_secondary_text: string | null;
  cta_secondary_link: string | null;
  cta_section_title: string | null;
  cta_section_subtitle: string | null;
  cta_bottom_primary_text: string | null;
  cta_bottom_primary_link: string | null;
  cta_bottom_secondary_text: string | null;
  cta_bottom_secondary_link: string | null;
  faq_title: string | null;
  faq_subtitle: string | null;
  faqs: { question: string; answer: string }[] | null;
  footer_brand_name: string | null;
  footer_description: string | null;
  footer_columns: { title: string; links: { label: string; href: string }[] }[] | null;
}

interface BusinessListing {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  website_url: string | null;
  rating: number | null;
  review_count: number | null;
  is_featured: boolean;
  is_active: boolean;
}

export default function AdminLandingCMS() {
  const { isSuperAdmin, user } = useSaas();
  const [settings, setSettings] = useState<LandingSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [search, setSearch] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<BusinessListing> | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const load = async () => {
      const s = await supabase.from('landing_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (!s.error) {
        const row = s.data as any;
        setSettings(row as LandingSettings);
      }
      const l = await supabase
        .from('business_listings')
        .select('id, name, slug, description, category, city, country, logo_url, website_url, rating, review_count, is_featured, is_active')
        .order('is_featured', { ascending: false })
        .order('name', { ascending: true });
      if (!l.error && l.data) setListings(l.data as unknown as BusinessListing[]);
      setLoadingListings(false);
    };
    load();
  }, [isSuperAdmin]);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    const payload = {
      brand_name: settings.brand_name ?? null,
      brand_logo_url: settings.brand_logo_url ?? null,
      nav_links: (settings.nav_links ?? []) as any,
      hero_badge_text: settings.hero_badge_text ?? null,
      hero_title: settings.hero_title ?? null,
      hero_subtitle: settings.hero_subtitle ?? null,
      hero_image_url: settings.hero_image_url ?? null,
      highlights: (settings.highlights ?? []) as any,
      partner_logos: (settings.partner_logos ?? []) as any,
      features_title: settings.features_title ?? null,
      features_subtitle: settings.features_subtitle ?? null,
      features: (settings.features ?? []) as any,
      extra_features: (settings.extra_features ?? []) as any,
      pricing_title: settings.pricing_title ?? null,
      pricing_copy: settings.pricing_copy ?? null,
      billing_monthly_label: settings.billing_monthly_label ?? null,
      billing_yearly_label: settings.billing_yearly_label ?? null,
      plan_cta_label: settings.plan_cta_label ?? null,
      most_popular_badge_text: settings.most_popular_badge_text ?? null,
      featured_enabled: settings.featured_enabled ?? true,
      featured_title: settings.featured_title ?? null,
      featured_subtitle: settings.featured_subtitle ?? null,
      cta_primary_text: settings.cta_primary_text ?? null,
      cta_primary_link: settings.cta_primary_link ?? null,
      cta_secondary_text: settings.cta_secondary_text ?? null,
      cta_secondary_link: settings.cta_secondary_link ?? null,
      cta_section_title: settings.cta_section_title ?? null,
      cta_section_subtitle: settings.cta_section_subtitle ?? null,
      cta_bottom_primary_text: settings.cta_bottom_primary_text ?? null,
      cta_bottom_primary_link: settings.cta_bottom_primary_link ?? null,
      cta_bottom_secondary_text: settings.cta_bottom_secondary_text ?? null,
      cta_bottom_secondary_link: settings.cta_bottom_secondary_link ?? null,
      faq_title: settings.faq_title ?? null,
      faq_subtitle: settings.faq_subtitle ?? null,
      faqs: (settings.faqs ?? []) as any,
      footer_brand_name: settings.footer_brand_name ?? null,
      footer_description: settings.footer_description ?? null,
      footer_columns: (settings.footer_columns ?? []) as any,
      updated_by: user?.id ?? null,
    } as any;

    let res;
    if ((settings as any).id) {
      res = await supabase.from('landing_settings').update(payload).eq('id', (settings as any).id).select().single();
    } else {
      res = await supabase.from('landing_settings').insert(payload).select().single();
    }

    if (res.error) {
      toast.error('Failed to save settings');
    } else {
      setSettings(res.data as any);
      toast.success('Settings saved');
    }
    setSavingSettings(false);
  };

  const filteredListings = useMemo(() => {
    return listings.filter(l =>
      !search || l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.country ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }, [listings, search]);

  const openNew = () => {
    setEditing({ name: '', description: '', category: '', city: '', country: '', logo_url: '', website_url: '', rating: null, review_count: 0, is_featured: false, is_active: true });
    setEditModalOpen(true);
  };

  const openEdit = (l: BusinessListing) => {
    setEditing({ ...l });
    setEditModalOpen(true);
  };

  const saveListing = async () => {
    if (!editing || !editing.name) {
      toast.error('Name is required');
      return;
    }
    const payload: any = {
      name: editing.name,
      description: editing.description ?? null,
      category: editing.category ?? null,
      city: editing.city ?? null,
      country: editing.country ?? null,
      logo_url: editing.logo_url ?? null,
      website_url: editing.website_url ?? null,
      rating: editing.rating ?? null,
      review_count: editing.review_count ?? 0,
      is_featured: !!editing.is_featured,
      is_active: editing.is_active !== false,
      updated_by: user?.id ?? null,
    };

    let res;
    if (editing.id) {
      res = await supabase.from('business_listings').update(payload).eq('id', editing.id).select().single();
    } else {
      res = await supabase.from('business_listings').insert(payload).select().single();
    }

    if (res.error) {
      toast.error('Failed to save listing');
    } else {
      const updated = res.data as BusinessListing;
      setListings((prev) => {
        const exists = prev.some(p => p.id === updated.id);
        return exists ? prev.map(p => (p.id === updated.id ? updated : p)) : [updated, ...prev];
      });
      toast.success('Listing saved');
      setEditModalOpen(false);
      setEditing(null);
    }
  };

  const deleteListing = async (id: string) => {
    if (!confirm('Delete this listing?')) return;
    const res = await supabase.from('business_listings').delete().eq('id', id);
    if (res.error) {
      toast.error('Failed to delete listing');
    } else {
      setListings(prev => prev.filter(p => p.id !== id));
      toast.success('Listing deleted');
    }
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {!isSuperAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>Only super admins can access the landing CMS.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Landing CMS</h1>
              <p className="text-gray-500 mt-1">Manage landing page content and business listings</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Landing Content</CardTitle>
                  <CardDescription>Update branding, hero, features, pricing, FAQs, and CTAs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div>
                      <Label>Brand Name</Label>
                      <Input value={settings?.brand_name ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), brand_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Brand Logo URL</Label>
                      <Input value={settings?.brand_logo_url ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), brand_logo_url: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <Label>Nav Links (JSON array)</Label>
                    <Textarea
                      value={JSON.stringify(settings?.nav_links ?? [], null, 2)}
                      onChange={(e) => {
                        try {
                          const val = JSON.parse(e.target.value);
                          setSettings((s) => ({ ...(s || ({} as any)), nav_links: val }));
                        } catch {}
                      }}
                    />
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <Label>Hero Badge Text</Label>
                      <Input value={settings?.hero_badge_text ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), hero_badge_text: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Hero Title</Label>
                      <Input value={settings?.hero_title ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), hero_title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Hero Subtitle</Label>
                      <Input value={settings?.hero_subtitle ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), hero_subtitle: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Hero Image URL</Label>
                      <Input value={settings?.hero_image_url ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), hero_image_url: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <Label>Highlights (comma separated)</Label>
                    <Input value={(settings?.highlights ?? []).join(', ')} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), highlights: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
                  </div>

                  <div>
                    <Label>Partner Logos (JSON array)</Label>
                    <Textarea
                      value={JSON.stringify(settings?.partner_logos ?? [], null, 2)}
                      onChange={(e) => {
                        try {
                          const val = JSON.parse(e.target.value);
                          setSettings((s) => ({ ...(s || ({} as any)), partner_logos: val }));
                        } catch {}
                      }}
                    />
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <Label>Features Title</Label>
                      <Input value={settings?.features_title ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), features_title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Features Subtitle</Label>
                      <Input value={settings?.features_subtitle ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), features_subtitle: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <Label>Features (JSON array; icon slugs like calendar, users, credit-card)</Label>
                    <Textarea
                      value={JSON.stringify(settings?.features ?? [], null, 2)}
                      onChange={(e) => {
                        try {
                          const val = JSON.parse(e.target.value);
                          setSettings((s) => ({ ...(s || ({} as any)), features: val }));
                        } catch {}
                      }}
                    />
                  </div>

                  <div>
                    <Label>Extra Features (JSON array)</Label>
                    <Textarea
                      value={JSON.stringify(settings?.extra_features ?? [], null, 2)}
                      onChange={(e) => {
                        try {
                          const val = JSON.parse(e.target.value);
                          setSettings((s) => ({ ...(s || ({} as any)), extra_features: val }));
                        } catch {}
                      }}
                    />
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <Label>Pricing Title</Label>
                      <Input value={settings?.pricing_title ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), pricing_title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Pricing Copy</Label>
                      <Textarea value={settings?.pricing_copy ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), pricing_copy: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Billing Monthly Label</Label>
                      <Input value={settings?.billing_monthly_label ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), billing_monthly_label: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Billing Yearly Label</Label>
                      <Input value={settings?.billing_yearly_label ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), billing_yearly_label: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Plan CTA Label</Label>
                      <Input value={settings?.plan_cta_label ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), plan_cta_label: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Most Popular Badge</Label>
                      <Input value={settings?.most_popular_badge_text ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), most_popular_badge_text: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Featured Section Title</Label>
                      <Input value={settings?.featured_title ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), featured_title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Featured Subtitle</Label>
                      <Input value={settings?.featured_subtitle ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), featured_subtitle: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <Label>Featured Enabled</Label>
                    </div>
                    <Switch checked={settings?.featured_enabled ?? true} onCheckedChange={(v) => setSettings((s) => ({ ...(s || ({} as any)), featured_enabled: v }))} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Hero Primary CTA Text</Label>
                      <Input value={settings?.cta_primary_text ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_primary_text: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Hero Primary CTA Link</Label>
                      <Input value={settings?.cta_primary_link ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_primary_link: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Hero Secondary CTA Text</Label>
                      <Input value={settings?.cta_secondary_text ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_secondary_text: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Hero Secondary CTA Link</Label>
                      <Input value={settings?.cta_secondary_link ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_secondary_link: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <Label>CTA Section Title</Label>
                      <Input value={settings?.cta_section_title ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_section_title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>CTA Section Subtitle</Label>
                      <Input value={settings?.cta_section_subtitle ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_section_subtitle: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Bottom Primary CTA Text</Label>
                      <Input value={settings?.cta_bottom_primary_text ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_bottom_primary_text: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Bottom Primary CTA Link</Label>
                      <Input value={settings?.cta_bottom_primary_link ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_bottom_primary_link: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Bottom Secondary CTA Text</Label>
                      <Input value={settings?.cta_bottom_secondary_text ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_bottom_secondary_text: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Bottom Secondary CTA Link</Label>
                      <Input value={settings?.cta_bottom_secondary_link ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_bottom_secondary_link: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <Label>FAQ Title</Label>
                      <Input value={settings?.faq_title ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), faq_title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>FAQ Subtitle</Label>
                      <Input value={settings?.faq_subtitle ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), faq_subtitle: e.target.value }))} />
                    </div>
                    <div>
                      <Label>FAQs (JSON array)</Label>
                      <Textarea
                        value={JSON.stringify(settings?.faqs ?? [], null, 2)}
                        onChange={(e) => {
                          try {
                            const val = JSON.parse(e.target.value);
                            setSettings((s) => ({ ...(s || ({} as any)), faqs: val }));
                          } catch {}
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <Label>Footer Brand Name</Label>
                      <Input value={settings?.footer_brand_name ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), footer_brand_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Footer Description</Label>
                      <Textarea value={settings?.footer_description ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), footer_description: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Footer Columns (JSON array)</Label>
                      <Textarea
                        value={JSON.stringify(settings?.footer_columns ?? [], null, 2)}
                        onChange={(e) => {
                          try {
                            const val = JSON.parse(e.target.value);
                            setSettings((s) => ({ ...(s || ({} as any)), footer_columns: val }));
                          } catch {}
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Saving...' : 'Save Settings'}</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle>Business Listings</CardTitle>
                      <CardDescription>Curate public directory content</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto max-w-md sm:max-w-none">
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                      </div>
                      <Button onClick={openNew}>New Listing</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingListings ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-6 w-6 rounded" />
                              <Skeleton className="h-4 w-40" />
                            </div>
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-2/3" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : filteredListings.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">No listings found.</div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredListings.map((l) => (
                        <Card key={l.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {l.logo_url ? <img src={l.logo_url} className="w-6 h-6 rounded" /> : <div className="w-6 h-6 rounded bg-primary/10" />}
                                  {l.name}
                                  {!l.is_active && <Badge variant="secondary">Inactive</Badge>}
                                  {l.is_featured && <Badge>Featured</Badge>}
                                </div>
                                <div className="text-sm text-muted-foreground">{[l.category, [l.city, l.country].filter(Boolean).join(', ')].filter(Boolean).join(' • ')}</div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEdit(l)}>Edit</Button>
                                <Button variant="destructive" size="sm" onClick={() => deleteListing(l.id)}>Delete</Button>
                              </div>
                            </div>
                            {l.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{l.description}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing?.id ? 'Edit Listing' : 'New Listing'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={editing?.name ?? ''} onChange={(e) => setEditing((p) => ({ ...(p || {}), name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={editing?.description ?? ''} onChange={(e) => setEditing((p) => ({ ...(p || {}), description: e.target.value }))} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Category</Label>
                      <Input value={editing?.category ?? ''} onChange={(e) => setEditing((p) => ({ ...(p || {}), category: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Website URL</Label>
                      <Input value={editing?.website_url ?? ''} onChange={(e) => setEditing((p) => ({ ...(p || {}), website_url: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>City</Label>
                      <Input value={editing?.city ?? ''} onChange={(e) => setEditing((p) => ({ ...(p || {}), city: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Country</Label>
                      <Input value={editing?.country ?? ''} onChange={(e) => setEditing((p) => ({ ...(p || {}), country: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Logo URL</Label>
                      <Input value={editing?.logo_url ?? ''} onChange={(e) => setEditing((p) => ({ ...(p || {}), logo_url: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 items-center">
                      <div>
                        <Label>Featured</Label>
                      </div>
                      <Switch checked={!!editing?.is_featured} onCheckedChange={(v) => setEditing((p) => ({ ...(p || {}), is_featured: v }))} />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Rating</Label>
                      <Input type="number" step="0.1" min="0" max="5" value={editing?.rating ?? ''} onChange={(e) => setEditing((p) => ({ ...(p || {}), rating: e.target.value === '' ? null : Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label>Review Count</Label>
                      <Input type="number" min="0" value={editing?.review_count ?? 0} onChange={(e) => setEditing((p) => ({ ...(p || {}), review_count: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <Label>Active</Label>
                    </div>
                    <Switch checked={editing?.is_active !== false} onCheckedChange={(v) => setEditing((p) => ({ ...(p || {}), is_active: v }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                  <Button onClick={saveListing}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}