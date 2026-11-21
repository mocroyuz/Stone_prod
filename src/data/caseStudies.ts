import { img1, img2, img3 } from "./images";

export type Stat = { value: string; label: string };

export type CaseStudy = {
  id: number;
  brand: string;
  title: string;
  description: string;
  image: string;
  imageTone: "dark" | "light";
  stats: [Stat, Stat, Stat];
};

export const caseStudies: CaseStudy[] = [
  {
    id: 1,
    brand: "Stone",
    title: "AI Workflow Automation for SaaS Company",
    description:
      "We analyze your workflows, bottlenecks, and revenue opportunities.",
    image: img1,
    imageTone: "dark",
    stats: [
      { value: "+40%", label: "Demo Booking" },
      { value: "+25%", label: "Closing Rate" },
      { value: "3x", label: "Engagement" },
    ],
  },
  {
    id: 2,
    brand: "Stone",
    title: "Agent Deployment for Creative Teams",
    description:
      "Custom agents that draft, review, and ship creative work in hours.",
    image: img2,
    imageTone: "light",
    stats: [
      { value: "4x", label: "Productivity" },
      { value: "-62%", label: "Turnaround" },
      { value: "+18%", label: "Retention" },
    ],
  },
  {
    id: 3,
    brand: "Stone",
    title: "Predictive Revenue Ops for Fintech",
    description:
      "Forecasting models wired directly into the pipeline your team already uses.",
    image: img3,
    imageTone: "light",
    stats: [
      { value: "+31%", label: "Pipeline" },
      { value: "2.4x", label: "Win Rate" },
      { value: "-40%", label: "Manual Work" },
    ],
  },
  {
    id: 4,
    brand: "Stone",
    title: "Support Copilot for E-commerce Brands",
    description:
      "A copilot that resolves tickets, upsells, and learns from every reply.",
    image: img1,
    imageTone: "dark",
    stats: [
      { value: "89%", label: "Auto Resolve" },
      { value: "+22%", label: "CSAT" },
      { value: "5x", label: "Response Speed" },
    ],
  },
  {
    id: 5,
    brand: "Stone",
    title: "Data Infrastructure for Health Startups",
    description:
      "Clean pipelines, compliant storage, and dashboards people actually open.",
    image: img2,
    imageTone: "light",
    stats: [
      { value: "12ms", label: "Query Time" },
      { value: "+47%", label: "Adoption" },
      { value: "6x", label: "Data Volume" },
    ],
  },
];
