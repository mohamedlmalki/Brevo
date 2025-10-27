import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddAccountDialogProps {
  // *** Type remains compatible (expects { name: string; apiKey: string; }) ***
  onAccountAdd: (account: { name: string; apiKey: string; }) => void;
  children: React.ReactNode;
}

export function AddAccountDialog({ onAccountAdd, children }: AddAccountDialogProps) {
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState(""); // This will now be the Brevo API Key
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    if (!name || !apiKey) {
        // Updated validation message
        alert("Please provide both an Account Name and Brevo API Key.");
        return;
    }
    // *** Call remains the same, passing Brevo key as apiKey ***
    onAccountAdd({ name, apiKey });
    // Reset fields and close dialog
    setName("");
    setApiKey("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          {/* *** UPDATED TEXT *** */}
          <DialogTitle>Add Brevo Account</DialogTitle>
          <DialogDescription>
            Enter a name for this account and your Brevo API Key (v3).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Account Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="e.g., Main Brevo Account"/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
             {/* *** UPDATED TEXT *** */}
            <Label htmlFor="apiKey" className="text-right">API Key</Label>
            <Input id="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="col-span-3" placeholder="Your Brevo API Key (v3)"/>
          </div>
          {/* API URL Input is already removed */}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Save Account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}