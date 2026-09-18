import { ArrowLeft, Check, Download, ExternalLink, Loader2, RefreshCw, Save, Send, Sparkles, Video, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

type Clip = { id: string; project_id?: string; title: string; caption?: string | null; clip_url: string | null };
type GenerationJob = { id: string; status: string; progress: number; current_step?: string | null; error_message?: string | null; created_at?: string | Date };

export default function ProjectDetail() {
  const [, params] = useRoute("/project/:id");
  const projectId = params?.id ?? "";
  const project = trpc.klipflow.projects.get.useQuery({ projectId }, { enabled: Boolean(projectId) });
  const history = trpc.klipflow.projects.generationHistory.useQuery({ projectId }, { enabled: Boolean(projectId), refetchInterval: 1500 });
  const allClips = trpc.klipflow.clips.list.useQuery(undefined, { enabled: Boolean(projectId), refetchInterval: 5000 });
  const accounts = trpc.klipflow.accounts.list.useQuery();
  const generate = trpc.klipflow.projects.generate.useMutation({ onSettled: () => { history.refetch(); allClips.refetch(); project.refetch(); } });
  const retry = trpc.klipflow.projects.retry.useMutation({ onSettled: () => { history.refetch(); allClips.refetch(); project.refetch(); } });
  const cancel = trpc.klipflow.projects.cancelGeneration.useMutation({ onSuccess: () => { setNotice("Cancellation requested. The current FFmpeg step will stop safely."); history.refetch(); }, onError: (error) => setNotice(error.message) });
  const post = trpc.klipflow.clips.autoPost.useMutation();
  const realPost = trpc.klipflow.clips.realPost.useMutation();
  const update = trpc.klipflow.clips.updateMetadata.useMutation();
  const [started, setStarted] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { title: string; caption: string }>>({});
  const [posting, setPosting] = useState<string | null>(null);
  const [posted, setPosted] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState(false);
  const clips = useMemo(() => (allClips.data ?? []).filter((clip) => clip.project_id === projectId) as Clip[], [allClips.data, projectId]);
  const latest = (history.data?.[0] ?? null) as GenerationJob | null;
  const active = latest ? ["queued", "running", "cancelling"].includes(latest.status) : false;
  const canRetry = latest ? ["failed", "cancelled"].includes(latest.status) : false;

  const runGeneration = (isRetry = false) => {
    setStarted(true);
    setNotice("");
    const mutation = isRetry ? retry : generate;
    mutation.mutate({ projectId }, { onSuccess: () => { history.refetch(); allClips.refetch(); }, onError: (error) => { setNotice(error.message); history.refetch(); } });
  };

  useEffect(() => {
    if (!project.data || history.isLoading || started || (history.data?.length ?? 0) > 0) return;
    const timer = window.setTimeout(() => runGeneration(), 1200);
    setStarted(true);
    return () => window.clearTimeout(timer);
  }, [project.data, history.isLoading, history.data, started, projectId]);

  useEffect(() => {
    if (clips.length) setDrafts((current) => ({ ...Object.fromEntries(clips.map((clip) => [clip.id, { title: clip.title, caption: clip.caption ?? "" }])), ...current }));
  }, [clips]);

  const edit = (id: string, field: "title" | "caption", value: string) => setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? { title: "", caption: "" }), [field]: value } }));
  const autoPost = (clipId: string, platform: "tiktok" | "instagram" | "youtube" | "x") => {
    const account = accounts.data?.find((item) => item.platform === platform);
    if (!account) { setNotice(`Connect your ${platform} account first in Connected Accounts.`); return; }
    const draft = drafts[clipId];
    if (!draft) return;
    setPosting(clipId); setNotice("");
    update.mutate({ clipId, title: draft.title.trim() || "Untitled clip", caption: draft.caption }, { onSuccess: () => {
      const onSuccess = () => { setPosting(null); setPosted(clipId); setToast(true); window.setTimeout(() => setToast(false), 7000); };
      const onError = (error: { message?: string }) => { setPosting(null); setNotice(error.message || "We could not post this clip. Please try again."); };
      if (platform === "youtube" || platform === "instagram") realPost.mutate({ clipId, platform }, { onSuccess, onError });
      else post.mutate({ clipId, platform, handle: account.handle }, { onSuccess, onError });
    }, onError: () => { setPosting(null); setNotice("We could not save the clip text. Please try again."); } });
  };

  if (project.isLoading) return <div className="rounded-3xl bg-white p-8 text-center text-sm text-black/45 dark:bg-[#1C1C1C]">Loading your project…</div>;
  if (project.error || !project.data) return <div className="rounded-3xl bg-white p-8 text-center text-sm text-black/50 dark:bg-[#1C1C1C]">This project could not be found.</div>;
  const source = project.data.file_url ?? project.data.source_link ?? undefined;
  const progress = Math.max(0, Math.min(100, Number(latest?.progress ?? (active ? 1 : 0))));

  return <div className="space-y-6">
    <Link href="/"><span className="flex items-center gap-2 text-sm font-bold text-black/45 dark:text-white/55"><ArrowLeft size={16} /> My projects</span></Link>
    <div><h1 className="mt-4 text-3xl font-black">{project.data.title}</h1><p className="mt-2 text-sm text-black/50 dark:text-white/60">Edit each clip before you post it.</p></div>
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-[#1C1C1C]"><div className="flex aspect-video items-center justify-center bg-[#252525] text-white/40">{source ? <video src={source} controls className="h-full w-full object-contain" /> : <Video size={34} />}</div><div className="p-4"><div className="text-sm font-bold">Source video</div>{project.data.source_link && <a href={project.data.source_link} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 truncate text-sm text-[#FF4D00]">Open original video <ExternalLink size={14} /></a>}{(project.data.requirements_link || project.data.requirements_file) && <a href={project.data.requirements_link ?? project.data.requirements_file ?? undefined} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 truncate text-sm text-[#FF4D00]">Open requirements / campaign link <ExternalLink size={14} /></a>}</div></section>
    <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1C1C1C]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[#FF4D00]">Generation status</p><h2 className="mt-1 text-lg font-black">{active ? (latest?.current_step ?? "Preparing your clips…") : latest?.status === "completed" ? "Generation complete" : latest?.status === "failed" ? "Generation failed" : latest?.status === "cancelled" ? "Generation cancelled" : "Ready to generate"}</h2></div>{active && <button onClick={() => cancel.mutate({ projectId, jobId: latest?.id })} className="flex h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-extrabold text-red-600"><XCircle size={15} /> Cancel</button>}{canRetry && <button onClick={() => runGeneration(true)} disabled={retry.isPending} className="flex h-10 items-center gap-2 rounded-xl bg-[#FF4D00] px-3 text-xs font-extrabold text-white"><RefreshCw size={15} /> {retry.isPending ? "Retrying…" : "Retry"}</button>}</div>{active && <><div className="mt-4 flex items-center justify-between text-xs font-bold"><span>{latest?.current_step ?? "Working…"}</span><span>{progress}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-[#FF4D00] transition-all duration-300" style={{ width: `${progress}%` }} /></div></>}{latest?.error_message && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{latest.error_message}</p>}<div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10"><p className="text-xs font-bold uppercase tracking-wide text-black/40 dark:text-white/45">Recent attempts</p><div className="mt-2 space-y-2">{(history.data ?? []).slice(0, 5).map((job) => <div key={job.id} className="flex items-center justify-between gap-3 text-xs"><span className="capitalize text-black/55 dark:text-white/60">{job.status} · {job.current_step ?? "Queued"}</span><span className="font-bold text-black/40 dark:text-white/45">{job.progress}%</span></div>)}</div></div></section>
    {!clips.length && !active && !canRetry && <section className="rounded-3xl bg-white p-8 text-center dark:bg-[#1C1C1C]"><Sparkles className="mx-auto text-[#FF4D00]" size={34} /><h2 className="mt-4 text-lg font-black">Your clips will appear here</h2><p className="mt-1 text-sm text-black/45 dark:text-white/55">Start generation from this project to create five versions.</p><button onClick={() => runGeneration()} disabled={generate.isPending} className="mt-5 h-12 rounded-2xl bg-[#FF4D00] px-6 text-sm font-extrabold text-white">Generate five clips</button></section>}
    {clips.length > 0 && <section><div className="mb-3 flex items-center gap-2"><Sparkles className="text-[#FF4D00]" size={19} /><h2 className="text-xl font-black">Your five clips</h2></div><div className="grid gap-4 sm:grid-cols-2">{clips.map((clip) => { const draft = drafts[clip.id] ?? { title: clip.title, caption: clip.caption ?? "" }; return <article key={clip.id} className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-[#1C1C1C]"><div className="flex aspect-video items-center justify-center bg-[#252525] text-white/40">{clip.clip_url ? <video src={clip.clip_url} controls className="h-full w-full object-contain" /> : <Video />}</div><div className="p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-black/40 dark:text-white/45">Clip text</span><span className="text-xs text-black/40 dark:text-white/45">30–60 sec</span></div><input value={draft.title} onChange={(e) => edit(clip.id, "title", e.target.value)} placeholder="Clip title" className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-[#F7F7F5] px-3 text-sm font-extrabold outline-none focus:border-[#FF4D00]" /><textarea value={draft.caption} onChange={(e) => edit(clip.id, "caption", e.target.value)} placeholder="Caption and hashtags before posting" rows={3} className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-[#F7F7F5] px-3 py-2 text-sm outline-none focus:border-[#FF4D00]" /><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => update.mutate({ clipId: clip.id, title: draft.title.trim() || "Untitled clip", caption: draft.caption })} className="flex h-10 items-center justify-center gap-1 rounded-xl border border-black/10 text-xs font-extrabold dark:border-white/15"><Save size={14} /> Save text</button><a href={clip.clip_url ?? undefined} download className={`flex h-10 items-center justify-center gap-1 rounded-xl border border-black/10 text-xs font-extrabold dark:border-white/15 ${clip.clip_url ? "" : "pointer-events-none opacity-40"}`}><Download size={14} /> Download</a></div><select disabled={posting === clip.id} defaultValue="" onChange={(event) => { if (event.target.value) autoPost(clip.id, event.target.value as "tiktok" | "instagram" | "youtube" | "x"); }} className="mt-2 h-11 w-full rounded-xl bg-[#FF4D00] px-3 text-xs font-extrabold text-white outline-none"><option value="">{posting === clip.id ? "Posting…" : posted === clip.id ? "Posted successfully" : "Auto-post after saving text"}</option><option value="tiktok">Auto-post to TikTok</option><option value="instagram">Auto-post to Instagram</option><option value="youtube">Auto-post to YouTube</option></select>{posted === clip.id && <p className="mt-3 flex items-center gap-1 text-xs font-bold text-green-700"><Check className="animate-bounce" size={15} /> Posted successfully</p>}</div></article>; })}</div></section>}
    {notice && <div className="rounded-2xl bg-[#FFF1EB] p-4 text-sm font-semibold text-[#B63D00]"><Send className="mr-2 inline" size={16} />{notice}</div>}
    <Link href="/clips"><button className="h-12 w-full rounded-2xl bg-[#FF4D00] text-sm font-extrabold text-white">Go to My Clips</button></Link>
    {toast && <div className="fixed bottom-5 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#151515] p-4 text-white shadow-xl"><Check className="text-[#FF4D00]" size={20} /><div className="flex-1 text-sm font-bold">Posted successfully. Your 30-minute submission window has started.</div><Link href="/clips" className="text-xs font-extrabold text-[#FF4D00]">View My Clips</Link><button onClick={() => setToast(false)} aria-label="Close notification"><X size={16} /></button></div>}
  </div>;
}
