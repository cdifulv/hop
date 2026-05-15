import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Globe2,
  LineChart,
  type LucideIcon,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const metrics = [
  { label: "Global mandates", value: "42", trend: "+8%" },
  { label: "Capital reviewed", value: "$1.8B", trend: "+12%" },
  { label: "Risk variance", value: "3.4%", trend: "-2%" },
];

const palette = [
  ["Brand Blue", "#0B4DA2"],
  ["Panel", "#13223A"],
  ["Surface", "#1E293B"],
  ["Elevated", "#273447"],
  ["Border", "#334155"],
  ["Text", "#F1F5F9"],
  ["Muted", "#CBD5E1"],
];

const activity = [
  "European private credit memo moved to committee review.",
  "APAC infrastructure screen cleared concentration thresholds.",
  "North American income strategy updated with revised duration targets.",
];

const principles: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    icon: CircleDollarSign,
    title: "Capital discipline",
    body: "Clear status states and premium controls for repeated financial workflows.",
  },
  {
    icon: BarChart3,
    title: "Data clarity",
    body: "Slate panels, blue accents, and clean chart colors for scanning dense information.",
  },
  {
    icon: Globe2,
    title: "Global posture",
    body: "A classic serif voice paired with direct, modern interface typography.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0F172A] text-slate-100">
      <section className="border-b border-white/10 bg-[linear-gradient(135deg,#0B1320,#17263A_55%,#0F172A)]">
        <div className="mx-auto grid min-h-[92vh] w-full max-w-7xl gap-10 px-5 py-6 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-10">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-white/15 bg-[#13223A] text-[#60A5FA]">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-serif text-xl uppercase tracking-normal text-[#F1F5F9]">
                  Somerset
                </p>
                <p className="text-xs font-medium uppercase tracking-normal text-[#CBD5E1]">
                  Capital Group
                </p>
              </div>
            </div>

            <div className="max-w-xl space-y-5">
              <Badge className="bg-[#0B4DA2] text-white hover:bg-[#0B4DA2]">
                Slate Blue System
              </Badge>
              <h1 className="font-serif text-4xl uppercase leading-tight tracking-normal text-[#F1F5F9] sm:text-5xl lg:text-6xl">
                Global capital strategy, presented with quiet confidence.
              </h1>
              <p className="max-w-lg text-base leading-7 text-[#CBD5E1]">
                A shadcn/ui Next.js starter shaped around the Somerset slate-blue
                palette, Playfair Display headings, and precise financial UI
                patterns.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button className="bg-[#0B4DA2] text-white hover:bg-[#0B4DA2]/90">
                Review dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                View brand tokens
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            <Card className="border-[#334155] bg-[#13223A]/95 shadow-2xl shadow-black/25">
              <CardHeader className="border-b border-[#334155]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg text-[#F1F5F9]">
                      Portfolio Overview
                    </CardTitle>
                    <CardDescription className="text-[#CBD5E1]">
                      Cross-market allocation snapshot
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-[#60A5FA] text-[#60A5FA]">
                    Live
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  {metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-md border border-[#334155] bg-[#1E293B] p-4"
                    >
                      <p className="text-sm text-[#CBD5E1]">{metric.label}</p>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="text-2xl font-semibold text-[#F1F5F9]">
                          {metric.value}
                        </p>
                        <span className="text-sm font-medium text-[#22C55E]">
                          {metric.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_0.72fr]">
                  <div className="rounded-md border border-[#334155] bg-[#1E293B] p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#F1F5F9]">
                          Allocation
                        </p>
                        <p className="text-xs text-[#CBD5E1]">By mandate type</p>
                      </div>
                      <LineChart className="h-5 w-5 text-[#60A5FA]" />
                    </div>
                    <div className="space-y-4">
                      {[
                        ["Private Credit", "68%"],
                        ["Infrastructure", "46%"],
                        ["Income Strategy", "39%"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div className="mb-2 flex justify-between text-sm">
                            <span className="text-[#CBD5E1]">{label}</span>
                            <span className="text-[#F1F5F9]">{value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#273447]">
                            <div
                              className="h-2 rounded-full bg-[#0B4DA2]"
                              style={{ width: value }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border border-[#334155] bg-[#1E293B] p-5">
                    <div className="mb-5 flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-[#22C55E]" />
                      <p className="text-sm font-medium text-[#F1F5F9]">
                        Review Queue
                      </p>
                    </div>
                    <div className="space-y-4">
                      {activity.map((item) => (
                        <p
                          key={item}
                          className="border-l border-[#0B4DA2] pl-3 text-sm leading-6 text-[#CBD5E1]"
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-10">
        <Card className="border-[#334155] bg-[#13223A]">
          <CardHeader>
            <CardTitle className="font-serif text-2xl uppercase text-[#F1F5F9]">
              Brand Tokens
            </CardTitle>
            <CardDescription className="text-[#CBD5E1]">
              Somerset slate-blue colors mapped into shadcn variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {palette.map(([label, color]) => (
              <div key={color} className="space-y-2">
                <div
                  className="h-14 rounded-md border border-white/15"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <p className="text-xs font-medium text-[#F1F5F9]">{label}</p>
                  <p className="text-xs text-[#CBD5E1]">{color}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          {principles.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="border-[#334155] bg-[#1E293B]">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#0B4DA2] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base text-[#F1F5F9]">{title}</CardTitle>
                <CardDescription className="leading-6 text-[#CBD5E1]">
                  {body}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
