import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // Per-route head: unique title + description for the 404 so search engines
  // and social previews don't conflate it with the homepage.
  useEffect(() => {
    const prevTitle = document.title;
    const desc = document.querySelector('meta[name="description"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const prevDesc = desc?.getAttribute("content") ?? "";
    const prevOgTitle = ogTitle?.getAttribute("content") ?? "";
    const prevOgDesc = ogDesc?.getAttribute("content") ?? "";
    document.title = "Page Not Found — Steganography Online";
    desc?.setAttribute("content", "The page you're looking for doesn't exist. Return to Steganography Online to encode or decode hidden messages in images.");
    ogTitle?.setAttribute("content", "Page Not Found — Steganography Online");
    ogDesc?.setAttribute("content", "This page doesn't exist. Head back to the homepage to hide or extract secret messages in images.");
    return () => {
      document.title = prevTitle;
      desc?.setAttribute("content", prevDesc);
      ogTitle?.setAttribute("content", prevOgTitle);
      ogDesc?.setAttribute("content", prevOgDesc);
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/80">
          Return to Home
        </a>
      </div>
    </main>
  );
};

export default NotFound;
