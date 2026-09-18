import { Link } from "wouter";

export default function NotFound() {
  return <div className="flex min-h-[60vh] items-center justify-center"><div className="rounded-3xl bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-black">That page is not here</h1><p className="mt-2 text-sm text-black/45">Let’s get you back to the campaigns.</p><Link href="/"><button className="mt-5 h-11 rounded-2xl bg-[#FF4D00] px-5 text-sm font-extrabold text-white">Go home</button></Link></div></div>;
}
