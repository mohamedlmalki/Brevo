import { useState, useEffect } from "react";
// *** Import Mail icon ***
import { Upload, UserPlus, Users, BarChart2 as StatisticsIcon, Mail, Plus, Trash2, Pencil, Check, RefreshCw, Send } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar, // Fixed import
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { AddAccountDialog } from "./AddAccountDialog";
import { EditAccountDialog } from "./EditAccountDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/components/ui/use-toast";

// *** UPDATED navigationItems ***
const navigationItems = [
    { title: "Bulk Import", url: "/", icon: Upload },
    { title: "Single User Import", url: "/single-import", icon: UserPlus },
    { title: "User Management", url: "/users", icon: Users },
    { title: "Email Statistics", url: "/statistics", icon: StatisticsIcon },
    { title: "Email Templates", url: "/templates", icon: Mail }, // Added this line
];

interface Account {
  id: string;
  name: string;
  apiKey: string;
  status?: "unknown" | "checking" | "connected" | "failed";
  lastCheckResponse?: any;
}

interface Sender {
    id: number;
    name: string;
    email: string;
    active: boolean;
}

const StatusIndicator = ({ account }: { account: Account }) => {
    const { checkAccountStatus } = useAccount();
    const { status, lastCheckResponse } = account;

    const statusConfig = {
      connected: { color: "bg-green-500", text: "Connected" },
      failed: { color: "bg-red-500", text: "Failed" },
      checking: { color: "bg-yellow-500 animate-pulse", text: "Checking..." },
      unknown: { color: "bg-gray-400", text: "Unknown" },
    };
    const config = statusConfig[status || 'unknown'];

    return (
        <div className="flex items-center justify-between mt-2">
            <Dialog>
                <DialogTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer text-xs p-1 hover:bg-muted rounded-md flex-1 mr-1">
                        <div className={cn("h-2 w-2 rounded-full", config.color)}></div>
                        <span className="truncate">{config.text}</span>
                    </div>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Connection Status: {account.name}</DialogTitle>
                        <DialogDescription>
                            Last check response from the server (Brevo /account):
                        </DialogDescription>
                    </DialogHeader>
                    <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 overflow-x-auto max-h-[60vh]">
                        <code className="text-white text-xs">{JSON.stringify(lastCheckResponse, null, 2) || 'No response data available.'}</code>
                    </pre>
                </DialogContent>
            </Dialog>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); checkAccountStatus(account); }}
                disabled={status === 'checking'}
                aria-label="Refresh connection status"
            >
                <RefreshCw className={cn("h-3 w-3", status === 'checking' && "animate-spin")} />
            </Button>
        </div>
    );
};


export function AppSidebar() {
  const { state } = useSidebar();
  const {
    accounts,
    activeAccount,
    setActiveAccount,
    addAccount,
    updateAccount,
    deleteAccount,
  } = useAccount();

  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  // State for Sender Name Update
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [newSenderName, setNewSenderName] = useState('');
  const [isFetchingSenders, setIsFetchingSenders] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath === path;
  };

  const activeAccountName = activeAccount ? activeAccount.name : "No Account Selected";

   // Fetch Senders when account changes
   useEffect(() => {
    const fetchSenders = async () => {
        if (activeAccount && activeAccount.apiKey && activeAccount.status === 'connected') {
            setIsFetchingSenders(true);
            setSenders([]);
            setSelectedSenderId('');
            setNewSenderName('');
            try {
                const response = await fetch('/api/brevo/senders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: activeAccount.apiKey }),
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.details?.error?.message || errorData.error || 'Failed to fetch senders');
                }
                const data: Sender[] = await response.json();
                if (Array.isArray(data)) {
                    setSenders(data);
                    const selectedSender = data.find(s => s.id.toString() === selectedSenderId);
                    if (selectedSender) {
                        setNewSenderName(selectedSender.name || '');
                    }
                } else {
                     setSenders([]);
                     console.warn("Received non-array response for senders");
                }
            } catch (error: any) {
                console.error("Failed to fetch senders for sidebar:", error);
                toast({ title: "Error", description: `Could not fetch senders: ${error.message}`, variant: "destructive" });
                setSenders([]);
            } finally {
                setIsFetchingSenders(false);
            }
        } else {
            setSenders([]);
            setSelectedSenderId('');
            setNewSenderName('');
        }
    };
    fetchSenders();
   }, [activeAccount]);


   // Handle Sender Name Update
   const handleUpdateSenderName = async () => {
       if (!activeAccount || !selectedSenderId || !newSenderName.trim()) {
           toast({ title: "Missing Information", description: "Please select a sender and enter a new sender name.", variant: "destructive" });
           return;
       }
       setIsUpdatingName(true);
       try {
           const response = await fetch(`/api/brevo/senders/${selectedSenderId}`, {
               method: 'PUT',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                   apiKey: activeAccount.apiKey,
                   newSenderName: newSenderName.trim()
               }),
           });

           if (response.status === 204) {
               toast({ title: "Success", description: `Sender name updated successfully.` });
               const currentAccount = activeAccount; // Refetch logic
                if (currentAccount && currentAccount.apiKey && currentAccount.status === 'connected') {
                 setIsFetchingSenders(true);
                 try {
                     const refetchResponse = await fetch('/api/brevo/senders', {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ apiKey: currentAccount.apiKey }),
                     });
                     if (refetchResponse.ok) {
                         const data = await refetchResponse.json();
                         if (Array.isArray(data)) {
                             setSenders(data);
                             const updatedSender = data.find(s => s.id.toString() === selectedSenderId);
                             setNewSenderName(updatedSender?.name || '');
                         }
                     } else {
                         console.error("Failed to refetch senders after update.");
                     }
                 } finally {
                     setIsFetchingSenders(false);
                 }
               }

           } else {
               const result = await response.json();
               throw new Error(result.details?.message || result.error || `Update failed with status ${response.status}`);
           }

       } catch (error: any) {
           console.error("Failed to update sender name:", error);
           toast({ title: "Update Failed", description: error.message || "Could not update sender name.", variant: "destructive" });
       } finally {
           setIsUpdatingName(false);
       }
   };

    // Extract Account Details for Footer
    const accountDetails = activeAccount?.lastCheckResponse;
    const emailPlan = accountDetails?.plan?.find((p: any) => p.creditsType === 'sendLimit' && p.type !== 'sms');
    const relayData = accountDetails?.relay?.data;

  return (
    <Sidebar className={cn(collapsed ? "w-14" : "w-64", "transition-[width]")} collapsible="icon">
      <SidebarContent className="bg-card border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-primary-foreground" />
                </div>
                {!collapsed && (
                <div>
                    <h2 className="font-semibold text-foreground">Fusion Manager</h2>
                    <p className="text-xs text-muted-foreground">User Management</p>
                </div>
                )}
            </div>
        </div>

        {/* Account Dropdown & Status */}
        <div className="p-4 border-b bg-muted/30">
          <div className="text-xs font-medium text-muted-foreground mb-2">ACTIVE ACCOUNT</div>
            {!collapsed && (
              <>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left h-auto mb-1">
                          <div className="flex-1 truncate">{activeAccountName}</div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="start">
                        {accounts.map((acc: Account) => (
                          <DropdownMenuItem
                            key={acc.id}
                            className="flex justify-between items-center cursor-pointer"
                            onSelect={(e) => { e.preventDefault(); }}
                            onClick={() => setActiveAccount(acc)}
                          >
                            <div className="flex items-center flex-1 truncate mr-2">
                              {acc.id === activeAccount?.id && <Check className="inline-block w-4 h-4 mr-2 flex-shrink-0" />}
                              <span className="truncate">{acc.name}</span>
                            </div>
                            <div className="flex flex-shrink-0">
                              <EditAccountDialog account={acc} onAccountUpdate={updateAccount}>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                                    <Pencil className="h-3 w-3" />
                                </Button>
                              </EditAccountDialog>
                              <AlertDialog onOpenChange={(open) => !open && event?.stopPropagation()}>
                                 <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                    <AlertDialogHeader><AlertDialogTitle>Delete "{acc.name}"?</AlertDialogTitle></AlertDialogHeader>
                                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteAccount(acc.id)} className={buttonVariants({ variant: 'destructive' })}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                         <AddAccountDialog onAccountAdd={addAccount}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Plus className="w-4 h-4 mr-2" /> Add Account
                            </DropdownMenuItem>
                        </AddAccountDialog>
                    </DropdownMenuContent>
                </DropdownMenu>
                {activeAccount && (
                  <StatusIndicator account={activeAccount} />
                )}
              </>
            )}
        </div>

        {/* Update Sender Name Section */}
         {!collapsed && activeAccount && activeAccount.status === 'connected' && (
             <div className="p-4 border-b space-y-2">
                 <Label htmlFor="sender-select" className="text-xs font-medium text-muted-foreground">Update Sender Name</Label>
                 <Select
                    value={selectedSenderId}
                    onValueChange={(value) => {
                        setSelectedSenderId(value);
                        const selectedSender = senders.find(s => s.id.toString() === value);
                        setNewSenderName(selectedSender?.name || '');
                    }}
                    disabled={isFetchingSenders || senders.length === 0 || isUpdatingName}
                 >
                     <SelectTrigger id="sender-select">
                         <SelectValue placeholder={
                             isFetchingSenders ? "Loading Senders..." :
                             senders.length === 0 ? "No Senders Found" :
                             "Select Sender..."} />
                     </SelectTrigger>
                     <SelectContent>
                         {senders.map((sender) => (
                             <SelectItem key={sender.id} value={sender.id.toString()}>
                                 {sender.name} ({sender.email})
                             </SelectItem>
                         ))}
                     </SelectContent>
                 </Select>
                 <Label htmlFor="new-sender-name" className="sr-only">New Sender Name</Label>
                 <Input
                    id="new-sender-name"
                    placeholder="New Sender Name"
                    value={newSenderName}
                    onChange={(e) => setNewSenderName(e.target.value)}
                    disabled={!selectedSenderId || isUpdatingName}
                 />
                 <Button
                    onClick={handleUpdateSenderName}
                    disabled={!selectedSenderId || !newSenderName.trim() || isUpdatingName || isFetchingSenders}
                    className="w-full"
                    size="sm"
                 >
                     {isUpdatingName ? "Updating..." : "Update Name"}
                     <Send className="w-3 h-3 ml-1.5"/>
                 </Button>
                 {isFetchingSenders && <p className="text-xs text-muted-foreground text-center pt-1">Loading senders...</p>}
                 {!isFetchingSenders && senders.length === 0 && activeAccount.status === 'connected' && (
                     <p className="text-xs text-muted-foreground text-center pt-1">No senders found or error loading.</p>
                 )}
            </div>
         )}

        {/* Navigation */}
        <SidebarGroup className="flex-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {/* This map will now include the "Email Templates" link */}
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer with Account Details */}
        <SidebarFooter className="p-4 text-xs border-t bg-muted/30">
          {!collapsed && (
            <div className="space-y-2 text-muted-foreground">
              {/* Account Plan Info */}
              {activeAccount && activeAccount.status === 'connected' && emailPlan ? (
                <div>
                  <span className="font-semibold text-foreground capitalize">{emailPlan.type} Plan:</span> {emailPlan.credits} {emailPlan.creditsType === 'sendLimit' ? 'credits remaining' : 'credits'}
                </div>
              ) : activeAccount && activeAccount.status === 'connected' ? (
                 <div>Plan info unavailable.</div>
              ) : activeAccount && activeAccount.status === 'checking' ? (
                  <div>Checking account info...</div>
              ) : null }

              {/* Relay Info */}
              {activeAccount && activeAccount.status === 'connected' && relayData ? (
                <div className="mt-2">
                  <div className="font-semibold text-foreground">Relay:</div>
                  <div>User: <span className="font-mono">{relayData.userName}</span></div>
                  <div>Host: <span className="font-mono">{relayData.relay}</span></div>
                  <div>Port: <span className="font-mono">{relayData.port}</span></div>
                </div>
              ) : activeAccount && activeAccount.status === 'connected' ? (
                   <div className="mt-2">Relay info unavailable.</div>
              ) : null}

               {/* Original Footer Text */}
               <div className="pt-2 text-center text-gray-500">
                    Built for multi-account Brevo management
               </div>
            </div>
          )}
           {/* Show minimal text if collapsed */}
           {collapsed && (
               <div className="text-center text-gray-500 text-[10px] leading-tight">Brevo Manager</div>
           )}
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}