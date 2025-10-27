import { useState, useEffect, useCallback } from "react";
import { BarChart2 } from "lucide-react"; // Use correct icon
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react"; // Import Download
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format, subDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter // Import DialogFooter
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

// Interface for Aggregated Stats
interface SmtpStats {
  range?: string;
  requests?: number;
  delivered?: number;
  hardBounces?: number;
  softBounces?: number;
  clicks?: number;
  uniqueClicks?: number;
  opens?: number;
  uniqueOpens?: number;
  spamReports?: number;
  blocked?: number;
  invalid?: number;
  unsubscribed?: number;
  loadedByProxy?: number;
  deferred?: number;
  error?: number;
}

// Interface for Individual Event
interface SmtpEvent {
  email: string;
  date: string;
  subject?: string;
  messageId: string;
  event: string;
  tag?: string;
  ip?: string;
  from?: string;
  templateId?: number;
  reason?: string;
  link?: string;
}

// *** UPDATED: Mapping only for TOTALS (to avoid confusion) ***
const statToEventMap: Partial<Record<keyof SmtpStats, string>> = {
    delivered: 'delivered',
    hardBounces: 'hardBounces',
    softBounces: 'softBounces',
    clicks: 'clicks',       // Clicks (Total) maps to 'clicks'
    opens: 'opened',      // Opens (Total) maps to 'opened'
    spamReports: 'spam',
    blocked: 'blocked',
    invalid: 'invalid',
    unsubscribed: 'unsubscribed',
    deferred: 'deferred',
    error: 'error'
};

// *** UPDATED: Non-clickable stats now include 'unique' keys ***
const nonClickableStats: Array<keyof SmtpStats> = [
    'requests',
    'range',
    'loadedByProxy',
    'uniqueOpens',   // Make unique opens non-clickable
    'uniqueClicks'  // Make unique clicks non-clickable
];

const EVENTS_PAGE_LIMIT = 50;

export default function EmailStatistics() {
  const { activeAccount } = useAccount();
  const [stats, setStats] = useState<SmtpStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  // State for event modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [events, setEvents] = useState<SmtpEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [modalPageOffset, setModalPageOffset] = useState(0);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [currentEventType, setCurrentEventType] = useState<string | null>(null);

  const formatDateForAPI = (date: Date | undefined): string | undefined => {
    return date ? format(date, "yyyy-MM-dd") : undefined;
  };

  // Fetch Aggregated Stats (Callback)
  const fetchAggregatedStats = useCallback(async (showToast = false) => {
      if (!activeAccount?.apiKey || activeAccount.status !== 'connected') {
        setStats(null); setLoadingStats(false); setLastFetched(null); return;
      }
      setLoadingStats(true);
      setStats(null);
      try {
          const body: { apiKey: string, startDate?: string, endDate?: string } = {
              apiKey: activeAccount.apiKey
          };
          if (dateRange?.from && dateRange?.to) {
              body.startDate = formatDateForAPI(dateRange.from);
              body.endDate = formatDateForAPI(dateRange.to);
          } else {
             console.log("No date range selected, using Brevo default.");
          }

          const response = await fetch('/api/brevo/smtp-stats/aggregated', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!response.ok) {
              let errorMsg = `Error ${response.status}`;
              try { const errData = await response.json(); errorMsg = errData?.details?.message || errData?.error || errorMsg } catch (e) {}
              throw new Error(errorMsg);
           }
          const data: SmtpStats = await response.json();
          setStats(data);
          setLastFetched(new Date());
          if (showToast) toast({ title: "Stats Refreshed" });
      } catch (error: any) {
         console.error("Error fetching aggregated stats:", error);
         toast({ title: "Error", description: `Could not fetch stats: ${error.message}`, variant: "destructive" });
         setStats(null);
       }
      finally { setLoadingStats(false); }
  }, [activeAccount, dateRange]);

  // Fetch Event Details (Callback)
  const fetchEventDetails = useCallback(async (eventType: string, offset: number = 0, append: boolean = false) => {
      if (!activeAccount?.apiKey || activeAccount.status !== 'connected' || !eventType) return;
      setLoadingEvents(true);
      setCurrentEventType(eventType);

      try {
          const body: any = {
              apiKey: activeAccount.apiKey,
              event: eventType,
              limit: EVENTS_PAGE_LIMIT,
              offset: offset,
              sort: 'desc'
          };
          if (dateRange?.from && dateRange?.to) {
              body.startDate = formatDateForAPI(dateRange.from);
              body.endDate = formatDateForAPI(dateRange.to);
          }

          const response = await fetch('/api/brevo/smtp-stats/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
           if (!response.ok) {
              let errorMsg = `Error ${response.status}`;
              try { const errData = await response.json(); errorMsg = errData?.details?.message || errData?.error || errorMsg } catch (e) {}
              throw new Error(errorMsg);
           }
          const data: SmtpEvent[] = await response.json();

          setEvents(prev => append ? [...prev, ...data] : data);
          setHasMoreEvents(data.length === EVENTS_PAGE_LIMIT);
          setModalPageOffset(offset);

      } catch (error: any) {
          console.error(`Error fetching ${eventType} events:`, error);
          toast({ title: "Error", description: `Could not fetch ${eventType} events: ${error.message}`, variant: "destructive" });
          if (!append) setEvents([]);
          setHasMoreEvents(false);
      }
      finally { setLoadingEvents(false); }
  }, [activeAccount, dateRange]);

  // Initial fetch useEffect
  useEffect(() => {
    fetchAggregatedStats(false);
  }, [fetchAggregatedStats]);

  // Handle clicking a stat number
  const handleStatClick = (statKey: keyof SmtpStats | null) => {
      // Check if clickable (key exists, not in nonClickable list, value > 0, maps to an event)
      if (!statKey || nonClickableStats.includes(statKey) || !stats || stats[statKey] === undefined || stats[statKey] === 0) return;
      const eventType = statToEventMap[statKey];
      if (!eventType) return;

      // Generate human-readable title
      const title = statKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      setModalTitle(`${title} Events (${stats[statKey]?.toLocaleString()})`);
      
      setEvents([]);
      setModalPageOffset(0);
      setHasMoreEvents(true);
      setIsModalOpen(true);
      fetchEventDetails(eventType, 0, false); // Fetch first page
  };

  // Load more events
  const loadMoreEvents = () => {
      if (currentEventType && hasMoreEvents && !loadingEvents) {
          const nextOffset = modalPageOffset + EVENTS_PAGE_LIMIT;
          fetchEventDetails(currentEventType, nextOffset, true);
      }
  };

  // Handle Export Emails
   const handleExportEmails = () => {
       if (events.length === 0) {
           toast({ title: "No emails to export", description: "The current event list is empty.", variant: "destructive"});
           return;
       }
       const emails = events.map(event => event.email);
       const uniqueEmails = Array.from(new Set(emails));
       const fileContent = uniqueEmails.join('\n');
       const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
       const link = document.createElement('a');
       const url = URL.createObjectURL(blob);
       link.href = url;
       const dateString = format(new Date(), 'yyyyMMdd');
       const eventTypeString = currentEventType ? currentEventType.toLowerCase().replace(/\s+/g, '_') : 'events';
       link.download = `brevo_${eventTypeString}_emails_${dateString}.txt`;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       URL.revokeObjectURL(url);
       toast({ title: "Export Started", description: `${uniqueEmails.length} unique emails exported.`});
   };

  // StatCard Component
  const StatCard = ({ title, statKey, value, isLoading }: {
      title: string;
      statKey: keyof SmtpStats | null;
      value: number | undefined;
      isLoading: boolean;
  }) => {
      // Check if clickable
      const isClickable = !!statKey && !nonClickableStats.includes(statKey) && value !== undefined && value > 0 && !!statToEventMap[statKey];
      return (
          <Card
              className={cn( "text-center transition-shadow duration-150", isClickable && "cursor-pointer hover:shadow-md hover:border-primary/50" )}
              onClick={() => isClickable && handleStatClick(statKey)}
          >
              <CardHeader className="pb-2">
                  <CardDescription>{title}</CardDescription>
              </CardHeader>
              <CardContent>
                  {isLoading ? ( <Skeleton className="h-8 w-20 mx-auto" /> ) : (
                      <p className="text-2xl font-bold">{value !== undefined ? value.toLocaleString() : 'N/A'}</p>
                  )}
              </CardContent>
          </Card>
      );
  };

  const modalDateRangeText = `(${dateRange?.from ? format(dateRange.from, 'PP') : '?'} - ${dateRange?.to ? format(dateRange.to, 'PP') : '?'})`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-y-4 gap-x-2">
        <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            <div>
            <h1 className="text-2xl font-semibold">Transactional Email Statistics</h1>
            <p className="text-muted-foreground">Aggregated statistics for your Brevo transactional emails.</p>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} disabled={loadingStats || !activeAccount || activeAccount.status !== 'connected'} className="justify-self-start"/>
            {lastFetched && !loadingStats && ( <span className="text-xs text-muted-foreground hidden sm:inline"> Last updated: {lastFetched.toLocaleTimeString()} </span> )}
             <Button variant="outline" size="sm" onClick={() => fetchAggregatedStats(true)} disabled={loadingStats || !activeAccount || activeAccount.status !== 'connected'} aria-label="Refresh statistics">
                <RefreshCw className={cn("h-4 w-4", loadingStats && "animate-spin")} /> <span className="ml-2 hidden md:inline">Refresh</span>
            </Button>
        </div>
      </div>

      {/* Stats Display */}
      {!activeAccount || activeAccount.status !== 'connected' ? (
           <Card> <CardContent className="pt-6 text-center text-muted-foreground"> Please select a connected account to view statistics. </CardContent> </Card>
      ) : (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {/* These stats are now clickable */}
              <StatCard title="Requests" statKey="requests" value={stats?.requests} isLoading={loadingStats} />
              <StatCard title="Delivered" statKey="delivered" value={stats?.delivered} isLoading={loadingStats} />
              <StatCard title="Opens (Total)" statKey="opens" value={stats?.opens} isLoading={loadingStats} />
              <StatCard title="Clicks (Total)" statKey="clicks" value={stats?.clicks} isLoading={loadingStats} />
              <StatCard title="Hard Bounces" statKey="hardBounces" value={stats?.hardBounces} isLoading={loadingStats} />
              <StatCard title="Soft Bounces" statKey="softBounces" value={stats?.softBounces} isLoading={loadingStats} />
              <StatCard title="Unsubscribed" statKey="unsubscribed" value={stats?.unsubscribed} isLoading={loadingStats} />
              <StatCard title="Spam Reports" statKey="spamReports" value={stats?.spamReports} isLoading={loadingStats} />
              <StatCard title="Blocked" statKey="blocked" value={stats?.blocked} isLoading={loadingStats} />
              <StatCard title="Invalid Email" statKey="invalid" value={stats?.invalid} isLoading={loadingStats} />
              <StatCard title="Deferred" statKey="deferred" value={stats?.deferred} isLoading={loadingStats} />
              <StatCard title="Errors" statKey="error" value={stats?.error} isLoading={loadingStats} />
              
              {/* These stats are NOT clickable */}
              <StatCard title="Opens (Unique)" statKey="uniqueOpens" value={stats?.uniqueOpens} isLoading={loadingStats} />
              <StatCard title="Clicks (Unique)" statKey="uniqueClicks" value={stats?.uniqueClicks} isLoading={loadingStats} />
              <StatCard title="Loaded By Proxy" statKey="loadedByProxy" value={stats?.loadedByProxy} isLoading={loadingStats} />
          </div>
      )}

       {/* Event Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl flex flex-col">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>
              Showing recent events for the selected date range {modalDateRangeText}.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4 border rounded-md min-h-0">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[150px]">Reason / Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingEvents && events.length === 0 ? (
                    Array.from({ length: 10 }).map((_, i) => ( <TableRow key={`skel-evt-${i}`}> <TableCell><Skeleton className="h-4 w-4/5" /></TableCell> <TableCell><Skeleton className="h-4 w-20" /></TableCell> <TableCell><Skeleton className="h-4 w-32" /></TableCell> <TableCell><Skeleton className="h-4 w-3/5" /></TableCell> <TableCell><Skeleton className="h-4 w-full" /></TableCell> </TableRow> ))
                ) : events.length > 0 ? (
                    events.map((event, index) => (
                        <TableRow key={`${event.messageId}-${event.date}-${index}-${event.event}`}>
                            <TableCell className="font-medium truncate max-w-[200px]" title={event.email}>{event.email}</TableCell>
                            <TableCell>{event.event}</TableCell>
                            <TableCell>{format(new Date(event.date), 'PPpp')}</TableCell>
                            <TableCell className="truncate max-w-[200px]" title={event.subject}>{event.subject || '-'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]" title={event.reason || event.link}>
                               {event.event === 'clicks' && event.link ? ( <a href={event.link} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">{event.link}</a> ) : (event.reason || '-')}
                            </TableCell>
                        </TableRow>
                    ))
                ) : ( !loadingEvents && ( <TableRow> <TableCell colSpan={5} className="text-center h-24 text-muted-foreground"> No events found for this type in the selected date range. </TableCell> </TableRow> ) )}
                {loadingEvents && events.length > 0 && ( <TableRow> <TableCell colSpan={5} className="text-center py-4 text-muted-foreground"> <RefreshCw className="h-4 w-4 mr-2 inline animate-spin" /> Loading more events... </TableCell> </TableRow> )}
              </TableBody>
            </Table>
             {hasMoreEvents && !loadingEvents && events.length > 0 && (
                <div className="text-center pt-4 sticky bottom-0 bg-background py-2 border-t">
                    <Button variant="outline" onClick={loadMoreEvents} disabled={loadingEvents}> Load More </Button>
                </div>
            )}
            </ScrollArea>
             <DialogFooter className="pt-4 border-t">
                <Button
                    variant="outline"
                    onClick={handleExportEmails}
                    disabled={loadingEvents || events.length === 0}
                >
                    <Download className="mr-2 h-4 w-4" />
                    Export Unique Emails
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}