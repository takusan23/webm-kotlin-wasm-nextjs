# webm-kotlin-wasm-nextjs

`JavaScript`の`MediaRecorder`で作った`WebM`ファイルはシークできないので、シークできるようにする Kotlin/Wasm 製の Web ページ。  
また、実験的に WebM を逆再生して保存する機能も搭載しています（WebCodecs）。

![スクショ](https://oekakityou.negitoro.dev/original/d333d141-58c6-4afb-b195-604baf4e8258.png)

# URL

https://webm.negitoro.dev

# 開発者向け
静的サイトです。すべての処理はブラウザで完結します

## 開発環境構築

```shell
npm i
npm run dev
```

`localhost:3000`を開きます。

### Kotlin 側の開発環境構築
`WebM`の読み書き（パーサー、ミキサー）は`Kotlin`で実装されており、`Kotlin/Wasm`へビルドし、`Next.js`で読み込むことで利用しています。  
`himari-webm-kotlin-multiplatform`フォルダがそれです。

https://github.com/takusan23/HimariWebmKotlinMultiplatform

の`npm ライブラリ作成`を参考にしてください。コピーして`npm i`するだけですが。

## デプロイ手順
以下のコマンドだと思います。

```shell
npm run build
```

`out`フォルダに静的サイトの成果物が生成されます。

このサイトは`S3 + CloudFront`なので、ビルドしてビルド結果の中身を`S3`バケットに入れて、`CloudFront`のキャッシュを消す必要があります。  
`GitHub Actions`作ってないので、手動で更新してね...