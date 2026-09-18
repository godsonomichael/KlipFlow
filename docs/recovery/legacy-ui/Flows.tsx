import { useState } from "react";
import { ArrowRight, Check, FileText, FolderOpen, Globe2, Plus, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export default function Flows() {
  const [url, setUrl] = useState("");
  const [created, setCreated] = useState(false);
  const driveStatus = trpc.klipflow.drive.status.useQuery();
  const inspect = trpc.klipflow.drive.inspect.useMutation();

  const handleInspect = () => {
    if (!url.trim()) return;
    inspect.mutate({ url: url.trim() });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#FF4D00]"><WandSparkles size={17} /><span className="text-xs font-semibold uppercase tracking-[0.15em]">Production automation</span></div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">Flows</h1>
          <p className="mt-2 text-sm text-white/40">Bring in a brief or source file, then move it through review.</p>
        </div>
        <Button onClick={() => setCreated(true)} className="h-8 rounded-md bg-[#FF4D00] text-xs uppercase text-white hover:bg-[#E64500]"><Plus size={15} /> New flow</Button>
      </div>

      {created && <section className="grid gap-4 border border-[#262626] bg-[#171717] p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="text-sm font-semibold">New flow intake</div>
          <p className="mt-1 text-xs text-white/45">Paste a campaign or Google Drive file URL. KlipFlow checks access before processing.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1"><Globe2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" /><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/file/d/..." className="h-8 border-[#262626] bg-[#0A0A0A] pl-9 text-sm text-white placeholder:text-white/25" /></div>
            <Button onClick={handleInspect} disabled={inspect.isPending || !url.trim()} className="h-8 bg-[#FF4D00] text-xs uppercase text-white hover:bg-[#E64500]
">{inspect.isPending ? "Checking" : "Check source"} <ArrowRight size={14} /></Button>
          </div>
          {inspect.error && <p className="mt-3 text-xs text-red-300">{inspect.error.message}</p>}
          {inspect.data && <div className="mt-4 border border-[#262626] bg-[#0A0A0A] p-3 text-xs"><div className="flex items-center gap-2 text-[#FF4D00]"><Check size={14} /> Source is ready</div><div className="mt-2 text-white/70">{inspect.data.metadata.name}</div><div className="mt-1 text-white/35">{inspect.data.metadata.mimeType} · {inspect.data.fileId}</div></div>}
        </div>
        <button onClick={() => setCreated(false)} className="self-start text-xs uppercase text-white/35 hover:text-white">Dismiss</button>
      </section>}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="border border-[#262626] bg-[#171717] p-5">
          <div className="mb-5"><h2 className="text-sm font-semibold">Active flows</h2><p className="mt-1 text-xs text-white/35">Your saved production workspaces</p></div>
          <div className="border border-dashed border-[#262626] p-8 text-center"><FileText className="mx-auto text-white/25" size={22} /><p className="mt-3 text-sm text-white/60">No flows yet</p><p className="mt-1 text-xs text-white/35">Create a flow to see its source, review stage, and drops here.</p></div>
        </section>
        <section className="border border-[#262626] bg-[#171717] p-5"><h2 className="text-sm font-semibold">Flow inputs</h2><p className="mt-1 text-xs text-white/35">Choose a verified source before processing.</p><div className="mt-5 space-y-3"><div className="flex gap-3 border border-[#FF4D00]/30 bg-[#FF4D00]/[0.06] p-3"><Globe2 size={17} className="mt-0.5 shrink-0 text-[#FF4D00]" /><div><div className="text-xs font-medium">Manual URL + Firecrawl</div><div className="mt-1 text-[11px] leading-5 text-white/40">Extract requirements only when Firecrawl is configured.</div></div><Check size={15} className="ml-auto text-[#FF4D00]" /></div><div className="flex gap-3 border border-[#262626] bg-[#0A0A0A] p-3"><FolderOpen size={17} className="mt-0.5 shrink-0 text-white/50" /><div><div className="text-xs font-medium">Google Drive</div><div className="mt-1 text-[11px] leading-5 text-white/40">{driveStatus.data?.configured ? "Connected and ready to inspect file access." : "Not connected in this environment."}</div></div></div><div className="flex gap-3 border border-[#262626] bg-[#0A0A0A] p-3"><WandSparkles size={17} className="mt-0.5 shrink-0 text-white/50" /><div><div className="text-xs font-medium">Review workspace</div><div className="mt-1 text-[11px] leading-5 text-white/40">Every drop remains review-gated before publishing.</div></div></div></div></section>
      </div>
    </div>
  );
}
