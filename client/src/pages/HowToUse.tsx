import { ArrowRight, CheckCircle2, FileText, HelpCircle, Link2, Moon, PlayCircle, RefreshCw, Sparkles, Upload, XCircle } from "lucide-react";
import { Link } from "wouter";

const steps = [
  { icon: Upload, title: "1. Add a video", body: "Open New Project and paste a direct video link or upload an MP4, MOV, or WEBM file up to 250MB." },
  { icon: FileText, title: "2. Add campaign requirements", body: "Optionally paste your Whop or Content Rewards campaign link, or upload the campaign brief as a PDF or DOCX file." },
  { icon: Sparkles, title: "3. Generate five clips", body: "Select Generate viral clips. KlipFlow downloads the source, finds five clip windows, renders vertical videos, and saves them to My Clips." },
  { icon: CheckCircle2, title: "4. Review and edit", body: "Open the project to preview each clip, edit the title and caption, and download the finished video." },
  { icon: Link2, title: "5. Post and submit", body: "Connect your social accounts, auto-post where supported, then submit the post to the relevant Whop campaign before the 30-minute window expires." },
];

export default function HowToUse() {
  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-[#FF4D00]">A quick start guide</p><h1 className="mt-1 text-3xl font-black">How to use KlipFlow</h1><p className="mt-2 text-base leading-6 text-black/55 dark:text-white/60">Turn one long video into five ready-to-post clips, then track the submissions and earnings in one workspace.</p></div>
    <section className="rounded-3xl bg-[#151515] p-5 text-white shadow-sm"><div className="flex items-start gap-3"><PlayCircle className="mt-0.5 shrink-0 text-[#FF4D00]" size={24} /><div><h2 className="font-black">The shortest path</h2><p className="mt-1 text-sm leading-6 text-white/70">New Project → upload a video → add campaign requirements → Generate viral clips → review in My Clips.</p></div></div><Link href="/new-project" className="mt-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#FF4D00] text-sm font-extrabold text-white">Start a new project <ArrowRight size={16} /></Link></section>
    <section className="space-y-3">{steps.map(({ icon: Icon, title, body }) => <article key={title} className="flex gap-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1C1C1C]"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1EB] text-[#FF4D00]"><Icon size={21} /></div><div><h2 className="font-black">{title}</h2><p className="mt-1 text-sm leading-6 text-black/55 dark:text-white/60">{body}</p></div></article>)}</section>
    <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1C1C1C]"><h2 className="flex items-center gap-2 font-black"><HelpCircle className="text-[#FF4D00]" size={20} /> If generation takes a while</h2><div className="mt-4 space-y-3 text-sm leading-6 text-black/60 dark:text-white/60"><p><RefreshCw className="mr-2 inline text-[#FF4D00]" size={16} />Watch the progress history on the project page. You can leave the page open while FFmpeg renders each clip.</p><p><XCircle className="mr-2 inline text-[#FF4D00]" size={16} />Use Cancel generation if the source is wrong or you want to stop. Failed or cancelled jobs can be retried without creating a new project.</p><p><Moon className="mr-2 inline text-[#FF4D00]" size={16} />Use the theme button in the header or menu to switch between light and dark mode. Your choice is saved on this device.</p></div></section>
    <p className="text-center text-xs text-black/40 dark:text-white/40">Need an account connection? <Link href="/accounts" className="font-bold text-[#FF4D00]">Open Connected Accounts</Link>.</p>
  </div>;
}
