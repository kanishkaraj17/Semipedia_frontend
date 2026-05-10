import React, { useState, useRef, useEffect } from "react";
import { Send, Cpu, Clock, History, LayoutGrid, TerminalSquare, Search, X, Menu } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { MarkdownRenderer } from "../components/markdown-renderer";
import { cn } from "../lib/utils";

type HistoryItem = {
  query: string;
  answer: string;
};

const TOPICS = [
  "RTL Design",
  "Design Verification",
  "DFT",
  "Physical Design",
  "STA",
  "Protocols",
  "EDA Tools",
  "Semiconductor Process"
];

const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const BuiltByFooter = () => (
  <div style={{ borderTop: "1px solid #E0E0E0" }} className="px-3 py-3 shrink-0">
    <p style={{ fontSize: "12px", color: "#888888" }} className="flex items-center gap-1.5">
      Built by&nbsp;
      <a
        href="https://www.linkedin.com/in/kanishkaraj17/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium transition-colors"
        style={{ color: "#1E90FF" }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLAnchorElement).style.color = "#0060CC";
          (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLAnchorElement).style.color = "#1E90FF";
          (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none";
        }}
      >
        <LinkedInIcon />
        Kanishka Raj
      </a>
      &nbsp;🔧
    </p>
  </div>
);

export default function Home() {
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isRefusal, setIsRefusal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessing = useRef(false);

  // Auto-scroll to bottom of answer
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentAnswer]);

  // Close sidebar on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsSidebarOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleSubmit = async (e?: React.FormEvent, presetQuery?: string) => {
    if (e) e.preventDefault();
    const q = presetQuery || query;
    if (!q.trim()) return;

    // Block re-entrant calls while a response is in flight
    if (isProcessing.current) return;

    // Close sidebar on mobile after selecting a history item
    setIsSidebarOpen(false);

    if (q.toLowerCase().includes("history") || q.toLowerCase().includes("what did i ask")) {
      setQuery("");
      setHasSubmitted(true);
      setCurrentAnswer("Your recent query history is displayed in the panel on the left. Click on any past query to run it again.");
      setIsRefusal(false);
      return;
    }

    isProcessing.current = true;
    setQuery("");
    setIsSubmitting(true);
    setHasSubmitted(true);
    setCurrentAnswer("");
    setIsRefusal(false);

    try {
      const response = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, history: history.slice(0, 5) }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                fullAnswer += `\n\n**Error:** ${data.error}`;
                setCurrentAnswer(fullAnswer);
                break;
              }
              if (data.done) break;
              if (data.content) {
                fullAnswer += data.content;
                setCurrentAnswer(fullAnswer);
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }

      const isOutDomain = fullAnswer.includes("I'm SemicoBot") && fullAnswer.includes("trained exclusively in the VLSI");
      setIsRefusal(isOutDomain);

      setHistory(prev => {
        const newHistory = [{ query: q, answer: fullAnswer }, ...prev];
        return newHistory.slice(0, 5);
      });
      setCurrentAnswer("");

      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);

    } catch (error) {
      console.error("Error fetching chat:", error);
      setCurrentAnswer("Error connecting to SemicoBot. Please try again.");
    } finally {
      setIsSubmitting(false);
      isProcessing.current = false;
    }
  };

  const handleTopicClick = (topic: string) => {
    setQuery(`Tell me about ${topic}`);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 10);
  };

  // Shared sidebar content used in both desktop and mobile
  const SidebarContent = () => (
    <>
      {/* Sidebar header */}
      <div className="p-4 border-b border-border flex items-center justify-between text-sm font-semibold text-foreground shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          Session History
        </div>
        {/* Close button — only visible on mobile */}
        <button
          className="md:hidden flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* History list */}
      <ScrollArea className="flex-1 p-2">
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center p-4 mt-8 flex flex-col items-center gap-2">
            <Clock className="w-8 h-8 opacity-20" />
            <p>No queries yet.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {history.map((item, i) => (
              <button
                key={i}
                onClick={() => handleSubmit(undefined, item.query)}
                className="w-full text-left p-3 rounded-md hover:bg-card border border-transparent hover:border-border transition-all group flex items-start gap-2"
                data-testid={`btn-history-${i}`}
              >
                <TerminalSquare className="w-4 h-4 mt-0.5 text-primary/50 group-hover:text-primary shrink-0" />
                <span className="text-sm text-foreground line-clamp-2 leading-snug">{item.query}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Built-by footer — pinned to bottom */}
      <BuiltByFooter />
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-background">

      {/* ── Mobile hamburger button ── */}
      <button
        className="md:hidden fixed top-3 left-3 z-[1000] flex items-center justify-center rounded-lg shadow-md"
        style={{ width: 40, height: 40, background: "#1E90FF" }}
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Open session history"
      >
        <Menu className="w-5 h-5 text-white" />
      </button>

      {/* ── Mobile backdrop overlay ── */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-[998]"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile sidebar (fixed overlay) ── */}
      <aside
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-[999] flex flex-col bg-card border-r border-border",
          "transition-transform duration-300 ease-in-out"
        )}
        style={{
          width: "min(80vw, 300px)",
          transform: isSidebarOpen ? "translateX(0)" : "translateX(-100%)",
        }}
        aria-label="Session history sidebar"
      >
        <SidebarContent />
      </aside>

      {/* Header */}
      <header className="flex-none h-16 border-b border-border flex items-center px-6 justify-between bg-card shrink-0">
        {/* On mobile, offset title so it doesn't sit under hamburger */}
        <div className="flex items-center gap-2 md:ml-0 ml-10">
          <div className="bg-primary/10 p-2 rounded-md">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-lg leading-tight tracking-tight">SemiPedia</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Powered by SemicoBot</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground font-mono hidden md:flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          System Online
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop sidebar (static, unchanged) ── */}
        <aside className="hidden md:flex w-72 flex-col border-r border-border bg-muted/30">
          <SidebarContent />
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col relative max-w-4xl mx-auto w-full">

          {/* Messages Scroll Area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6"
          >
            {!hasSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full mb-20 animate-in fade-in duration-700">
                <div className="bg-card border border-border p-4 rounded-2xl shadow-sm mb-8 flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-xl">
                    <Cpu className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Welcome to SemiPedia</h2>
                    <p className="text-muted-foreground text-sm">Your precision VLSI and semiconductor AI assistant.</p>
                  </div>
                </div>

                <div className="w-full space-y-4">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 px-1">
                    <LayoutGrid className="w-4 h-4" />
                    Suggested Topics
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map(topic => (
                      <button
                        key={topic}
                        onClick={() => handleTopicClick(topic)}
                        className="px-3 py-1.5 rounded-full bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
                        data-testid={`chip-topic-${topic.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {history.map((item, i) => (
                  <div key={i} className="flex flex-col gap-4">
                    {/* User Query */}
                    <div className="flex justify-end ml-8 md:ml-12">
                      <div className="bg-primary text-primary-foreground px-5 py-3 rounded-2xl rounded-tr-sm text-sm shadow-sm inline-block max-w-full">
                        {item.query}
                      </div>
                    </div>

                    {/* Bot Answer */}
                    <div className="flex gap-3 md:gap-4 mr-8 md:mr-12">
                      <div className="w-8 h-8 rounded-md bg-card border border-border flex items-center justify-center shrink-0 shadow-sm">
                        <Cpu className="w-4 h-4 text-primary" />
                      </div>
                      <Card className={cn(
                        "flex-1 border-border shadow-sm overflow-hidden",
                        item.answer.includes("trained exclusively in the VLSI") ? "border-amber-500/30 bg-amber-500/5" : "bg-card"
                      )}>
                        <CardContent className="p-4 md:p-5">
                          <MarkdownRenderer content={item.answer} />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )).reverse()}

                {/* Current Active Query */}
                {(isSubmitting || currentAnswer) && (
                  <div className="flex flex-col gap-4">
                    {query && (
                      <div className="flex justify-end ml-8 md:ml-12">
                        <div className="bg-primary text-primary-foreground px-5 py-3 rounded-2xl rounded-tr-sm text-sm shadow-sm inline-block max-w-full">
                          {query}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 md:gap-4 mr-8 md:mr-12">
                      <div className="w-8 h-8 rounded-md bg-card border border-border flex items-center justify-center shrink-0 shadow-sm">
                        <Cpu className="w-4 h-4 text-primary" />
                      </div>
                      <Card className={cn(
                        "flex-1 border-border shadow-sm overflow-hidden",
                        isRefusal ? "border-amber-500/30 bg-amber-500/5" : "bg-card"
                      )}>
                        <CardContent className="p-4 md:p-5">
                          {currentAnswer ? (
                            <MarkdownRenderer content={currentAnswer} />
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                              <span className="ml-2">Analyzing silicon...</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 md:p-6 bg-gradient-to-t from-background via-background to-transparent pt-10">
            <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto">
              <div className="relative flex items-center shadow-sm">
                <Search className="w-5 h-5 absolute left-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about RTL, STA, logic gates..."
                  className="pl-12 pr-14 py-6 text-base bg-card border-border rounded-xl focus-visible:ring-primary shadow-sm w-full"
                  disabled={isSubmitting}
                  data-testid="input-query"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="absolute right-2 h-9 w-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={!query.trim() || isSubmitting}
                  data-testid="btn-submit"
                >
                  <Send className="w-4 h-4" />
                  <span className="sr-only">Send</span>
                </Button>
              </div>
              <div className="text-center mt-3">
                <p className="text-[11px] text-muted-foreground font-medium">
                  SemicoBot specializes in VLSI and Semiconductor engineering.
                </p>
              </div>
            </form>
          </div>

        </main>
      </div>
    </div>
  );
}
