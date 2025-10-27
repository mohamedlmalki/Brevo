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

interface AddFromFieldDialogProps {
  onFromFieldAdd: (field: { name: string; email: string; }) => void;
  children: React.ReactNode;
}

export function AddFromFieldDialog({ onFromFieldAdd, children }: AddFromFieldDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    onFromFieldAdd({ name, email });
    // Reset fields and close dialog
    setName("");
    setEmail("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add From Field</DialogTitle>
          <DialogDescription>
            Enter the name and email for the new sender. GetResponse will send a verification email.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="e.g., John Doe"/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">Email</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" placeholder="your.email@example.com"/>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Add From Field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}