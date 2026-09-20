import { X } from "lucide-react";
import { useState } from "react";

type Clip = { title?: string | null; caption?: string | null; clip_url?: string | null; projects?: Array<{ title?: string | null }> };
type Platform = "tiktok" | "instagram" | "youtube" | "x";

const platforms: Array<{ id: Platform; label: string }> = [{ id: "tiktok", label: "TikTok" }, { id: "instagram", label: "Instagram Reel" }, { id: "youtube", label: "YouTube Short" }, { id: "x", label: "X" }];

export default function ClipPreviewModal({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const vertical = platform !== "x";
  const title = clip.title || "Your KlipFlow clip";
  const caption = clip.caption || title;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Social media clip preview" onClick={onClose}><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[#F7F7F5] p-5" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-[#FF4D00]">Preview before publishing</p><h2 className="text-xl font-black">See how this looks on each platform</h2></div><button onClick={onClose} className="rounded-full p-2 hover:bg-black/5" aria-label="Close preview"><X size={20} /></button></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{platforms.map((item) => <button key={item.id} onClick={() => setPlatform(item.id)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-extrabold ${platform === item.id ? "bg-[#FF4D00] text-white" : "bg-white text-black/55"}`}>{item.label}</button>)}</div><div className="mt-5 flex justify-center"><div className={`relative overflow-hidden rounded-[2rem] bg-black shadow-xl ${vertical ? "aspect-[9/16] w-[min(72vw,280px)]" : "aspect-video w-full max-w-lg rounded-2xl"}`}>{clip.clip_url ? <video src={clip.clip_url} controls playsInline className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-white/60">No preview video available</div>}<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-16 text-white"><p className="text-sm font-black">{title}</p><p className="mt-1 line-clamp-3 text-xs text-white/80">{caption}</p><p className="mt-2 text-[10px] font-bold text-white/60">{platforms.find((item) => item.id === platform)?.label} preview · {clip.projects?.[0]?.title || "KlipFlow"}</p></div></div></div><p className="mt-4 text-center text-xs text-black/45">Preview simulates the layout, caption position, and vertical crop. Final platform UI, audio treatment, and safe zones may vary.</p></div></div>;
}
