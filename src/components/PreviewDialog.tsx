import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PreviewDialogProps {
  children: React.ReactNode;
  htmlContent: string;
}

export function PreviewDialog({ children, htmlContent }: PreviewDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>HTML Template Preview</DialogTitle>
        </DialogHeader>
        <div className="flex-1 border rounded-md overflow-hidden">
          <iframe
            srcDoc={htmlContent}
            title="Email Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts" // Be cautious with scripts in previews
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}