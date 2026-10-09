import React from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import "../styles/globals.css";
import { Navbar } from "../components/Navbar";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>SoroStream | Soroban Token Vesting & Asset Streaming Protocol</title>
        <meta
          name="description"
          content="Trustless, per-second linear asset streaming and cliff vesting protocol for Soroban Asset Contracts (SAC) on the Stellar Network."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen flex flex-col bg-[#090D16] text-[#F9FAFB] selection:bg-emerald-500 selection:text-black">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Component {...pageProps} />
        </main>
        <footer className="border-t border-white/10 py-8 bg-[#090D16]/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
            <div className="flex items-center space-x-2">
              <span>© 2026 SoroStream Protocol.</span>
              <span className="text-gray-600">•</span>
              <span className="text-emerald-400">Powered by Stellar & Soroban</span>
            </div>
            <div className="flex items-center space-x-6 text-gray-400">
              <a
                href="https://soroban.stellar.org"
                target="_blank"
                rel="noreferrer"
                className="hover:text-emerald-400 transition-colors"
              >
                Soroban Docs ↗
              </a>
              <a
                href="https://github.com/HassanKorey/SoroStream"
                target="_blank"
                rel="noreferrer"
                className="hover:text-emerald-400 transition-colors"
              >
                GitHub Repository ↗
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
