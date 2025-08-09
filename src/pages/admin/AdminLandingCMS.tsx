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

interface LandingSettings {
  id: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  highlights: string[] | null;
  pricing_copy: string | null;
  cta_primary_text: string | null;
  cta_secondary_text: string | null;
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

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only super admins can access the landing CMS.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    const payload = {
      hero_title: settings.hero_title ?? null,
      hero_subtitle: settings.hero_subtitle ?? null,
      highlights: (settings.highlights ?? []) as any,
      pricing_copy: settings.pricing_copy ?? null,
      cta_primary_text: settings.cta_primary_text ?? null,
      cta_secondary_text: settings.cta_secondary_text ?? null,
      updated_by: user?.id ?? null,
    };

    let res;
    if (settings.id) {
      res = await supabase.from('landing_settings').update(payload).eq('id', settings.id).select().single();
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
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Landing CMS</h1>
        <p className="text-muted-foreground">Manage landing page content and business listings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Landing Content</CardTitle>
          <CardDescription>Update hero text, highlights, and CTAs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Hero Title</Label>
              <Input value={settings?.hero_title ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), hero_title: e.target.value }))} />
            </div>
            <div>
              <Label>Hero Subtitle</Label>
              <Input value={settings?.hero_subtitle ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), hero_subtitle: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Highlights (comma separated)</Label>
            <Input value={(settings?.highlights ?? []).join(', ')} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), highlights: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Primary CTA Text</Label>
              <Input value={settings?.cta_primary_text ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_primary_text: e.target.value }))} />
            </div>
            <div>
              <Label>Secondary CTA Text</Label>
              <Input value={settings?.cta_secondary_text ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), cta_secondary_text: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Pricing Copy</Label>
            <Textarea value={settings?.pricing_copy ?? ''} onChange={(e) => setSettings((s) => ({ ...(s || ({} as any)), pricing_copy: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Saving...' : 'Save Settings'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Business Listings</CardTitle>
              <CardDescription>Curate public directory content</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
              <Button onClick={openNew}>New Listing</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingListings ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredListings.map((l) => (
                <div key={l.id} className="border rounded-lg p-4">
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}