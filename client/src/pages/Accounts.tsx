import { Bell, Instagram, Link2, Play, Trash2, Video } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

const platforms = [{ id: "tiktok" as const, label: "TikTok", icon: Play }, { id: "instagram" as const, label: "Instagram", icon: Instagram }, { id: "youtube" as const, label: "YouTube", icon: Video }, { id: "x" as const, label: "X", icon: Link2 }, { id: "telegram" as const, label: "Telegram", icon: Bell }];

function oauthMessage() {
  const params = new URLSearchParams(window.location.search);
  const provider = params.get("oauth");
  if (!provider) return null;
  if (provider.endsWith("-success")) return `${provider.replace("-success", "")} is connected. You can now post and sync views.`;
  return params.get("message") || "That account could not be connected.";
}

export default function Accounts() {
  const accounts = trpc.klipflow.accounts.list.useQuery();
  const status = trpc.klipflow.integrationStatus.useQuery();
  const connect = trpc.klipflow.accounts.connect.useMutation({ onSuccess: () => { accounts.refetch(); setPlatform(null); setHandle(""); } });
  const remove = trpc.klipflow.accounts.remove.useMutation({ onSuccess: () => accounts.refetch() });
  const [platform, setPlatform] = useState<(typeof platforms)[number]["id"] | null>(null);
  const [handle, setHandle] = useState("");
  const message = oauthMessage();
  const instagramManual = status.data?.instagramOAuth !== "configured";
  const oauthReady = platform === "youtube" || (platform === "instagram" && !instagramManual);

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-[#FF4D00]">Your accounts</p><h1 className="mt-1 text-3xl font-black">Connected Accounts</h1><p className="mt-2 text-sm text-black/50">Connect places for auto-posting and personal Telegram alerts.</p></div>
    {message && <div className="rounded-2xl bg-[#FFF1EB] p-4 text-sm font-bold text-[#B63D00]">{message}</div>}
    <div className="space-y-3">{(accounts.data ?? []).map((account) => <div key={account.id} className="flex items-center gap-3 rounded-3xl bg-white p-4"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF1EB] text-[#FF4D00]"><Link2 size={20} /></div><div className="flex-1"><div className="font-extrabold capitalize">{account.platform}</div><div className="text-sm text-black/45">{account.platform === "telegram" ? "Chat" : "@"}{account.handle} · <span className="font-semibold text-green-700">{account.status === "active" ? "OAuth connected" : "Connected"}</span></div></div><button aria-label="Remove account" onClick={() => remove.mutate({ id: account.id })} className="rounded-full p-2 text-black/35 hover:bg-black/5"><Trash2 size={17} /></button></div>)}{accounts.data?.length === 0 && !accounts.isLoading && <div className="rounded-3xl bg-white p-6 text-sm text-black/50">No accounts connected yet.</div>}</div>
    <section className="rounded-3xl bg-white p-5"><h2 className="font-black">Connect an account</h2><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{platforms.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setPlatform(id)} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-bold ${platform === id ? "border-[#FF4D00] bg-[#FFF1EB] text-[#FF4D00]" : "border-black/10"}`}><Icon size={17} /> {label}</button>)}</div>{platform && <div className="mt-4">
      {platform === "instagram" && instagramManual ? <><div className="rounded-2xl bg-[#FFF1EB] p-4 text-sm font-bold text-[#B63D00]">Coming soon – manual upload fallback</div><p className="mt-2 text-xs text-black/40">Instagram OAuth is optional for this deployment. You can still download your clips and upload them manually.</p></> : oauthReady ? <><p className="text-sm text-black/55">You will be sent to {platform === "youtube" ? "Google" : "Meta"} to approve posting and view access.</p><a href={`/api/oauth/${platform}/start`} className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF4D00] text-sm font-extrabold text-white">Connect {platform} with OAuth</a><p className="mt-2 text-xs text-black/40">You must use a YouTube channel or Instagram professional account.</p></> : <><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={platform === "telegram" ? "Your Telegram chat ID" : `Your ${platform} username`} className="h-12 w-full rounded-2xl border border-black/10 bg-[#F7F7F5] px-4 text-sm outline-none focus:border-[#FF4D00]" /><button disabled={!handle.trim() || connect.isPending} onClick={() => connect.mutate({ platform, handle })} className="mt-3 h-12 w-full rounded-2xl bg-[#FF4D00] text-sm font-extrabold text-white">{connect.isPending ? "Saving…" : `Connect ${platform}`}</button></>}
    </div>}{connect.error && <p className="mt-3 text-xs text-red-600">{connect.error.message}</p>}</section>
  </div>;
}
