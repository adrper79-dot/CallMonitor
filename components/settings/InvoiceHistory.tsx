'use client'

/**
 * Invoice History Component
 *
 * Displays past invoices with download links.
 * RBAC: Owner/Admin only
 *
 * Features:
 * - Paginated invoice list
 * - Status badges (paid, open, draft, void)
 * - Download PDF links
 * - Amount and date formatting
 * - Empty state for no invoices
 *
 * @module components/settings/InvoiceHistory
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Loader2, Download, Receipt, ChevronLeft, ChevronRight } from 'lucide-react'
import { logger } from '@/lib/logger'
import { useApiQuery } from '@/hooks'

interface Invoice {
  id: string
  number: string
  amount_paid: number
  currency: string
  status: 'paid' | 'open' | 'draft' | 'void' | 'uncollectible'
  created: string
  hosted_invoice_url: string | null
  invoice_pdf: string | null
}

interface InvoiceHistoryProps {
  organizationId: string
  role: 'owner' | 'admin' | 'operator' | 'analyst' | 'viewer'
}

export function InvoiceHistory({ organizationId, role }: InvoiceHistoryProps) {
  const [page, setPage] = useState(1)

  const pageSize = 10
  const canView = role === 'owner' || role === 'admin'

  // Fetch invoices with useApiQuery hook
  const {
    data: invoicesData,
    loading,
    error: fetchError,
  } = useApiQuery<{ invoices: Invoice[]; hasMore: boolean }>(
    `/api/billing/invoices?orgId=${organizationId}&page=${page}&limit=${pageSize}`,
    {}
  )

  const invoices = invoicesData?.invoices || []
  const hasMore = invoicesData?.hasMore || false

  const getStatusBadge = (status: Invoice['status']) => {
    const variants = {
      paid: { label: 'Paid', variant: 'success' as const },
      open: { label: 'Open', variant: 'default' as const },
      draft: { label: 'Draft', variant: 'secondary' as const },
      void: { label: 'Void', variant: 'secondary' as const },
      uncollectible: { label: 'Uncollectible', variant: 'error' as const },
    }

    const config = variants[status]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>View and download past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to view invoices
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading && invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>View and download past invoices</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>View and download past invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fetchError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{fetchError.message}</div>
          )}

          {invoices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm font-medium">No invoices yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your invoices will appear here once you have a paid subscription
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.number || invoice.id.substring(0, 8)}
                        </TableCell>
                        <TableCell>
                          {formatDate(invoice.created, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(invoice.amount_paid, invoice.currency)}
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell className="text-right">
                          {invoice.invoice_pdf && (
                            <Button variant="ghost" size="sm" asChild>
                              <a
                                href={invoice.invoice_pdf}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {(page > 1 || hasMore) && (
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasMore || loading}
                  >
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
