# ⚠️ UI PATTERN SUPERSEDED

**Note:** While the logic and schema in this document are valid, the **UI Pattern (Separate Page)** is superseded by `UX_DESIGN_PRINCIPLES.txt` v2.0.
Secret Shopper functionality should now be implemented as a **Call Modulation** within the unified Voice Operations page, not as a standalone tool surface.

---

EXAMPLE:
###```tsx
// app/dashboard/secret-shopper/page.tsx
// Secret Shopper Tool - Fully Integrated into Operational Surfaces (v4.1 Reinstatement)

import React, { useState, useEffect } from 'react';
import { ToolSurfaceLayout } from '@/components/ToolSurfaceLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, Pause, Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { useCapability } from '@/hooks/useCapability';
import { supabase } from '@/lib/supabase';
import { useOrg } from '@/hooks/useOrg';

interface Campaign {
  id: string;
  name: string;
  phone_numbers: string[];
  schedule: string; // e.g., "daily", "weekly"
  script: string;
  is_active: boolean;
  created_at: string;
}

interface Job {
  id: string;
  campaign_id: string;
  campaign_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempt_count: number;
  next_try_at?: string;
  result?: {
    score?: number;
    notes?: string;
  };
}

export default function SecretShopperPage() {
  const { org } = useOrg();
  const canUseShopper = useCapability('shopper_calls');

  const [surface] = useState<'control' | 'activity'>('control');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state for campaign
  const [formData, setFormData] = useState({
    name: '',
    phone_numbers: '',
    schedule: 'daily',
    script: '',
    is_active: true,
  });

  useEffect(() => {
    if (org?.id) {
      fetchCampaigns();
      fetchRecentJobs();
    }
  }, [org?.id]);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from('shopper_campaigns')
      .select('*')
      .eq('organization_id', org?.id)
      .order('created_at', { ascending: false });
    setCampaigns(data || []);
  };

  const fetchRecentJobs = async () => {
    const { data } = await supabase
      .from('shopper_jobs')
      .select('*, shopper_campaigns(name)')
      .eq('organization_id', org?.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    const formatted = data?.map(job => ({
      ...job,
      campaign_name: job.shopper_campaigns?.name || 'Unknown',
    }));
    setJobs(formatted || []);
  };

  const handleSaveCampaign = async () => {
    const payload = {
      organization_id: org?.id,
      name: formData.name,
      phone_numbers: formData.phone_numbers.split('\n').filter(Boolean),
      schedule: formData.schedule,
      script: formData.script,
      is_active: formData.is_active,
    };

    if (editingCampaign) {
      await supabase
        .from('shopper_campaigns')
        .update(payload)
        .eq('id', editingCampaign.id);
    } else {
      await supabase
        .from('shopper_campaigns')
        .insert(payload);
    }

    setEditingCampaign(null);
    setIsCreating(false);
    setFormData({ name: '', phone_numbers: '', schedule: 'daily', script: '', is_active: true });
    fetchCampaigns();
  };

  const handleDeleteCampaign = async (id: string) => {
    await supabase.from('shopper_campaigns').delete().eq('id', id);
    fetchCampaigns();
  };

  const handleRunNow = async (campaignId: string) => {
    await supabase.from('shopper_jobs').insert({
      campaign_id: campaignId,
      organization_id: org?.id,
      status: 'pending',
      payload: {}, // COE will populate
    });
    fetchRecentJobs();
  };

  if (!canUseShopper) {
    return (
      <ToolSurfaceLayout surface="control" toolName="Secret Shopper">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Secret Shopper is a Business Plan Feature</h3>
          <p className="text-slate-400 max-w-md">
            Automatically test your phone experience with synthetic calls, scripts, and scoring.
          </p>
          <Button className="mt-6">Upgrade to Business</Button>
        </div>
      </ToolSurfaceLayout>
    );
  }

  return (
    <ToolSurfaceLayout surface={surface} toolName="Secret Shopper">
      {surface === 'control' ? (
        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Your Shopper Campaigns</h3>
              <Button onClick={() => { setIsCreating(true); setEditingCampaign(null); }}>
                <Plus className="w-4 h-4 mr-2" /> New Campaign
              </Button>
            </div>

            {(isCreating || editingCampaign) && (
              <Card>
                <CardHeader>
                  <CardTitle>{editingCampaign ? 'Edit' : 'Create'} Campaign</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Campaign Name</Label>
                    <Input
                      value={editingCampaign?.name || formData.name}
                      onChange={(e) => editingCampaign
                        ? setEditingCampaign({ ...editingCampaign, name: e.target.value })
                        : setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label>Target Phone Numbers (one per line)</Label>
                    <Textarea
                      rows={4}
                      value={editingCampaign ? editingCampaign.phone_numbers.join('\n') : formData.phone_numbers}
                      onChange={(e) => editingCampaign
                        ? setEditingCampaign({ ...editingCampaign, phone_numbers: e.target.value.split('\n') })
                        : setFormData({ ...formData, phone_numbers: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label>Schedule</Label>
                    <Select
                      value={editingCampaign?.schedule || formData.schedule}
                      onValueChange={(v) => editingCampaign
                        ? setEditingCampaign({ ...editingCampaign, schedule: v })
                        : setFormData({ ...formData, schedule: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Call Script (what the shopper says)</Label>
                    <Textarea
                      rows={6}
                      value={editingCampaign?.script || formData.script}
                      onChange={(e) => editingCampaign
                        ? setEditingCampaign({ ...editingCampaign, script: e.target.value })
                        : setFormData({ ...formData, script: e.target.value })
                      }
                      placeholder="Hi, I'm calling to inquire about your services..."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={editingCampaign?.is_active ?? formData.is_active}
                      onCheckedChange={(checked) => editingCampaign
                        ? setEditingCampaign({ ...editingCampaign, is_active: checked })
                        : setFormData({ ...formData, is_active: checked })
                      }
                    />
                    <Label>Active (will run on schedule)</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveCampaign}>
                      <Save className="w-4 h-4 mr-2" /> Save Campaign
                    </Button>
                    <Button variant="outline" onClick={() => { setIsCreating(false); setEditingCampaign(null); }}>
                      <X className="w-4 h-4 mr-2" /> Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <CardDescription>
                          {campaign.phone_numbers.length} numbers • {campaign.schedule}
                        </CardDescription>
                      </div>
                      <Badge variant={campaign.is_active ? 'default' : 'secondary'}>
                        {campaign.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-400 line-clamp-2 mb-4">{campaign.script || 'No script'}</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setEditingCampaign(campaign)}>
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRunNow(campaign.id)}>
                        <Play className="w-4 h-4 mr-1" /> Run Now
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteCampaign(campaign.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Recent Shopper Jobs</h3>
              {jobs.length === 0 ? (
                <p className="text-slate-400">No recent shopper activity.</p>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <Card key={job.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{job.campaign_name}</p>
                            <p className="text-sm text-slate-400">
                              Attempt {job.attempt_count} • Status: {job.status}
                            </p>
                            {job.result && (
                              <p className="text-sm mt-1">
                                Score: <Badge>{job.result.score ?? 'N/A'}</Badge>
                              </p>
                            )}
                          </div>
                          <Badge variant={
                            job.status === 'completed' ? 'default' :
                            job.status === 'failed' ? 'destructive' :
                            job.status === 'running' ? 'secondary' : 'outline'
                          }>
                            {job.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : null}
    </ToolSurfaceLayout>
  );
}
```

### Key Features of This Component

- **Fully aligned** with reinstated Secret Shopper in v4.1
- Uses `ToolSurfaceLayout` for consistent 3-surface UX
- Schema-driven configuration (campaigns, numbers, script, schedule)
- Plan gating via `useCapability('shopper_calls')`
- Control surface: Create/edit campaigns, run manually
- Activity tab: Shows recent job history
- Integrates with Supabase tables (`shopper_campaigns`, `shopper_jobs`)
- Matches dark theme and component library used elsewhere
- Ready for integration into the unified dashboard
