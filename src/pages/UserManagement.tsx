import { useState, useEffect, useCallback } from "react";
import { Users, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button"; // Import buttonVariants
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
// Badge is not used in this version for origin, removed import
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

const PAGE_SIZE = 10; // Number of contacts per page

// Brevo List interface
interface BrevoList {
    id: number;
    name: string;
}

// Brevo Contact interface (simplified)
interface BrevoContact {
    id: number;
    email: string;
    attributes: {
        FIRSTNAME?: string;
        LASTNAME?: string;
        // Add other attributes if needed
    };
    createdAt: string; // Brevo provides creation timestamp
    // Add listIds, modifiedAt etc. if needed
}

export default function UserManagement() {
  const { activeAccount } = useAccount();
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [lists, setLists] = useState<BrevoList[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null); // List ID as string

  const [subscribers, setSubscribers] = useState<BrevoContact[]>([]); // Use BrevoContact
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSubscribersInList, setTotalSubscribersInList] = useState(0); // Total for the selected list
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Calculate total pages based on the count *in the selected list*
  const totalPages = Math.ceil(totalSubscribersInList / PAGE_SIZE);

  // Fetch contacts for a specific list and page
  const fetchSubscribers = useCallback(async (listId: string, page: number) => {
    if (!activeAccount || !listId) return;
    setIsLoadingContacts(true);
    setSelectedEmails([]); // Clear selection when fetching new page/list
    setSubscribers([]); // Clear previous subscribers
    try {
        // *** Call the new backend endpoint for list contacts ***
        const response = await fetch('/api/brevo/list-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: activeAccount.apiKey,
                listId: listId,
                page: page,
                perPage: PAGE_SIZE
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
             throw new Error(errorData.details?.message || errorData.details?.code || errorData.error || "Failed to fetch subscribers");
        }
        const data = await response.json();
        setSubscribers(data.contacts || []);
        setTotalSubscribersInList(data.total || 0); // Update total count for the list
    } catch (error: any) {
        toast({ title: "Error", description: `Could not fetch subscribers: ${error.message}`, variant: "destructive" });
        setSubscribers([]);
        setTotalSubscribersInList(0);
    } finally {
        setIsLoadingContacts(false);
    }
  }, [activeAccount]); // Depend only on activeAccount

  // Fetch lists when account changes
  useEffect(() => {
    const fetchLists = async () => {
        if (activeAccount && activeAccount.apiKey && activeAccount.status === 'connected') {
            setIsLoadingLists(true);
            setLists([]);
            setSelectedList(null);
            setSubscribers([]);
            setTotalSubscribersInList(0);
            setCurrentPage(1);
            try {
                // Fetch lists using the existing endpoint
                const response = await fetch('/api/brevo/lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: activeAccount.apiKey })
                });
                 if (!response.ok) {
                     const errorData = await response.json();
                     throw new Error(errorData.details?.message || errorData.details?.code || errorData.error || 'Failed to fetch lists');
                 }
                const data: BrevoList[] = await response.json();
                if (Array.isArray(data)) {
                  setLists(data);
                } else {
                  setLists([]);
                }
            } catch (error: any) {
                toast({ title: "Error", description: `Could not fetch lists: ${error.message}`, variant: "destructive" });
                setLists([]);
            } finally {
                 setIsLoadingLists(false);
            }
        } else {
             setLists([]);
             setSelectedList(null);
             setSubscribers([]);
             setTotalSubscribersInList(0);
             setCurrentPage(1);
        }
    };
    fetchLists();
  }, [activeAccount]);

  // Fetch subscribers when selected list or page changes
  useEffect(() => {
    if (selectedList && activeAccount?.status === 'connected') {
        fetchSubscribers(selectedList, currentPage);
    } else {
        // Clear subscribers if list is deselected or account disconnects
        setSubscribers([]);
        setTotalSubscribersInList(0);
    }
  }, [selectedList, currentPage, fetchSubscribers, activeAccount?.status]); // Add status dependency

  const handleListChange = (listId: string) => {
    setSelectedList(listId);
    setCurrentPage(1); // Reset to first page when list changes
  };

  // Handle bulk deletion
  const handleBulkDelete = async () => {
    if(!activeAccount || !selectedList || selectedEmails.length === 0) return;
    setIsDeleting(true);
    try {
         // *** Call the new backend endpoint for deleting contacts ***
         const response = await fetch('/api/brevo/delete-contacts', {
            method: 'POST', // Using POST to send a body with emails
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: activeAccount.apiKey,
                emails: selectedEmails // Send array of emails
            })
        });

        const result = await response.json(); // Backend sends success/failure details

        if (!response.ok && response.status !== 207) { // 207 is partial success
            throw new Error(result.error || "Deletion failed");
        }

        let successMessage = `${result.details?.success?.length || 0} subscriber(s) deleted.`;
        if (result.details?.failed?.length > 0) {
            successMessage += ` ${result.details.failed.length} failed.`;
             toast({
                title: "Partial Success",
                description: successMessage,
                variant: "default" // Use default variant for partial success
            });
            console.error("Failed deletions:", result.details.failed);
        } else {
             toast({ title: "Success", description: successMessage });
        }

        // Refresh the current page after deletion
        fetchSubscribers(selectedList, currentPage);
        // setSelectedEmails([]); // Cleared by fetchSubscribers

    } catch (error: any) {
         toast({ title: "Error", description: `Could not delete subscribers: ${error.message}`, variant: "destructive" });
    } finally {
        setIsDeleting(false);
    }
  };

  // Removed getOriginBadge as Brevo's standard contact object doesn't have a direct 'origin'

  // Selection handlers remain the same
  const toggleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked === true) {
        setSelectedEmails(subscribers.map(s => s.email));
    } else {
        setSelectedEmails([]);
    }
  };
  const toggleSelectOne = (email: string, checked: boolean) => {
    if (checked) {
        setSelectedEmails(prev => [...prev, email]);
    } else {
        setSelectedEmails(prev => prev.filter(e => e !== email));
    }
  };

  const isAllSelected = selectedEmails.length === subscribers.length && subscribers.length > 0;
  const isSomeSelected = selectedEmails.length > 0 && selectedEmails.length < subscribers.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
           {/* *** UPDATED TEXT *** */}
          <p className="text-muted-foreground">View and manage subscribers in your Brevo lists.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          {/* Show total count for the selected list */}
          <CardTitle>Subscribers {selectedList ? `(${totalSubscribersInList} Total in List)` : ''}</CardTitle>
          <CardDescription>Select a list to view the subscribers within it.</CardDescription>
          <div className="pt-4 flex flex-wrap gap-4 items-center">
            {/* List Selector */}
            <Select
                onValueChange={handleListChange}
                disabled={!activeAccount || isLoadingLists || isDeleting || activeAccount.status !== 'connected'} // Disable conditions
                value={selectedList ?? ""}
            >
                <SelectTrigger className="w-full md:w-auto md:min-w-64">
                    <SelectValue placeholder={
                        !activeAccount ? "Select account first" :
                        activeAccount.status !== 'connected' ? "Account disconnected" :
                        isLoadingLists ? "Loading lists..." :
                        "Select a list..."
                    } />
                </SelectTrigger>
                <SelectContent>
                    {isLoadingLists && <div className="p-2 text-sm text-muted-foreground">Loading...</div>}
                    {!isLoadingLists && lists.length === 0 && activeAccount?.status === 'connected' && (
                        <div className="p-2 text-sm text-muted-foreground">No lists found.</div>
                    )}
                    {lists.map(list => (
                        <SelectItem key={list.id} value={list.id.toString()}>{list.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {/* Delete Button */}
            {selectedEmails.length > 0 && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isDeleting}>
                           <Trash2 className="h-4 w-4 mr-2" />
                           {isDeleting ? "Deleting..." : `Delete Selected (${selectedEmails.length})`}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <strong>{selectedEmails.length} subscriber(s)</strong> from Brevo. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                           onClick={handleBulkDelete}
                           // Use buttonVariants for styling
                           className={buttonVariants({ variant: "destructive" })}
                           disabled={isDeleting} // Disable confirm button while deleting
                         >
                          {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
            {/* Subscribers Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    onCheckedChange={toggleSelectAll}
                                    checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
                                    aria-label="Select all rows on this page"
                                    disabled={subscribers.length === 0 || isLoadingContacts} // Disable if no subs or loading
                                />
                            </TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>First Name</TableHead>
                            <TableHead>Last Name</TableHead>
                            <TableHead>Added Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingContacts ? (
                            // Show Skeleton loaders
                             Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={`skel-${i}`}>
                                     <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                     <TableCell><Skeleton className="h-5 w-4/5" /></TableCell>
                                     <TableCell><Skeleton className="h-5 w-3/5" /></TableCell>
                                     <TableCell><Skeleton className="h-5 w-3/5" /></TableCell>
                                     <TableCell><Skeleton className="h-5 w-2/5" /></TableCell>
                                </TableRow>
                             ))
                        ) : subscribers.length > 0 ? (
                            subscribers.map(sub => (
                                <TableRow key={sub.id}>
                                    <TableCell>
                                        <Checkbox
                                            onCheckedChange={(checked) => toggleSelectOne(sub.email, !!checked)}
                                            checked={selectedEmails.includes(sub.email)}
                                            aria-label={`Select row for ${sub.email}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{sub.email}</TableCell>
                                    {/* Use attributes from Brevo contact */}
                                    <TableCell>{sub.attributes?.FIRSTNAME || '-'}</TableCell>
                                    <TableCell>{sub.attributes?.LASTNAME || '-'}</TableCell>
                                    {/* Format Brevo's createdAt timestamp */}
                                    <TableCell>{new Date(sub.createdAt).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                 <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                     {selectedList ? "No subscribers found in this list." : "Select a list to view subscribers."}
                                 </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                    <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} // Ensure page doesn't go below 1
                        disabled={currentPage === 1 || isLoadingContacts}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        disabled={currentPage >= totalPages || isLoadingContacts}
                    >
                        Next
                    </Button>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}