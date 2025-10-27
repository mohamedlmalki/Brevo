// src/pages/ForgetSubscriber.tsx
import { useState } from "react";
import { UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/components/ui/use-toast";

export default function ForgetSubscriber() {
  const { activeAccount } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [serverResponse, setServerResponse] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) {
      toast({ title: "No Active Account", description: "Please select an account from the sidebar.", variant: "destructive" });
      return;
    }
    if (!email) {
      toast({ title: "Email Required", description: "Please enter an email address to forget.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setServerResponse("Forgetting subscriber...");

    try {
      const response = await fetch("/api/subscribers/forget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: activeAccount.apiKey,
          email,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw data;
      }

      setServerResponse(JSON.stringify(data, null, 2));
      toast({ title: "Success", description: `Subscriber ${email} has been forgotten.` });
      setEmail(""); // Clear the input on success

    } catch (error: any) {
      setServerResponse(JSON.stringify(error, null, 2));
      toast({ title: "Failed", description: "Could not forget the subscriber. See server response for details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <UserX className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Forget Subscriber</h1>
          <p className="text-muted-foreground">Permanently delete a subscriber for testing purposes.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscriber Details</CardTitle>
            <CardDescription>
              Enter the email of the subscriber you want to permanently delete.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !activeAccount}>
                {isLoading ? "Forgetting..." : "Forget Subscriber"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Server Response</CardTitle>
            <CardDescription>The raw JSON response from the MailerLite API will appear here.</CardDescription>
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