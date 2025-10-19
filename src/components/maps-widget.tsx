"use client";

import { useEffect, useRef } from "react";

interface MapsWidgetProps {
  contextToken: string;
  suggestions: Array<{
    name: string;
    uri: string;
    placeId?: string;
  }>;
}

export function MapsWidget({ contextToken, suggestions }: MapsWidgetProps) {
  console.log(`🗺️ MapsWidget rendering with ${suggestions.length} suggestions`);

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-lg">📍</span>
          Suggested Meeting Locations Near SHACK15
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Real places from Google Maps • Click any to get directions
        </p>
      </div>

      {/* Place list from Google Maps grounding */}
      <div className="p-4 space-y-2">
        {suggestions.slice(0, 5).map((place, idx) => (
          <a
            key={idx}
            href={place.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-all hover:border-primary hover:bg-accent hover:shadow-sm"
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{place.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                📱 Tap to open in Google Maps →
              </p>
            </div>
            <div className="flex-shrink-0 text-muted-foreground">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        ))}

        {suggestions.length > 5 && (
          <div className="pt-2 text-center">
            <p className="text-xs text-muted-foreground">
              + {suggestions.length - 5} more places nearby
            </p>
          </div>
        )}

        <div className="mt-4 rounded-md bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            ✨ <strong>Powered by Google Maps Grounding</strong> - Real-time data with ratings, hours, and reviews
          </p>
        </div>
      </div>
    </div>
  );
}
