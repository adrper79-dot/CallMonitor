'use client'

/**
 * SSO Configuration Component
 * 
 * Phase 2: Enterprise Readiness
 * Allows organization owners to configure SSO/SAML providers
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Shield,
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Users,
  Settings,
  Lock
} from 'lucide-react'
import { logger } from '@/lib/logger'

interface SSOConfig {
  id: string
  provider_type: 'saml' | 'oidc' | 'azure_ad' | 'okta' | 'google_workspace'
  provider_name: string
  is_enabled: boolean
  verified_domains: string[]
  require_sso: boolean
  auto_provision_users: boolean
  default_role: string
  last_login_at?: string
  login_count: number
}

interface SSOConfigurationProps {
  organizationId: string
  isOwner: boolean
  planType: 'free' | 'starter' | 'professional' | 'business' | 'enterprise'
}

const PROVIDER_OPTIONS = [
  { value: 'okta', label: 'Okta (SAML)', icon: '🔐' },
  { value: 'azure_ad', label: 'Microsoft Azure AD', icon: '🔷' },
  { value: 'google_workspace', label: 'Google Workspace', icon: '🔴' },
  { value: 'saml', label: 'Custom SAML 2.0', icon: '🔒' },
  { value: 'oidc', label: 'Custom OIDC', icon: '🔑' },
]

export default function SSOConfiguration({ organizationId, isOwner, planType }: SSOConfigurationProps) {
  const [configs, setConfigs] = useState<SSOConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [copiedMetadata, setCopiedMetadata] = useState(false)

  // Form state for new/edit config
  const [formData, setFormData] = useState({
    provider_name: '',
    // SAML fields
    saml_entity_id: '',
    saml_sso_url: '',
    saml_slo_url: '',
    saml_certificate: '',
    // OIDC fields
    oidc_client_id: '',
    oidc_client_secret: '',
    oidc_issuer_url: '',
    // Common fields
    verified_domains: '',
    require_sso: false,
    auto_provision_users: true,
    default_role: 'member',
  })

  // Check if SSO is available for the plan
  const ssoAvailable = ['business', 'enterprise'].includes(planType)

  const fetchConfigs = useCallback(async () => {
    if (!ssoAvailable) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/auth/sso?orgId=${organizationId}`, {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setConfigs(data.configs || [])
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to load SSO configurations')
      }
    } catch (err) {
      logger.error('Failed to fetch SSO configs', err, { organizationId })
      setError('Failed to load SSO configurations')
    } finally {
      setLoading(false)
    }
  }, [organizationId, ssoAvailable])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  const handleSaveConfig = async () => {
    if (!selectedProvider) return

    setSaving(true)
    setError(null)

    try {
      const config: any = {
        provider_type: selectedProvider,
        provider_name: formData.provider_name,
        verified_domains: formData.verified_domains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean),
        require_sso: formData.require_sso,
        auto_provision_users: formData.auto_provision_users,
        default_role: formData.default_role,
        is_enabled: true,
      }

      // Add provider-specific fields
      if (['saml', 'okta'].includes(selectedProvider)) {
        config.saml_entity_id = formData.saml_entity_id
        config.saml_sso_url = formData.saml_sso_url
        config.saml_slo_url = formData.saml_slo_url || null
        config.saml_certificate = formData.saml_certificate
      } else {
        config.oidc_client_id = formData.oidc_client_id
        config.oidc_client_secret_encrypted = formData.oidc_client_secret
        config.oidc_issuer_url = formData.oidc_issuer_url
      }

      const res = await fetch('/api/auth/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orgId: organizationId, config })
      })

      if (res.ok) {
        setShowAddDialog(false)
        resetForm()
        await fetchConfigs()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save SSO configuration')
      }
    } catch (err) {
      logger.error('Failed to save SSO config', err, { organizationId })
      setError('Failed to save SSO configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this SSO configuration? Users will need to sign in with email/password.')) {
      return
    }

    try {
      const res = await fetch(`/api/auth/sso?configId=${configId}&orgId=${organizationId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        await fetchConfigs()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete SSO configuration')
      }
    } catch (err) {
      logger.error('Failed to delete SSO config', err, { configId })
      setError('Failed to delete SSO configuration')
    }
  }

  const resetForm = () => {
    setFormData({
      provider_name: '',
      saml_entity_id: '',
      saml_sso_url: '',
      saml_slo_url: '',
      saml_certificate: '',
      oidc_client_id: '',
      oidc_client_secret: '',
      oidc_issuer_url: '',
      verified_domains: '',
      require_sso: false,
      auto_provision_users: true,
      default_role: 'member',
    })
    setSelectedProvider('')
  }

  const copyMetadataUrl = () => {
    const url = `${window.location.origin}/api/auth/sso?action=metadata`
    navigator.clipboard.writeText(url)
    setCopiedMetadata(true)
    setTimeout(() => setCopiedMetadata(false), 2000)
  }

  // Plan upgrade prompt
  if (!ssoAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Single Sign-On (SSO)
          </CardTitle>
          <CardDescription>
            Enterprise-grade authentication with SAML and OIDC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              SSO is available on Business and Enterprise plans. 
              <a href="/pricing" className="ml-1 underline font-medium">
                Upgrade your plan
              </a>
              {' '}to enable SSO with Okta, Azure AD, Google Workspace, and custom providers.
            </AlertDescription>
          </Alert>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Supported Providers</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>🔐 Okta (SAML 2.0)</li>
                <li>🔷 Microsoft Azure AD</li>
                <li>🔴 Google Workspace</li>
                <li>🔒 Custom SAML 2.0</li>
                <li>🔑 Custom OIDC</li>
              </ul>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Enterprise Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Automatic user provisioning</li>
                <li>✓ Group-based role mapping</li>
                <li>✓ SSO-only enforcement</li>
                <li>✓ Login audit trail</li>
                <li>✓ Domain verification</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Not owner - read-only view
  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Single Sign-On (SSO)
          </CardTitle>
          <CardDescription>
            Only organization owners can configure SSO
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : configs.length > 0 ? (
            <div className="space-y-4">
              {configs.map((config) => (
                <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={config.is_enabled ? 'default' : 'secondary'}>
                      {config.provider_type.toUpperCase()}
                    </Badge>
                    <span className="font-medium">{config.provider_name}</span>
                  </div>
                  {config.is_enabled && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No SSO configured for this organization.</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Single Sign-On (SSO)
            </CardTitle>
            <CardDescription>
              Configure SAML or OIDC authentication for your organization
            </CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Add SSO Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configure SSO Provider</DialogTitle>
                <DialogDescription>
                  Set up single sign-on for your organization
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label>SSO Provider</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          <span className="flex items-center gap-2">
                            <span>{provider.icon}</span>
                            <span>{provider.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProvider && (
                  <>
                    {/* Provider Name */}
                    <div className="space-y-2">
                      <Label htmlFor="provider_name">Display Name</Label>
                      <Input
                        id="provider_name"
                        placeholder="e.g., Corporate Okta"
                        value={formData.provider_name}
                        onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                      />
                    </div>

                    <Tabs defaultValue="config">
                      <TabsList>
                        <TabsTrigger value="config">Configuration</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                      </TabsList>

                      <TabsContent value="config" className="space-y-4 mt-4">
                        {/* SAML Configuration */}
                        {['saml', 'okta'].includes(selectedProvider) && (
                          <>
                            <Alert>
                              <Key className="h-4 w-4" />
                              <AlertDescription>
                                <strong>SP Metadata URL:</strong>{' '}
                                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                  {typeof window !== 'undefined' && `${window.location.origin}/api/auth/sso?action=metadata`}
                                </code>
                                <Button variant="ghost" size="sm" className="ml-2 h-6" onClick={copyMetadataUrl}>
                                  {copiedMetadata ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                              <Label htmlFor="saml_entity_id">Identity Provider Entity ID</Label>
                              <Input
                                id="saml_entity_id"
                                placeholder="https://your-idp.com/saml/metadata"
                                value={formData.saml_entity_id}
                                onChange={(e) => setFormData({ ...formData, saml_entity_id: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="saml_sso_url">SSO Login URL</Label>
                              <Input
                                id="saml_sso_url"
                                placeholder="https://your-idp.com/saml/sso"
                                value={formData.saml_sso_url}
                                onChange={(e) => setFormData({ ...formData, saml_sso_url: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="saml_slo_url">Single Logout URL (Optional)</Label>
                              <Input
                                id="saml_slo_url"
                                placeholder="https://your-idp.com/saml/slo"
                                value={formData.saml_slo_url}
                                onChange={(e) => setFormData({ ...formData, saml_slo_url: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="saml_certificate">X.509 Certificate (PEM)</Label>
                              <Textarea
                                id="saml_certificate"
                                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                                rows={6}
                                value={formData.saml_certificate}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, saml_certificate: e.target.value })}
                              />
                            </div>
                          </>
                        )}

                        {/* OIDC Configuration */}
                        {['oidc', 'azure_ad', 'google_workspace'].includes(selectedProvider) && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="oidc_issuer_url">Issuer URL</Label>
                              <Input
                                id="oidc_issuer_url"
                                placeholder={
                                  selectedProvider === 'azure_ad'
                                    ? 'https://login.microsoftonline.com/{tenant-id}/v2.0'
                                    : selectedProvider === 'google_workspace'
                                    ? 'https://accounts.google.com'
                                    : 'https://your-idp.com'
                                }
                                value={formData.oidc_issuer_url}
                                onChange={(e) => setFormData({ ...formData, oidc_issuer_url: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="oidc_client_id">Client ID</Label>
                              <Input
                                id="oidc_client_id"
                                placeholder="Your application client ID"
                                value={formData.oidc_client_id}
                                onChange={(e) => setFormData({ ...formData, oidc_client_id: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="oidc_client_secret">Client Secret</Label>
                              <Input
                                id="oidc_client_secret"
                                type="password"
                                placeholder="Your application client secret"
                                value={formData.oidc_client_secret}
                                onChange={(e) => setFormData({ ...formData, oidc_client_secret: e.target.value })}
                              />
                            </div>

                            <Alert>
                              <ExternalLink className="h-4 w-4" />
                              <AlertDescription>
                                <strong>Redirect URI:</strong>{' '}
                                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                  {typeof window !== 'undefined' && `${window.location.origin}/api/auth/sso/callback`}
                                </code>
                              </AlertDescription>
                            </Alert>
                          </>
                        )}
                      </TabsContent>

                      <TabsContent value="settings" className="space-y-4 mt-4">
                        {/* Verified Domains */}
                        <div className="space-y-2">
                          <Label htmlFor="verified_domains">Verified Email Domains</Label>
                          <Input
                            id="verified_domains"
                            placeholder="company.com, subsidiary.com"
                            value={formData.verified_domains}
                            onChange={(e) => setFormData({ ...formData, verified_domains: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Comma-separated list of email domains that will use this SSO provider
                          </p>
                        </div>

                        {/* Auto Provision Users */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Auto-provision Users</Label>
                            <p className="text-xs text-muted-foreground">
                              Automatically create accounts for new SSO users
                            </p>
                          </div>
                          <Switch
                            checked={formData.auto_provision_users}
                            onCheckedChange={(checked) => setFormData({ ...formData, auto_provision_users: checked })}
                          />
                        </div>

                        {/* Default Role */}
                        {formData.auto_provision_users && (
                          <div className="space-y-2">
                            <Label>Default Role for New Users</Label>
                            <Select
                              value={formData.default_role}
                              onValueChange={(value) => setFormData({ ...formData, default_role: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Require SSO */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="flex items-center gap-2">
                              <Lock className="h-4 w-4" />
                              Require SSO Login
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Block password login for users with verified domains
                            </p>
                          </div>
                          <Switch
                            checked={formData.require_sso}
                            onCheckedChange={(checked) => setFormData({ ...formData, require_sso: checked })}
                          />
                        </div>
                      </TabsContent>
                    </Tabs>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveConfig} disabled={saving || !selectedProvider || !formData.provider_name}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No SSO Provider Configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set up single sign-on to allow team members to log in with their corporate credentials
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {configs.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    {PROVIDER_OPTIONS.find(p => p.value === config.provider_type)?.icon || '🔐'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{config.provider_name}</span>
                      <Badge variant={config.is_enabled ? 'default' : 'secondary'}>
                        {config.is_enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      {config.require_sso && (
                        <Badge variant="info">
                          <Lock className="h-3 w-3 mr-1" />
                          Required
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {config.login_count} logins
                      </span>
                      <span>
                        Domains: {config.verified_domains.join(', ') || 'None'}
                      </span>
                      {config.last_login_at && (
                        <span>
                          Last login: {new Date(config.last_login_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteConfig(config.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
