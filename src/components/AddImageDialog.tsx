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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddImageDialogProps {
  children: React.ReactNode;
  onInsertImage: (html: string) => void;
}

export function AddImageDialog({ children, onInsertImage }: AddImageDialogProps) {
  const [open, setOpen] = useState(false);
  // *** UPDATED PLACEHOLDER URL ***
  const [imageUrl, setImageUrl] = useState("https://placehold.co/600x400/0b996e/white?text=Your+Image");
  const [linkUrl, setLinkUrl] = useState("");
  const [altText, setAltText] = useState("User uploaded image");
  const [width, setWidth] = useState("600");
  const [alignment, setAlignment] = useState("center");

  const generateHtml = () => {
    let imgTag = `<img src="${imageUrl}" alt="${altText}" width="${width}" style="max-width: 100%; height: auto; display: block;" />`;

    if (linkUrl) {
      imgTag = `<a href="${linkUrl}" target="_blank">${imgTag}</a>`;
    }

    if (alignment === "center") {
      return `<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">${imgTag}</td></tr></table>`;
    }

    // For left/right, we can wrap in a div with float, though this can be tricky in emails.
    // A simple alignment attribute is often better supported.
    return `<div align="${alignment}">${imgTag}</div>`;
  };

  const handleInsert = () => {
    onInsertImage(generateHtml());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Add Image to Email</DialogTitle>
          <DialogDescription>
            Configure and insert an image into your HTML template.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6">
          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="linkUrl">Link URL (Optional)</Label>
              <Input id="linkUrl" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" />
            </div>
            <div>
              <Label htmlFor="altText">Alt Text</Label>
              <Input id="altText" value={altText} onChange={(e) => setAltText(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="width">Width (px)</Label>
                <Input id="width" type="number" value={width} onChange={(e) => setWidth(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="alignment">Alignment</Label>
                <Select value={alignment} onValueChange={setAlignment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select alignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Image Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="border rounded-md p-4 h-64 flex items-center justify-center bg-muted/30 overflow-auto">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={altText}
                  style={{ width: `${width}px`, maxWidth: '100%', height: 'auto' }}
                  onError={(e) => (e.currentTarget.src = "https://placehold.co/600x400/red/white?text=Invalid+Image")}
                />
              ) : (
                <div className="text-muted-foreground">Enter an Image URL to see a preview</div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleInsert}>Insert Image</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}