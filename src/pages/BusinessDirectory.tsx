import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MapPin, Search } from 'lucide-react';

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
}

export default function BusinessDirectory() {
  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('business_listings')
        .select('id, name, slug, description, category, city, country, logo_url, website_url, rating, review_count, is_featured')
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('name', { ascending: true });
      if (!error && data) setListings(data as unknown as BusinessListing[]);
      setLoading(false);
    };
    fetchListings();
  }, []);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      const matchesQuery = query
        ? (l.name?.toLowerCase().includes(query.toLowerCase()) ||
           l.description?.toLowerCase().includes(query.toLowerCase()) ||
           l.city?.toLowerCase().includes(query.toLowerCase()) ||
           l.country?.toLowerCase().includes(query.toLowerCase()))
        : true;
      const matchesCategory = categoryFilter ? l.category === categoryFilter : true;
      const matchesLocation = locationFilter
        ? `${l.city ?? ''}, ${l.country ?? ''}`.toLowerCase().includes(locationFilter.toLowerCase())
        : true;
      return matchesQuery && matchesCategory && matchesLocation;
    });
  }, [listings, query, categoryFilter, locationFilter]);

  const uniqueCategories = useMemo(() => Array.from(new Set(listings.map(l => l.category).filter(Boolean))) as string[], [listings]);

  return (
    <div className="min-h-screen bg-background">
      <section className="py-16 px-4 border-b bg-card/30 backdrop-blur">
        <div className="w-full">
          <h1 className="text-4xl font-bold mb-2">Business Directory</h1>
          <p className="text-muted-foreground">Discover salons and spas powered by our platform.</p>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr,200px,200px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name, service, or location" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="border rounded-md px-3 py-2 bg-background" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c!}>{c}</option>
              ))}
            </select>
            <Input placeholder="Filter by location (e.g., New York)" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="w-full">
          {loading ? (
            <div className="text-center text-muted-foreground">Loading listings...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground">No businesses found.</div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((b) => (
                <Card key={b.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-xl flex items-center gap-2">
                        {b.logo_url ? (
                          <img src={b.logo_url} alt={b.name} className="w-8 h-8 rounded" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-primary/10" />
                        )}
                        {b.name}
                      </CardTitle>
                      {b.is_featured && <Badge>Featured</Badge>}
                    </div>
                    {b.category && <CardDescription>{b.category}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    {b.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{b.description}</p>
                    )}
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
                      <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                        <a href={b.website_url} target="_blank" rel="noreferrer">Visit Website</a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}