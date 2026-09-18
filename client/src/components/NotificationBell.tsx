import { Bell, Check, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = trpc.klipflow.notifications.list.useQuery(undefined, { enabled: open });
  const unread = trpc.klipflow.notifications.unreadCount.useQuery();
  const markRead = trpc.klipflow.notifications.markRead.useMutation({
    onSuccess: () => {
      void notifications.refetch();
      void unread.refetch();
    },
  });

  return (
    <div className="relative">
      <button aria-label="Notifications" onClick={() => setOpen((value) => !value)} className="relative rounded-full p-2 text-black/50 hover:bg-black/5 hover:text-black">
        <Bell size={18} />
        {(unread.data ?? 0) > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF4D00] px-1 text-[9px] font-black text-white">{(unread.data ?? 0) > 9 ? "9+" : unread.data}</span>}
      </button>
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      {open && <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3"><div><p className="text-sm font-black">Notifications</p><p className="text-[11px] text-black/45">Updates about your clips</p></div><button aria-label="Close notifications" onClick={() => setOpen(false)}><X size={16} /></button></div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.isLoading && <p className="p-4 text-sm text-black/45">Loading…</p>}
          {!notifications.isLoading && (notifications.data ?? []).length === 0 && <p className="p-4 text-sm text-black/45">You’re all caught up.</p>}
          {(notifications.data ?? []).map((item) => <div key={item.id} className={`border-b border-black/5 px-4 py-3 ${item.is_read ? "bg-white" : "bg-[#FFF7F2]"}`}>
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{item.title}</p><p className="mt-1 text-xs leading-5 text-black/55">{item.body}</p><p className="mt-1 text-[10px] text-black/35">{new Date(item.created_at).toLocaleString()}</p></div>{!item.is_read && <button title="Mark as read" aria-label="Mark as read" onClick={() => markRead.mutate({ notificationId: item.id })} className="rounded-full p-1 text-[#FF4D00] hover:bg-[#FFF1EB]"><Check size={15} /></button>}</div>
            {item.href && <Link href={item.href} onClick={() => { setOpen(false); if (!item.is_read) markRead.mutate({ notificationId: item.id }); }} className="mt-2 inline-block text-xs font-black text-[#FF4D00]">Open in KlipFlow →</Link>}
          </div>)}
        </div>
      </div>}
    </div>
  );
}
