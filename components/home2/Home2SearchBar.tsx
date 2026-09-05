import React, { useState, useMemo } from "react";
import Icon from "../Icons";
import {
  searchModules,
  SEARCH_SUGGESTION_WORDS,
  ModuleDefinition,
} from "../../lib/module-registry";

interface Home2SearchBarProps {
  onNavigate: (routeId: string) => void;
  onOpenHelp: (module: ModuleDefinition) => void;
}

export default function Home2SearchBar({ onNavigate, onOpenHelp }: Home2SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const results = useMemo(() => searchModules(query), [query]);
  const active = query.trim().length > 0 && isFocused;

  return (
    <div style={{ position: "relative" }}>
      <div className="home2-search-box">
        <span aria-hidden="true"><Icon name="search" size={15} /></span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 150)}
          placeholder="搜尋功能名稱、動作或問題（例：找文獻、沒有靈感、選期刊、中翻英）..."
          aria-label="搜尋功能"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="清除搜尋"
            style={{ border: 0, background: "transparent", color: "var(--faint)", cursor: "pointer", fontSize: 13 }}>
            ✕
          </button>
        )}
      </div>

      {/* 熱門探索建議詞 */}
      {!query && (
        <div className="home2-suggest">
          {SEARCH_SUGGESTION_WORDS.slice(0, 6).map((word) => (
            <button type="button" key={word} onClick={() => setQuery(word)}>
              {word}
            </button>
          ))}
        </div>
      )}

      {/* 搜尋結果浮層 */}
      {active && (
        <div className="home2-search-pop" role="listbox" aria-label="搜尋結果">
          {results.length === 0 ? (
            <div className="home2-search-empty">
              查無相符功能，可試試「靈感、文獻、期刊、翻譯」等詞，或查看下方完整功能地圖。
            </div>
          ) : (
            <div>
              <div style={{ padding: "6px 8px", color: "var(--faint)", fontSize: 10, borderBottom: "1px solid #e9ece8" }}>
                找到 {results.length} 項相符功能
              </div>
              {results.map((mod) => (
                <div key={mod.moduleId} className="home2-search-item" role="option">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{mod.displayName}</b>{" "}
                    <small style={{ display: "inline", color: "var(--faint)" }}>{mod.actionLabel}</small>
                    <small>{mod.plainSummary}</small>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button type="button" className="home2-help-btn" onClick={() => onOpenHelp(mod)}>說明</button>
                    <button type="button" className="home2-fn" style={{ padding: "5px 9px", fontSize: 10 }}
                      onClick={() => { onNavigate(mod.routeNavId); setIsFocused(false); }}>
                      前往
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
