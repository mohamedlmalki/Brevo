import { useState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// *** UPDATED INTERFACE for Brevo List ***
interface BrevoList {
    id: number; // Brevo uses numeric ID
    name: string;
}

export default function SingleUserImport() {
  const { activeAccount } = useAccount();
  const [isImporting, setIsImporting] = useState(false);
  const [lists, setLists] = useState<BrevoList[]>([]); // Use BrevoList interface
  const [selectedList, setSelectedList] = useState<string | null>(null); // Keep as string for Select value
  const [isLoadingLists, setIsLoadingLists] = useState(false); // Added loading state

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });

  const [serverResponse, setServerResponse] = useState("");

  // *** UPDATED useEffect to fetch Brevo lists ***
  useEffect(() => {
    const fetchLists = async () => {
        // Only fetch if we have an active, connected account
        if (activeAccount && activeAccount.apiKey && activeAccount.status === 'connected') {
            setIsLoadingLists(true);
            setLists([]); // Clear previous lists
            setSelectedList(null); // Deselect list
            try {
                // *** Call the new backend endpoint for Brevo lists ***
                const response = await fetch('/api/brevo/lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: activeAccount.apiKey })
                });
                if (!response.ok) {
                     const errorData = await response.json();
                     throw new Error(errorData.details?.message || errorData.details?.code || errorData.error || 'Failed to fetch lists');
                }
                const data: BrevoList[] = await response.json(); // Expect BrevoList[]
                if (Array.isArray(data)) {
                  setLists(data);
                } else {
                  console.error("Received non-array data for lists:", data);
                  setLists([]);
                  toast({ title: "Warning", description: "Received unexpected format for lists.", variant: "default" });
                }
            } catch (error: any) {
                console.error("Error fetching lists:", error);
                toast({ title: "Error", description: `Could not fetch Brevo lists: ${error.message}`, variant: "destructive" });
                setLists([]);
            } finally {
                 setIsLoadingLists(false);
            }
        } else {
            setLists([]); // Clear lists if no active/connected account
            setSelectedList(null);
        }
    };
    fetchLists();
  }, [activeAccount]); // Re-fetch when activeAccount changes


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) {
      toast({ title: "No Active Account", description: "Please select an account first.", variant: "destructive" });
      return;
    }
     if (!selectedList) {
      toast({ title: "No List Selected", description: "Please select a list to add the user to.", variant: "destructive" });
      return;
    }
     if (!formData.email) {
      toast({ title: "Email Required", description: "Please enter an email address.", variant: "destructive" });
      return;
     }


    setIsImporting(true);
    setServerResponse("Importing user...");

    // Prepare contact payload for the backend (which expects firstName, lastName)
    const contactPayload = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName
    };

    try {
        // *** Call the new backend endpoint for Brevo contact creation ***
        const response = await fetch("/api/brevo/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                apiKey: activeAccount.apiKey,
                contact: contactPayload,
                listId: selectedList, // Pass the selected list ID (string)
                // customFields: [] // Not needed for standard attributes
            })
        });

        const responseText = await response.text();
        let data;
        try {
            data = responseText ? JSON.parse(responseText) : { status: response.status }; // Handle empty 204 response
        } catch(e) {
            data = { rawResponse: responseText, status: response.status }; // Use raw text if not JSON
        }

        // *** Brevo uses 201 (Created) or 204 (Updated/No Content) for success ***
        if (response.status !== 201 && response.status !== 204) {
           // Throw the parsed data which might contain Brevo error details
           throw data;
        }

        setServerResponse(JSON.stringify(data, null, 2));
        toast({ title: "Success", description: `User ${formData.email} has been imported/updated.`});
        // Clear form on success
        setFormData({ firstName: "", lastName: "", email: ""});
        // Optionally deselect list: setSelectedList(null);

    } catch (error: any) {
        // error might be the parsed JSON error from Brevo or a fetch error
        const errorMessage = error?.details?.message || error?.error || error?.rawResponse || error?.message || "An unknown error occurred.";
        setServerResponse(JSON.stringify(error, null, 2));
        toast({ title: "Import Failed", description: `Could not import user: ${errorMessage}`, variant: "destructive" });
    } finally {
        setIsImporting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Single User Import</h1>
           {/* *** UPDATED TEXT *** */}
          <p className="text-muted-foreground">Add a new contact to a Brevo list.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
            <CardDescription>
                Fill in the details for the new contact you want to add.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="list">List</Label>
                 {/* *** UPDATED Select component *** */}
                <Select
                    onValueChange={setSelectedList}
                    disabled={!activeAccount || isImporting || isLoadingLists || activeAccount.status !== 'connected'}
                    value={selectedList ?? ""} // Control value
                >
                    <SelectTrigger id="list">
                         <SelectValue placeholder={
                                !activeAccount ? "Select account first" :
                                activeAccount.status === 'checking' ? "Checking account..." :
                                activeAccount.status === 'failed' ? "Account connection failed" :
                                isLoadingLists ? "Loading lists..." :
                                "Select a list"
                             } />
                    </SelectTrigger>
                    <SelectContent>
                         {lists.length === 0 && !isLoadingLists && activeAccount?.status === 'connected' && (
                             <div className="p-2 text-sm text-muted-foreground">No lists found or error loading.</div>
                         )}
                        {lists.map(list => (
                            // Use Brevo list id (number converted to string) and name
                            <SelectItem key={list.id} value={list.id.toString()}>{list.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    placeholder="Enter first name" // Standard Brevo attribute
                    disabled={isImporting}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    placeholder="Enter last name" // Standard Brevo attribute
                    disabled={isImporting}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="user@example.com"
                  required
                  disabled={isImporting}
                />
              </div>

              <Button
                  type="submit"
                  className="w-full"
                  disabled={isImporting || !activeAccount || !selectedList || isLoadingLists || activeAccount.status !== 'connected'} // Disable conditions
              >
                {isImporting ? "Importing..." : "Import User"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Server Response</CardTitle>
             {/* *** UPDATED TEXT *** */}
            <CardDescription>The raw JSON response from the Brevo API will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-lg p-4 min-h-[300px]">
              <Textarea
                value={serverResponse}
                readOnly
                placeholder="Server response will appear here..."
                className="w-full h-full min-h-[300px] bg-transparent border-none resize-none font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}