"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface MetricDefinitionProps {
  metric: string;
  definition?: string;
  formula?: string;
}

const METRIC_DEFINITIONS: Record<string, { definition: string; formula?: string }> = {
  revenue_net: {
    definition: "Total revenue after refunds and discounts, excluding taxes and shipping.",
    formula: "Revenue (Gross) - Refunds - Discounts",
  },
  meta_spend: {
    definition: "Total advertising spend on Meta platforms (Facebook, Instagram).",
  },
  mer: {
    definition: "Marketing Efficiency Ratio: Total revenue divided by total ad spend. Measures overall marketing effectiveness.",
    formula: "Revenue (Net) ÷ Meta Spend",
  },
  roas: {
    definition: "Return on Ad Spend: Revenue directly attributed to Meta ads divided by Meta ad spend.",
    formula: "Meta-Attributed Revenue ÷ Meta Spend",
  },
  aov: {
    definition: "Average Order Value: Average revenue per order.",
    formula: "Revenue (Net) ÷ Total Orders",
  },
  orders: {
    definition: "Total number of orders placed during the selected period.",
  },
};

export function MetricDefinition({ metric, definition, formula }: MetricDefinitionProps) {
  const info = METRIC_DEFINITIONS[metric] || { definition, formula };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full"
          >
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Metric definition</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="text-sm">{info.definition}</p>
            {info.formula && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">{info.formula}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

