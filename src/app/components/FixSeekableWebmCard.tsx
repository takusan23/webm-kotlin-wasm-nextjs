'use client'

import { useState } from "react"
import KotlinToJsArray from "../tools/KotlinToJsArray"
import { BlobDownloadTool } from "../tools/BlobDownloadTool"

export default function FixSeekableWebmCard() {
    const [isRunning, setRunning] = useState(false)

    async function handleFileSelect(file?: File) {
        if (!file) return

        // ライブラリを動的ロード
        const { fixSeekableWebm } = await import('himari-webm-kotlin-multiplatform')
        setRunning(true)

        // バイト配列を得る
        const byteArray = await file.arrayBuffer()
        const intArray = new Int8Array(byteArray)
        const fixWebmByteArray = fixSeekableWebm(intArray as any)

        // Blob にして保存
        const blob = new Blob([KotlinToJsArray.toJsByteArray(fixWebmByteArray)], { type: 'video/webm' })
        BlobDownloadTool.download(blob, `fix-seekable-webm-kotlinwasm-${Date.now()}.webm`)
        setRunning(false)
    }

    return (
        <div className="flex flex-col space-y-2 p-5 border-2 border-blue-400 rounded-2xl">
            <h2 className="text-blue-400 text-2xl">JavaScript の MediaRecorder で作った WebM をシーク可能な WebM ファイルに修正する</h2>
            <p>Kotlin で書いた処理を Wasm にして呼び出しています。ブラウザ内で完結します。</p>
            {
                isRunning
                    ? <p>処理中です。しばらくお待ちください。</p>
                    : <input
                        onChange={(ev) => handleFileSelect(ev.target.files?.[0])}
                        className="border-2 border-blue-400 rounded-2xl"
                        type="file"
                        accept="video/webm" />
            }
        </div>
    )
}
