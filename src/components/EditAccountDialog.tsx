import { useState, useEffect } from "react";
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

// *** UPDATED INTERFACE to match AccountContext ***
interface Account {
    id: string;
    name: string;
    apiKey: string; // Represents Benchmark API Token
    // Removed apiUrl, clientId, secretId
}

// Use Omit for consistency
type AccountUpdateData = Omit<Account, 'id'>;

interface EditAccountDialogProps {
  account: Account; // Use the updated Account interface
  // *** UPDATED SIGNATURE ***
  onAccountUpdate: (id: string, data: AccountUpdateData) => void; // Use AccountUpdateData
  children: React.ReactNode;
}

export function EditAccountDialog({ account, onAccountUpdate, children }: EditAccountDialogProps) {
  const [name, setName] = useState(account.name);
  const [apiKey, setApiKey] = useState(account.apiKey); // API Token
  // const [apiUrl, setApiUrl] = useState(account.apiUrl || ""); // REMOVED
  const [open, setOpen] = useState(false);

  // This effect ensures the dialog's state is fresh every time it's opened
  useEffect(() => {
    if (open) {
      setName(account.name);
      setApiKey(account.apiKey);
      // setApiUrl(account.apiUrl || ""); // REMOVED
    }
  }, [open, account]);

  const handleSubmit = () => {
    if (!name || !apiKey) {
      alert("Please provide both an Account Name and API Token.");
      return;
    }
    // *** UPDATED CALL ***
    onAccountUpdate(account.id, { name, apiKey }); // Removed apiUrl
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Ensure stopPropagation if needed */}
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>Update the details for "{account.name}".</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">Account Name</Label>
                <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3"/>
            </div>
            {/* Updated Label */}
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-apiKey" className="text-right">API Token</Label>
                <Input id="edit-apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="col-span-3"/>
            </div>
            {/* *** REMOVED API URL INPUT *** */}
            {/* <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-apiUrl" className="text-right">API URL</Label>
                <Input id="edit-apiUrl" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="col-span-3"/>
            </div> */}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}