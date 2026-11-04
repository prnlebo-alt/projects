import type { Metadata } from "next";
import { Playground } from "@/components/playground";
import { Footer } from "@/components/footer";

export const metadata: Metadata = { title: "Playground", alternates: { canonical: "/playground" } };

export default function PlaygroundPage() {
  return <main><section className="page-hero"><span className="eyebrow">Interactive playground</span><h1>Break the chart here,<br/>not in production.</h1><p>Edit the JSON, render instantly, and see the accessibility summary and QA review returned by the same engine your API calls use.</p></section><div className="playground-page"><Playground /></div><Footer /></main>;
}
