import { Metadata } from "next";
import FixSeekableWebmCard from "./components/FixSeekableWebmCard";
import MediaRecorderCard from "./components/MediaRecorderCard";
import ReverseWebmCard from "./components/ReverseWebmCard";

export const metadata: Metadata = {
  title: 'Kotlin/Wasm + Next.js で出来た WebM ツール'
}

export default function Home() {
  return (
    <div className="flex flex-col space-y-4 p-5 max-w-6xl m-auto">

      <a className="underline" href="https://github.com/takusan23/webm-kotlin-wasm-nextjs">ソースコード</a>

      <h1 className="text-4xl">Kotlin/Wasm + Next.js で出来た WebM ツール</h1>
      <p>JavaScript の MediaRecorder で作った WebM をシーク可能な WebM ファイルに修正したり出来ます。</p>
      <p>処理はすべてブラウザ側の JavaScript + Wasm で完結します。</p>

      <MediaRecorderCard />
      <FixSeekableWebmCard />
      <ReverseWebmCard />
    </div>
  )
}
