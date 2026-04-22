export default function PublicPage() {
  return (
    <div className="min-h-[calc(100vh-48px)] flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">OpenJCK</h1>
        <p className="text-muted-foreground mb-8">
          Observability Dashboard for Autonomous AI Agent Systems
        </p>
        <div className="space-x-4">
          <a
            href="/auth/login"
            className="inline-flex items-center px-4 py-2 bg-accent text-background rounded-md font-medium hover:bg-accent/90"
          >
            Sign In
          </a>
           <a
             href="/sessions"
             className="inline-flex items-center px-4 py-2 border border-border text-foreground rounded-md font-medium hover:bg-muted"
           >
             View Dashboard
           </a>
        </div>
      </div>
    </div>
  );
}
