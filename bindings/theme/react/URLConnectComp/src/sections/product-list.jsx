import React, { useEffect, useRef, useState } from "react";
import "../styles/style.css";

export function Component({ title = "URLConnect Extension" }) {
  const [storedUrl, setStoredUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const timeoutRef = useRef(null);

  // Fetch once on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");
        setIframeError(false);
        setIframeLoaded(false);

        const response = await fetch("/ext/urlconnect", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const text = await response.text();
          console.log("Non-JSON response snippet:", text.slice(0, 200));
          throw new Error("Proxy returned HTML instead of JSON - proxy not configured correctly");
        }

        const data = await response.json();
        if (!cancelled) {
          if (data.url) {
            setStoredUrl(data.url);

            // Start a single watchdog timer; clear it on successful iframe load
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
              // if we still haven't seen onLoad, assume blocked
              setIframeError((prev) => (iframeLoaded ? prev : true));
            }, 15000); // give it 15s to be safe
          } else {
            setError("No URL configured");
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to fetch stored URL");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []); // ← no dependency on iframeLoaded

  const framedSrc = storedUrl ? `/ext/urlconnect/frame?url=${encodeURIComponent(storedUrl)}` : "";

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    setIframeError(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleIframeError = () => {
    setIframeLoaded(false);
    setIframeError(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="hero-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="hero-error">
        <h3>⚠️ Error Loading Content</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="retry-button">
          🔄 Retry
        </button>
      </div>
    );
  }

  // Show no URL state
  if (!storedUrl) {
    return (
      <div className="hero-no-url">
        <h3>🔗 No URL Configured</h3>
        <p>Please configure a URL through the URLConnect extension.</p>
      </div>
    );
  }

  // Show iframe blocked state
  if (iframeError) {
    return (
      <div className="hero-blocked">
        <div className="blocked-content">
          <h3>🛡️ Preview Not Available</h3>
          <p>This website cannot be embedded. Open it directly:</p>
          <a href={storedUrl} target="_blank" rel="noopener noreferrer" className="hero-button">
            🔗 Open {(() => { try { return new URL(storedUrl).hostname; } catch { return 'Website'; } })()}
          </a>
        </div>
      </div>
    );
  }

  // Show full-screen iframe
  return (
    <div className="hero-iframe-container">
      <div>Hello World-=f qqfqlnf</div>
      <iframe
        src={framedSrc}
        className="hero-iframe"
        title="URLConnect Preview"
        style={{ border: "none" }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />
      
      {!iframeLoaded && (
        <div className="hero-loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading preview...</p>
        </div>
      )}
    </div>
  );
}

export const settings = {
  label: "URLConnect Display",
  name: "urlconnect-display",
  props: [
    { id: "title", label: "Page Title", type: "text", default: "URLConnect Extension" },
  ],
  blocks: [],
};
