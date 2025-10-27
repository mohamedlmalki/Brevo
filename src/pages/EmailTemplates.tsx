import { useState, useEffect, useCallback } from "react";
import { Mail, Edit, Eye, RefreshCw } from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PreviewDialog } from "@/components/PreviewDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// Interface for Brevo Template Sender
interface TemplateSender {
    name?: string; // Name might be optional in some responses
    email: string;
    id?: number;
}

// Interface for Brevo Template
interface BrevoTemplate {
  id: number;
  name: string;
  subject: string;
  isActive: boolean;
  sender?: TemplateSender; // Sender might be missing if default is used
  htmlContent: string;
  createdAt: string;
  modifiedAt: string;
}

// Interface for the API response { templates, count }
interface TemplatesResponse {
    count: number;
    templates: BrevoTemplate[];
}

// Interface for fields being edited in the modal
interface EditFormData {
    subject: string;
    senderName: string; // Only senderName is editable via input
    htmlContent: string;
}

export default function EmailTemplates() {
  const { activeAccount } = useAccount();
  const [templates, setTemplates] = useState<BrevoTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Store the full template being edited (needed for ID and original sender email/ID)
  const [selectedTemplate, setSelectedTemplate] = useState<BrevoTemplate | null>(null);
  
  // Store form data separate from the original template
  const [formData, setFormData] = useState<EditFormData>({
      subject: "",
      senderName: "",
      htmlContent: ""
  });

  // Fetch Templates
  const fetchTemplates = useCallback(async () => {
      if (!activeAccount?.apiKey || activeAccount.status !== 'connected') {
        setTemplates([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
          const response = await fetch('/api/brevo/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: activeAccount.apiKey,
                templateStatus: true, // Only active
                limit: 100,
                sort: 'desc'
             }),
          });
          if (!response.ok) {
              let errorMsg = `Error ${response.status}`;
              try { const errData = await response.json(); errorMsg = errData?.details?.message || errData?.error || errorMsg } catch (e) {}
              throw new Error(errorMsg);
           }
          // Expect { templates: [], count: 0 }
          const data: TemplatesResponse = await response.json();
          setTemplates(data.templates || []);

      } catch (error: any) {
         console.error("Error fetching email templates:", error);
         toast({ title: "Error", description: `Could not fetch templates: ${error.message}`, variant: "destructive" });
         setTemplates([]);
       }
      finally { setLoading(false); }
  }, [activeAccount]);

  // Fetch templates when account changes
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Open edit modal and populate form
  const handleEditClick = (template: BrevoTemplate) => {
      setSelectedTemplate(template);
      setFormData({
          subject: template.subject || "",
          senderName: template.sender?.name || "",
          htmlContent: template.htmlContent || "" // Ensure empty string if null/undefined
      });
      setIsModalOpen(true);
  };

  // Update form state on input change
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle Save Changes via API
  const handleSaveChanges = async () => {
      if (!activeAccount || !selectedTemplate || isSaving) return;
      
      setIsSaving(true);
      try {
          // Construct payload for the backend
          const payload: {
              apiKey: string;
              subject?: string;
              htmlContent?: string;
              // Send sender object expected by backend
              sender?: { name?: string; email?: string; id?: number }
          } = {
              apiKey: activeAccount.apiKey,
              subject: formData.subject,
              htmlContent: formData.htmlContent,
          };
          
          // Add sender info - IMPORTANT: pass the original email or ID for Brevo to identify the sender
          if (selectedTemplate.sender?.email || selectedTemplate.sender?.id) {
               payload.sender = {
                   name: formData.senderName, // Updated name from form
                   // Include original email OR id for lookup by Brevo
                   email: selectedTemplate.sender.email,
                   // Alternatively, if sender ID is always present:
                   // id: selectedTemplate.sender.id
               };
          } else {
               // Handle case where template might not have explicit sender info
               console.warn(`Template ${selectedTemplate.id} has no sender email/id. Attempting update with name only.`);
               payload.sender = { name: formData.senderName };
          }
          
          const response = await fetch(`/api/brevo/templates/${selectedTemplate.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          // Check for 204 No Content success status
          if (response.status !== 204) {
             let errorMsg = `Save failed (Status: ${response.status})`;
             try { const errData = await response.json(); errorMsg = errData?.details?.message || errData?.error || errorMsg } catch (e) {}
             throw new Error(errorMsg);
          }

          toast({ title: "Success", description: `Template "${selectedTemplate.name}" updated.`});
          setIsModalOpen(false);
          fetchTemplates(); // Refresh the list

      } catch (error: any) {
          console.error("Error updating template:", error);
          toast({ title: "Save Error", description: `Could not update template: ${error.message}`, variant: "destructive" });
      } finally {
          setIsSaving(false);
      }
  };

  // Helper for status badge
  const getStatusBadge = (isActive: boolean) => {
    return isActive
        ? <Badge variant="default" className="bg-green-600 text-white">Active</Badge>
        : <Badge variant="secondary">Inactive</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <div>
            <h1 className="text-2xl font-semibold">Email Template Management</h1>
            <p className="text-muted-foreground">View and edit your Brevo transactional email templates.</p>
            </div>
        </div>
        <Button
            variant="outline"
            size="sm"
            onClick={fetchTemplates} // Corrected onClick handler
            disabled={loading || !activeAccount || activeAccount.status !== 'connected'}
            aria-label="Refresh templates"
        >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
             <span className="ml-2 hidden md:inline">Refresh</span>
        </Button>
      </div>

      {/* Template List Card */}
      <Card>
        <CardHeader>
          <CardTitle>Templates (Active)</CardTitle>
          <CardDescription>Showing active transactional templates. Inactive templates are hidden.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={`skel-tpl-${i}`}>
                      <TableCell><Skeleton className="h-5 w-3/5" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-4/5" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-2/5" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : templates.length > 0 ? (
                  templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate" title={template.subject}>
                          {template.subject}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate" title={`${template.sender?.name} (${template.sender?.email})`}>
                          {template.sender?.name} ({template.sender?.email || 'Default'})
                      </TableCell>
                      <TableCell>{getStatusBadge(template.isActive)}</TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(template)} title="Edit Template">
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                     <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                            {!activeAccount || activeAccount.status !== 'connected' ? "Connect an account to view templates." : "No active templates found."}
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* Add pagination controls here if needed later, using the 'count' from API response */}
        </CardContent>
      </Card>

       {/* Edit Template Modal */}
       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Template: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Modify the subject, sender name, or HTML content. (Sender email cannot be changed here).
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="subject" className="text-right">Subject</Label>
                    <Input
                        id="subject"
                        name="subject" // Ensure name matches state key
                        value={formData.subject}
                        onChange={handleFormChange}
                        className="col-span-3"
                        disabled={isSaving}
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="senderName" className="text-right">Sender Name</Label>
                    <Input
                        id="senderName"
                        name="senderName" // Ensure name matches state key
                        value={formData.senderName}
                        onChange={handleFormChange}
                        className="col-span-3"
                        disabled={isSaving}
                    />
                     {/* Optional: Display original sender email */}
                     {/* <p className="col-span-3 col-start-2 text-xs text-muted-foreground mt-1">
                         Email: {selectedTemplate?.sender?.email || 'Default/Missing'} (Cannot be changed here)
                     </p> */}
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="htmlContent" className="text-right pt-2">HTML Content</Label>
                    <Textarea
                        id="htmlContent"
                        name="htmlContent" // Ensure name matches state key
                        value={formData.htmlContent}
                        onChange={handleFormChange}
                        className="col-span-3 font-mono text-xs"
                        rows={25}
                        disabled={isSaving}
                    />
                </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t pt-4">
             {/* Use existing PreviewDialog component */}
             <PreviewDialog htmlContent={formData.htmlContent}>
                 <Button variant="outline" disabled={isSaving}>
                     <Eye className="mr-2 h-4 w-4" /> Preview
                 </Button>
             </PreviewDialog>
             <DialogClose asChild>
                 <Button variant="outline" disabled={isSaving}>Cancel</Button>
             </DialogClose>
             <Button onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}